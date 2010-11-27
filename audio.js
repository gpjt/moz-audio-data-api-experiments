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


function Note(startTime, frequency, voice) {
    this.startTime = startTime;
    this.frequency = frequency;
    this.radiansPerSample = 2 * Math.PI * frequency / sampleRate;
    this.voice = voice;
    this.requestedStopTime = 0;
    this.actualStopTime = 0;
}
Note.prototype.getAmplitude = function(offset) {
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
    return 0;
}
Note.prototype.getSample = function(tick) {
    var theta = (this.radiansPerSample * tick) % (2 * Math.PI);
    return this.voice.oscillator.generator(theta) * this.getAmplitude(tick);
}



// Developer's heuristic -- if you call something an XXManager, you don't really understand what it does...
function AudioManagerForWantOfABetterName() {
    this.audio = new Audio();
    this.audio.mozSetup(1, sampleRate, 1);

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


    setInterval(writeData, writeInterval);
}