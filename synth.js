function Oscillator(description, generator) {
    this.description = description;
    this.generator = generator;
}


function Voice(oscillator, attack, decay, sustain, release) {
    this.oscillator = oscillator;
    this.attack = attack;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
}


function Synth() {
    this.sampleRate = 44100;
    var portionSize = this.sampleRate / 100;
    var prebufferSize = this.sampleRate / 4;

    this.audio = new Audio();
    this.audio.mozSetup(1, this.sampleRate, 1);

    this.currentWritePosition = 0;

    this.oscillators = {
        "sine" : new Oscillator(
            "Sine", Math.sin
        ),
        "square" : new Oscillator(
            "Square",
            function(theta) {
                if (0 <= theta && theta <= Math.PI) {
                    return 1;
                } else if (Math.PI <= theta && theta <= 2 * Math.PI) {
                    return -1;
                }
            }
        ),
        "triangle" : new Oscillator(
            "Triangle",
            function(theta) { return 1 - 2 * Math.abs((theta / Math.PI) - 1) }
        ),
        "sawtooth" : new Oscillator(
            "Sawtooth",
            function(theta) { return theta / (Math.PI * 2) }
        ),
        "noise" : new Oscillator(
            "Noise",
            function() { return Math.random() * 2 - 1 }
        )
    };


    var synth = this;

    var playingNotes = [];

    this.Note = function(startTime, frequency, volume, voice) {
        this.startTime = startTime;
        this.frequency = frequency;
        this.volume = volume;
        this.radiansPerSample = 2 * Math.PI * frequency / synth.sampleRate;
        this.oscillator = voice.oscillator;
        this.attack = (voice.attack * synth.sampleRate) / 1000;
        this.decay = (voice.decay * synth.sampleRate) / 1000;
        this.sustain = voice.sustain;
        this.release = (voice.release * synth.sampleRate) / 1000;
        this.requestedStopTime = 0;
        this.actualStopTime = 0;
    }
    this.Note.prototype.getAmplitude = function(offset) {
        if (offset < this.startTime) {
            return 0;
        }
        var t = offset - this.startTime;
        if (t <= this.attack) {
            return t / this.attack;
        }
        if (t <= this.attack + this.decay) {
            return 1 - (((1 - this.sustain) * (t - this.attack)) / this.decay);
        }
        if (this.requestedStopTime == 0) {
            return this.sustain;
        }
        // We ignore requests to stop until the attack/decay is complete; this means that
        // our release can actually start later than requested
        if (this.actualStopTime == 0) {
            this.actualStopTime = offset;
        }
        if (offset < this.actualStopTime + this.release) {
            return this.sustain - ((this.sustain * (offset - this.actualStopTime)) / this.release);
        }
        // We're done.  There is doubtless a better way to remove a value from a JS list/array/object by its value
        // than the following abomination; as they say, patches accepted.
        var newPlayingNotes = []
        for (var i in playingNotes) {
            if (playingNotes[i] != this) {
                newPlayingNotes.push(playingNotes[i])
            }
        }
        playingNotes = newPlayingNotes
        return 0;
    }
    this.Note.prototype.getSample = function(tick) {
        var theta = (this.radiansPerSample * tick) % (2 * Math.PI);
        return this.volume * this.oscillator.generator(theta) * this.getAmplitude(tick);
    }
    this.Note.prototype.stop = function() {
        this.requestedStopTime = synth.currentWritePosition;
    }



    this.startNote = function(frequency, volume, voice) {
        var note = new synth.Note(
            synth.currentWritePosition,
            frequency, volume, voice
        );
        playingNotes.push(note);
        return note;
    }


    function getAmplitude(tick) {
        var result = 0;
        // JS may not be properly multithreaded, but a note could well time out and remove itself from
        // the playing list while we're in the middle of this, so we work on a copy.
        var storedPlayingNotes = playingNotes;
        for (var note in storedPlayingNotes) {
            result += storedPlayingNotes[note].getSample(tick);
        }
        return result;
    }

    function getSoundData(offset, size) {
        var soundData = new Float32Array(size);
        for (var i=0; i < size; i++) {
            soundData[i] = getAmplitude(i + offset);
        }
        return soundData;
    }


    function writeData() {
        while (synth.audio.mozCurrentSampleOffset() + prebufferSize >= synth.currentWritePosition) {
            var soundData = getSoundData(synth.currentWritePosition, portionSize);
            synth.audio.mozWriteAudio(soundData);
            synth.currentWritePosition += portionSize;
        }
    }


    var writeInterval = Math.floor(1000 * portionSize / this.sampleRate);
    setInterval(writeData, writeInterval);
}