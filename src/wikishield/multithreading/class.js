import { fullTrim } from "../../../global/full-trim/script.esm.js";
import { generateRandomUUID } from "../../../global/UUID/script.esm.js";

class PseudoWorker {
    static #MainListeners = {
        onmessage: null,
        message: new Set(),

        onerror: null,
        error: new Set(),

        onmessageerror: null,
        messageerror: new Set(),
    };
    static #WorkerListeners = {
        onmessage: null,
        message: new Set(),
    };

    #code;
    #options;

    #terminated = false;

    #mainListeners = Object.assign({ }, PseudoWorker.#MainListeners);
    #workerListeners = Object.assign({ }, PseudoWorker.#WorkerListeners);

    constructor(code, options = { }) {
        const parsedCode = code.split("\n").map(ln => `\t${ln}`.trimEnd()).join("\n");

        this.#code = parsedCode;
        this.#options = options;

        const self = this;
        const scope = {
            addEventListener: (event, callback) => {
                switch (event) {
                    case "message": {
                        this.#workerListeners.message.add(callback);
                    } break;
                }
            },
            removeEventListener: (event, callback) => {
                switch (event) {
                    case "message": {
                        this.#workerListeners.message.delete(callback);
                    } break;
                }
            },

            get onmessage() { return self.#workerListeners.onmessage; },
            set onmessage(fn) { self.#workerListeners.onmessage = fn; },

            postMessage: data => {
                if (this.#terminated)
                    return;

                setTimeout(() => {
                    if (this.#terminated)
                        return;

                    try {
                        data = structuredClone(data);

                        if (this.#mainListeners.onmessage)
                            this.#mainListeners.onmessage({ data });
                        for (const listener of this.#mainListeners.message)
                            listener({ data });
                    } catch (error) {
                        if (this.#mainListeners.onerror)
                            this.#mainListeners.onerror(error);
                        for (const listener of this.#mainListeners.error)
                            listener(error);
                    }
                }, 0);
            }
        };

        try {
            const workerFunction = new Function("self", parsedCode);
            try {
                workerFunction.call(scope, scope);
            } catch (error) {
                if (this.#mainListeners.onerror)
                    this.#mainListeners.onerror(error);
                for (const listener of this.#mainListeners.error)
                    listener(error);
            }
        } catch (error) {
            console.error("[WikiShield] Failed to initialize pseudo-worker:", error);
            throw error;
        }
    }

    addEventListener(event, callback) {
        switch (event) {
            case "message": {
                this.#mainListeners.message.add(callback);
            } break;
            case "error": {
                this.#mainListeners.error.add(callback);
            } break;
            case "messageerror": {
                this.#mainListeners.messageerror.add(callback);
            } break;
        }
    }
    removeEventListener(event, callback) {
        switch (event) {
            case "message": {
                this.#mainListeners.message.delete(callback);
            } break;
            case "error": {
                this.#mainListeners.error.delete(callback);
            } break;
            case "messageerror": {
                this.#mainListeners.messageerror.delete(callback);
            } break;
        }
    }

    get onmessage() { return this.#mainListeners.onmessage; }
    set onmessage(fn) { this.#mainListeners.onmessage = fn; }

    get onerror() { return this.#mainListeners.onerror; }
    set onerror(fn) { this.#mainListeners.onerror = fn; }

    get onmessageerror() { return this.#mainListeners.onmessageerror; }
    set onmessageerror(fn) { this.#mainListeners.onmessageerror = fn; }

    postMessage(data) {
        if (this.#terminated)
            return;

        setTimeout(() => {
            if (this.#terminated)
                return;

            try {
                data = structuredClone(data);

                try {
                    if (this.#workerListeners.onmessage)
                        this.#workerListeners.onmessage({ data });
                    for (const listener of this.#workerListeners.message)
                        listener({ data });
                } catch (error) {
                    if (this.#mainListeners.onerror)
                        this.#mainListeners.onerror(error);
                    for (const listener of this.#mainListeners.error)
                        listener(error);
                }
            } catch (error) {
                if (this.#mainListeners.onmessageerror)
                    this.#mainListeners.onmessageerror(error);
                for (const listener of this.#mainListeners.messageerror)
                    listener(error);
            }
        }, 0);
    }

    terminate() {
        this.#terminated = true;

        this.#mainListeners = Object.assign({ }, PseudoWorker.#MainListeners);
        this.#workerListeners = Object.assign({ }, PseudoWorker.#WorkerListeners);
    }
}

class Multithread {
    static LOADED_FILES = { };

    static isSupported() {
        return window.Worker !== undefined;
    }

    #worker;

    constructor(code, options = { }) {
        const parsedCode = fullTrim(code);
        if (Multithread.isSupported()) {
            const url = URL.createObjectURL(new Blob([ parsedCode ], { type: "text/javascript" }));
            this.#worker = new Worker(url, options);
            URL.revokeObjectURL(url);
        } else
            this.#worker = new PseudoWorker(parsedCode, options);
    }

    addEventListener() { this.#worker.addEventListener(...arguments); }
    removeEventListener() { this.#worker.removeEventListener(...arguments); }

    get onmessage() { return this.#worker.onmessage; }
    set onmessage(fn) { this.#worker.onmessage = fn; }

    get onerror() { return this.#worker.onerror; }
    set onerror(fn) { this.#worker.onerror = fn; }

    get onmessageerror() { return this.#worker.onmessageerror; }
    set onmessageerror(fn) { this.#worker.onmessageerror = fn; }

    get(body) {
        if (this.#worker) {
            const UUID = generateRandomUUID();
            this.#worker.postMessage({ type: "get", body, UUID });

            let resolve, reject;
            const successListener = event => {
                const data = event.data;
                if (data.UUID === UUID) {
                    this.#worker.removeEventListener("message", successListener);
                    this.#worker.removeEventListener("error", errorListener);
                    this.#worker.removeEventListener("messageerror", errorListener);
                    resolve(data.body);
                }
            };
            const errorListener = event => {
                const data = event.data;
                if (data.UUID === UUID) {
                    this.#worker.removeEventListener("message", successListener);
                    this.#worker.removeEventListener("error", errorListener);
                    this.#worker.removeEventListener("messageerror", errorListener);
                    reject(data.error);
                }
            };

            return new Promise((res, rej) => {
                resolve = res, reject = rej;

                this.#worker.addEventListener("message", successListener);
                this.#worker.addEventListener("error", errorListener);
                this.#worker.addEventListener("messageerror", errorListener);
            });
        } else
            throw new Error("Worker is not initialized.");
    }

    post(body) {
        if (this.#worker)
            this.#worker.postMessage({ type: "post", body });
        else
            throw new Error("Worker is not initialized.");
    }

    terminate() {
        if (this.#worker)
            this.#worker.terminate();
        this.#worker = null;
    }
}

export { Multithread };