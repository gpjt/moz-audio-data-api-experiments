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


// Developer's heuristic -- if you call something an XXManager, you don't really understand what it does...
function AudioManagerForWantOfABetterName(getAmplitude) {
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


    var manager = this;

    var playingNotes = [];

    this.Note = function(startTime, frequency, voice) {
        this.startTime = startTime;
        this.frequency = frequency;
        this.radiansPerSample = 2 * Math.PI * frequency / manager.sampleRate;
        this.voice = voice;
        this.requestedStopTime = 0;
        this.actualStopTime = 0;
    }
    this.Note.prototype.getAmplitude = function(offset) {
        if (offset < this.startTime) {
            return 0;
        }
        var t = offset - this.startTime;
        if (t <= this.voice.attack) {
            return t / this.voice.attack;
        }
        if (t <= this.voice.attack + this.voice.decay) {
            return 1 - (((1 - this.voice.sustain) * (t - this.voice.attack)) / this.voice.decay);
        }
        if (this.requestedStopTime == 0) {
            return this.voice.sustain;
        }
        // We ignore requests to stop until the attack/decay is complete; this means that
        // our release can actually start later than requested
        if (this.actualStopTime == 0) {
            this.actualStopTime = offset;
        }
        if (offset < this.actualStopTime + this.voice.release) {
            return this.voice.sustain - ((this.voice.sustain * (offset - this.actualStopTime)) / this.voice.release);
        }
        // We're done.  There is doubtless a better way to remove a value from a JS list/array/object by its value
        // than the following abomination; as they say, patches accepted.  At least we don't need to worry about
        // multiple threads...
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
        return this.voice.oscillator.generator(theta) * this.getAmplitude(tick);
    }
    this.Note.prototype.stop = function() {
        this.requestedStopTime = manager.currentWritePosition;
    }



    this.startNote = function(frequency, voice) {
        var note = new manager.Note(
            manager.currentWritePosition,
            frequency, voice
        );
        playingNotes.push(note);
        return note;
    }


    function getSoundData(offset, size) {
        var soundData = new Float32Array(size);
        for (var i=0; i < size; i++) {
            soundData[i] = getAmplitude(i + offset);
        }
        return soundData;
    }


    function writeData() {
        while (manager.audio.mozCurrentSampleOffset() + prebufferSize >= manager.currentWritePosition) {
            var soundData = getSoundData(manager.currentWritePosition, portionSize);
            manager.audio.mozWriteAudio(soundData);
            manager.currentWritePosition += portionSize;
        }
    }


    var writeInterval = Math.floor(1000 * portionSize / this.sampleRate);
    setInterval(writeData, writeInterval);
}