class MusicEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.isPlaying = false;

        this.layers = {
            bass: { oscillators: [ ], gains: [ ], compressor: null },
            pad: { oscillators: [ ], gains: [ ], filter: null, reverb: null }
        };

        this.nextChordTimeout = null;
        this.baseFrequency = 65.41; // C2
        this.currentKey = 0;

        this.chordLibrary = {
            'maj7': { bass: [0], pad: [0, 7, 11, 16, 19], tension: 0.1 },
            'min7': { bass: [0], pad: [0, 7, 10, 15, 19], tension: 0.15 },
            'maj9': { bass: [0], pad: [0, 7, 11, 14, 19], tension: 0.12 },
            'min9': { bass: [0], pad: [0, 7, 10, 14, 19], tension: 0.18 },
            'sus2': { bass: [0], pad: [0, 7, 12, 14, 19], tension: 0.25 },
            'sus4': { bass: [0], pad: [0, 7, 12, 17, 19], tension: 0.28 },
            'add9': { bass: [0], pad: [0, 7, 14, 16, 21], tension: 0.15 },
            'madd9': { bass: [0], pad: [0, 7, 14, 15, 21], tension: 0.2 },
            'openvoice': { bass: [0], pad: [0, 7, 12, 19, 24], tension: 0.08 },
            '6add9': { bass: [0], pad: [0, 7, 9, 14, 19], tension: 0.18 }
        };
        this.chordCompatibility = {
            'maj7': ['maj9', 'min7', 'sus2', 'add9', 'openvoice', '6add9'],
            'min7': ['maj7', 'min9', 'sus4', 'madd9', 'openvoice'],
            'maj9': ['maj7', 'add9', 'sus2', '6add9', 'openvoice'],
            'min9': ['min7', 'madd9', 'sus2', 'maj9'],
            'sus2': ['maj7', 'maj9', 'add9', 'openvoice', 'sus4'],
            'sus4': ['maj7', 'sus2', 'min7', 'openvoice'],
            'add9': ['maj9', 'sus2', 'maj7', 'openvoice', '6add9'],
            'madd9': ['min9', 'min7', 'add9', 'sus2'],
            'openvoice': ['sus2', 'maj7', 'add9', 'maj9'],
            '6add9': ['maj7', 'maj9', 'add9', 'sus2']
        };

        this.currentChordName = 'maj7';
        this.currentTension = 0.1;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.2;
            this.setupLayerEffects();
        }
    }

    async start() {
        if (this.isPlaying) return;

        this.init();
        if (this.audioContext.state === 'suspended')
            await this.audioContext.resume();

        this.isPlaying = true;
        this.currentKey = Math.floor(Math.random() * 12);

        this.playNextChord();
    }

    setupLayerEffects() {
        const bassComp = this.audioContext.createDynamicsCompressor();
        bassComp.threshold.value = -30;
        bassComp.knee.value = 40;
        bassComp.ratio.value = 12;
        bassComp.attack.value = 0.003;
        bassComp.release.value = 0.25;
        bassComp.connect(this.masterGain);
        this.layers.bass.compressor = bassComp;

        const padFilter = this.audioContext.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.value = 1200;
        padFilter.Q.value = 0.5;

        const padDelay = this.audioContext.createDelay(2.0);
        padDelay.delayTime.value = 0.4;
        const delayGain = this.audioContext.createGain();
        delayGain.gain.value = 0.3;

        padFilter.connect(padDelay);
        padDelay.connect(delayGain);
        delayGain.connect(padFilter);
        padFilter.connect(this.masterGain);

        this.layers.pad.filter = padFilter;
        this.layers.pad.reverb = { delay: padDelay, gain: delayGain };
    }

    playNextChord() {
        if (!this.isPlaying) return;

        const nextChord = this.chooseNextChord();
        this.currentChordName = nextChord;
        this.currentTension = this.chordLibrary[nextChord].tension;

        if (Math.random() < 0.08)
            this.currentKey = (this.currentKey + [2, 5, 7][Math.floor(Math.random() * 3)]) % 12;

        this.transitionToChord(nextChord);

        const nextDelay = 12000 + Math.random() * 10000;
        this.nextChordTimeout = setTimeout(() => this.playNextChord(), nextDelay);
    }

    chooseNextChord() {
        const compatible = this.chordCompatibility[this.currentChordName] || Object.keys(this.chordLibrary);

        const weighted = compatible.map(name => {
            const tension = this.chordLibrary[name].tension;
            const weight = tension < 0.2 ? 2.0 : 1.0;
            return { name, weight };
        });

        const total = weighted.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * total;

        for (const item of weighted) {
            random -= item.weight;
            if (random <= 0)
                return item.name;
        }

        return compatible[0];
    }

    transitionToChord(chordName) {
        const chord = this.chordLibrary[chordName];
        if (!chord) return;

        const fadeDuration = 6.0 + Math.random() * 3.0;
        ['bass', 'pad'].forEach(layerName => {
            this.createLayer(layerName, chord[layerName], fadeDuration);
        });
    }

    createLayer(layerName, noteOffsets, fadeDuration) {
        if (!noteOffsets || noteOffsets.length === 0) return;

        const now = this.audioContext.currentTime;
        const layer = this.layers[layerName];
        if (layer.gains && layer.gains.length > 0) {
            const oldOscillators = [...layer.oscillators];
            const oldGains = [...layer.gains];

            oldGains.forEach(gain => {
                try {
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(gain.gain.value, now);
                    gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
                } catch (e) { }
            });

            setTimeout(() => {
                oldOscillators.forEach(osc => {
                    try { osc.stop(); osc.disconnect(); } catch (e) { }
                });
                oldGains.forEach(gain => {
                    try { gain.disconnect(); } catch (e) { }
                });
            }, fadeDuration * 1000 + 100);
        }

        const newOscillators = [ ];
        const newGains = [ ];

        noteOffsets.forEach((offset, index) => {
            const frequency = this.baseFrequency * Math.pow(2, (this.currentKey + offset) / 12);

            const osc = this.audioContext.createOscillator();
            osc.type = layerName === 'bass' ? 'sine' : 'triangle';
            osc.frequency.value = frequency;
            osc.detune.value = (Math.random() - 0.5) * 6;

            const gain = this.audioContext.createGain();
            gain.gain.value = 0;

            osc.connect(gain);
            if (layerName === 'bass' && layer.compressor)
                gain.connect(layer.compressor);
            else if (layer.filter)
                gain.connect(layer.filter);

            osc.start(now);

            newOscillators.push(osc);
            newGains.push(gain);

            const volume = layerName === 'bass' ? 0.15 : (0.08 - index * 0.01);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + fadeDuration);
        });

        layer.oscillators = newOscillators;
        layer.gains = newGains;
    }

    stop() {
        this.isPlaying = false;
        if (this.nextChordTimeout)
            clearTimeout(this.nextChordTimeout);

        const now = this.audioContext.currentTime;
        const fadeDuration = 0.5;

        Object.values(this.layers).forEach(layer => {
            if (layer.gains) {
                layer.gains.forEach(gain => {
                    try {
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
                    } catch (e) { }
                });
            }

            if (layer.oscillators) {
                setTimeout(() => {
                    layer.oscillators.forEach(osc => {
                        try {
                            osc.stop();
                            osc.disconnect();
                        } catch (e) { }
                    });
                    layer.oscillators = [ ];
                    if (layer.gains) {
                        layer.gains.forEach(gain => {
                            try { gain.disconnect(); } catch (e) { }
                        });
                        layer.gains = [ ];
                    }
                }, fadeDuration * 1000 + 50);
            }
        });

        if (this.masterGain) {
            try {
                this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
                this.masterGain.gain.linearRampToValueAtTime(0, now + fadeDuration);
            } catch (e) { }
        }
    }

    setMasterVolume(volume) {
        if (this.masterGain)
            this.masterGain.gain.value = volume;
    }
}

