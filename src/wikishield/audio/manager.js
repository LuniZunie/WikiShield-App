import { generateRandomUUID } from '../../../global/UUID/script.esm.js';
import { Zengine } from './zengine.js';

const audio = {
    startup: {
        type: "sound",
        title: "Startup Sound",
        description: "Sound played when WikiShield starts up.",
        volume: 1,
        data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/startup.wav",
    },
    music: {
        type: "category",
        title: "Music",
        description: "Background music tracks.",
        volume: 1,
        properties: {
            zen_mode: {
                type: "sound",
                title: "Zen Mode",
                description: "Background audio played in Zen mode.",
                volume: 1,
                data: "custom://zen_mode",
                preview: false
            }
        }
    },
    ui: {
        type: "category",
        title: "User Interface Sounds",
        description: "Sounds used for user interface interactions.",
        volume: 1,
        properties: {
            click: {
                type: "sound",
                title: "Click Sound",
                description: "Sound played when clicking on interface elements.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/click.wav"
            },
        }
    },
    queue: {
        type: "category",
        title: "Queue Sounds",
        description: "Sounds played for queue events.",
        volume: 1,
        properties: {
            ores: {
                type: "sound",
                title: "ORES Alert",
                description: "Sound played due to a high ORES score.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/ores.wav"
            },
            mention: {
                type: "sound",
                title: "Mention Alert",
                description: "Sound played when your username is mentioned in an edit.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/mention.wav"
            },
        }
    },
    notification: {
        type: "category",
        title: "Notification Sounds",
        description: "Sounds played for various notifications.",
        volume: 1,
        properties: {
            alert: {
                type: "sound",
                title: "Alert Sound",
                description: "Sound played for alerts.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/alert.wav"
            },
            message: {
                type: "sound",
                title: "Message Sound",
                description: "Sound played for messages.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/message.wav"
            },
            toast: {
                type: "sound",
                title: "Toast Sound",
                description: "Sound played for toast notifications.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/toast.wav"
            },
        },
    },
    action: {
        type: "category",
        title: "Action Sounds",
        description: "Sounds played for various user actions.",
        volume: 1,
        properties: {
            default: {
                type: "sound",
                title: "Default Action Sound",
                description: "Sound played for default actions.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/action.wav"
            },
            failed: {
                type: "sound",
                title: "Failed Action Sound",
                description: "Sound played when an action fails.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/failed.wav"
            },
            report: {
                type: "sound",
                title: "Report Action Sound",
                description: "Sound played for report actions.",
                volume: 1,
                data: "https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/audio/report.wav"
            }
        }
    },
};

export class AudioManager {
    constructor(ws) {
        this.ws = ws;
        this.audio = audio;

        this.soundEffects = new Map();
        this.previews = new Map();

        this.previewing = false;
    }

    async init() {
        this.zengine = new Zengine();
        await this.zengine.init();
        this.zengine.setMasterVolume(this.ws.store.settings.audio.volume["master.music.zen_mode"]);
    }

    async playSound(soundPath, signal, preview = false, callback) {
        if (!preview) {
            const zenMode = this.ws.store.settings.zen_mode;
            if (zenMode.enabled && !zenMode.sound.enabled)
                return;
        }

        const sound = this.getSound(soundPath);
        if (!sound || !sound.data) return;

        const volume = this.getVolume(soundPath);
        const audio = new Audio(sound.data);
        audio.volume = !preview && this.previewing ? 0 : volume;

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                return;
            });
        }

        const muteId = generateRandomUUID();
        if (preview) {
            this.muteId = muteId;
            this.previewing = true;

            this.stopPreviews();
            this._muteAll();

            this.previews.set(audio, soundPath);
        }

        this.soundEffects.set(audio, soundPath);

        const promise = new Promise((resolve, reject) => {
            audio.resolve = resolve;
            audio.reject = reject;
        });

        audio.onended = () => {
            audio.resolve();
            this.soundEffects.delete(audio);

            if (preview) {
                this.previewing = false;

                setTimeout(() => {
                    if (this.muteId === muteId)
                        this._unmuteAll();
                }, 250);

                this.previews.delete(audio);
            }
        };

        audio.onerror = () => {
            audio.resolve();
            this.soundEffects.delete(audio);

            if (preview) {
                this.previewing = false;

                setTimeout(() => {
                    if (this.muteId === muteId)
                        this._unmuteAll();
                }, 250);

                this.previews.delete(audio);
            }
        };

        let played = false;
        audio.onplay = () => {
            if (played) return;
            played = true;

            if (callback)
                callback();
        };

        signal?.addEventListener('abort', () => {
            audio.pause();
            audio.src = "";
            audio.resolve();
            this.soundEffects.delete(audio);

            if (preview) {
                this.previewing = false;

                setTimeout(() => {
                    if (this.muteId === muteId) {
                        this._unmuteAll();
                    }
                }, 250);

                this.previews.delete(audio);
            }
        });

        audio.play();

        return promise;
    }

    async previewSound(soundPath) {
        const sound = this.getSound(soundPath);
        if (!sound || !sound.data) return;

        this._muteAll();

        const audio = new Audio(sound.data);
        audio.volume = this.getVolume(soundPath);
        this.previews.set(audio, soundPath);

        const cleanup = () => {
            this.previews.delete(audio);
            if (this.previews.size === 0)
                this._unmuteAll();
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        await audio.play();
    }

    stopPreviews() {
        for (const audio of this.previews.keys()) {
            audio.resolve();
            audio.pause();
            audio.onended = null;
            audio.onerror = null;
            audio.src = "";
        }
        this.previews.clear();
        this._unmuteAll();
    }

    onvolumechanged() {
        this.zengine.setMasterVolume(this.ws.store.settings.audio.volume["master.music.zen_mode"]);

        if (this.previewing)
            for (const [audio, soundPath] of this.previews.entries()) {
                const newVolume = this.getVolume(soundPath);
                audio.volume = newVolume;
            }
        else
            for (const [audio, soundPath] of this.soundEffects.entries()) {
                const newVolume = this.getVolume(soundPath);
                audio.volume = newVolume;
            }
    }

    _muteAll() {
        for (const audio of this.soundEffects.keys())
            audio.volume = 0;
    }

    _unmuteAll() {
        for (const [audio, soundPath] of this.soundEffects.entries())
            audio.volume = this.getVolume(soundPath);
    }

    getSound(path) {
        let current = { type: "category", properties: this.audio };

        for (const segment of path) {
            if (current.type === "category")
                current = current.properties[segment];
            else
                return null;

            if (!current) return null;
        }

        return current;
    }

    getVolume(path) {
        const volumes = this.ws.store.settings.audio.volume;

        let volume = volumes.master;
        let current = { type: "category", properties: this.audio };
        const pathParts = [ "master" ];
        for (const segment of path) {
            pathParts.push(segment);

            if (current.type === "category")
                current = current.properties[segment];
            else
                return volume;

            if (!current) break;

            const specificVolume = volumes[pathParts.join(".")];
            if (specificVolume !== undefined)
                volume *= specificVolume;
        }

        return volume;
    }
}