export class Zengine {
    constructor() {
        this.audioContext = null;
        this.sounds = [ ];
        this.activeSounds = new Map();
        this.masterGainNode = null;
        this.isRunning = false;
        this.currentEnvironment = null;
        this.eventLoopInterval = null;
        this.activityLevel = 4;
        this.musicEngine = null;
    }

    async init() {
        this.musicEngine = new MusicEngine();
        this.musicEngine.init();

        const response = await fetch('https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/bbc-sounds.json');
        const rawSounds = await response.json();
        this.sounds = this.categorizeSounds(rawSounds);

        return this.sounds.length;
    }


    categorizeSounds(rawSounds) {
        return rawSounds.map(sound => {
            const tags = (sound.tags || [ ]).map(t => t.toLowerCase());
            const description = (sound.description || '').toLowerCase();
            const duration = parseFloat(sound.technicalMetadata?.duration || sound.duration) || 0;

            const category = this.detectCategory(tags, description);
            const role = duration > 60 ? 'ambient' : (duration > 15 ? 'feature' : 'event');

            return {
                id: sound.id,
                duration,
                description: sound.description,
                category,
                role
            };
        });
    }

    detectCategory(tags, description) {
        const text = [...tags, description].join(' ');
        if (/rain|drizzle/i.test(text)) return 'rain';
        if (/ocean|sea|wave/i.test(text)) return 'ocean';
        if (/stream|river|water/i.test(text)) return 'water-flow';
        if (/wind|breeze/i.test(text)) return 'wind';
        if (/bird/i.test(text)) return 'bird';
        if (/cricket|insect/i.test(text)) return 'insect';
        return 'other';
    }

    generateEnvironment() {
        const environments = [
            {
                name: 'Gentle Rain',
                requiredAmbient: ['rain'],
                commonCategories: ['bird'],
                weather: 'rain'
            },
            {
                name: 'Ocean Shore',
                requiredAmbient: ['ocean'],
                commonCategories: ['bird', 'wind'],
                weather: 'clear'
            },
            {
                name: 'Forest Stream',
                requiredAmbient: ['water-flow'],
                commonCategories: ['bird', 'insect'],
                weather: 'clear'
            }
        ];
        return environments[Math.floor(Math.random() * environments.length)];
    }

    getEnvironmentSounds(environment) {
        const allAmbient = [
            ...this.sounds.filter(s => s.role === 'ambient' && environment.requiredAmbient.includes(s.category)),
        ];

        const allEvents = this.sounds.filter(s =>
            s.role === 'event' && environment.commonCategories.includes(s.category)
        );

        return { ambient: allAmbient, events: allEvents };
    }

    async start() {
        if (this.isRunning) return;

        if (this.sounds.length === 0)
            await this.init();

        if (!this.musicEngine.isPlaying)
            await this.musicEngine.start();

        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = 0.3; // Quieter to let music shine
        }

        if (this.audioContext.state === 'suspended')
            await this.audioContext.resume();

        this.isRunning = true;
        this.currentEnvironment = this.generateEnvironment();

        await this.startAmbientLayers();
        this.startEventLoop();
    }

    async startAmbientLayers() {
        const envSounds = this.getEnvironmentSounds(this.currentEnvironment);

        const numAmbient = Math.min(envSounds.ambient.length, 2);
        for (let i = 0; i < numAmbient; i++) {
            const sound = envSounds.ambient[Math.floor(Math.random() * envSounds.ambient.length)];
            if (!this.activeSounds.has(sound.id))
                await this.playSound(sound, 'ambient', 0.35 + Math.random() * 0.1);
        }
    }

    startEventLoop() {
        this.eventLoopInterval = setInterval(() => {
            this.processEvents();
        }, 3000);
    }

    async processEvents() {
        if (!this.isRunning) return;

        const envSounds = this.getEnvironmentSounds(this.currentEnvironment);
        const activeEvents = Array.from(this.activeSounds.values())
            .filter(s => s.role !== 'ambient').length;

        if (activeEvents < this.activityLevel && envSounds.events.length > 0 && Math.random() < 0.5) {
            const sound = envSounds.events[Math.floor(Math.random() * envSounds.events.length)];
            await this.playSound(sound, 'event', 0.12 + Math.random() * 0.08);
        }
    }

    async playSound(sound, role, volume) {
        if (this.activeSounds.has(sound.id)) return;

        try {
            const url = sound.url || `https://sound-effects-media.bbcrewind.co.uk/mp3/${sound.id}.mp3`;
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.src = url;
            audio.preload = 'auto';

            const source = this.audioContext.createMediaElementSource(audio);
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;

            source.connect(gainNode);
            gainNode.connect(this.masterGainNode);

            this.activeSounds.set(sound.id, { sound, audio, source, gainNode, role, volume });

            audio.addEventListener('ended', () => {
                this.removeSound(sound.id);
                if (role === 'ambient' && this.isRunning)
                    setTimeout(() => this.playSound(sound, role, volume), 1000);
            });

            audio.addEventListener('error', () => this.removeSound(sound.id));
            await audio.play();
        } catch (error) {
            console.error('Sound error:', sound.id);
        }
    }

    removeSound(soundId) {
        const instance = this.activeSounds.get(soundId);
        if (instance) {
            try {
                instance.audio.pause();
                instance.gainNode.disconnect();
                instance.source.disconnect();
            } catch (e) { }
            this.activeSounds.delete(soundId);
        }
    }

    stop() {
        if (this.musicEngine.isPlaying)
            this.musicEngine.stop();

        this.isRunning = false;
        if (this.eventLoopInterval) {
            clearInterval(this.eventLoopInterval);
            this.eventLoopInterval = null;
        }

        this.activeSounds.forEach((instance, id) => {
            try {
                instance.audio.pause();
                instance.audio.currentTime = 0;
            } catch (e) { }

            const now = this.audioContext.currentTime;
            instance.gainNode.gain.cancelScheduledValues(now);
            instance.gainNode.gain.setValueAtTime(instance.gainNode.gain.value, now);
            instance.gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
            setTimeout(() => this.removeSound(id), 500);
        });

        if (this.audioContext && this.audioContext.state === 'running')
            this.audioContext.suspend();
    }

    setMasterVolume(volume) {
        if (this.masterGainNode)
            this.masterGainNode.gain.value = volume;
        this.musicEngine.setMasterVolume(volume * 0.25);
    }
}