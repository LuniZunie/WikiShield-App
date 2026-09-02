class WebWorker {
    static isSupported() {
        return window.Worker !== undefined;
    }

    constructor(code, options = { }) {
        if (WebWorker.isSupported()) {
            const url = URL.createObjectURL(new Blob([ code ], { type: "text/javascript" }));
            const worker = new Worker(url, options);
            URL.revokeObjectURL(url);

            return worker;
        } else {
            let terminated = false;

            const mainListeners = {
                onmessage: null,
                message: new Set(),

                onerror: null,
                error: new Set(),

                onmessageerror: null,
                messageerror: new Set(),
            };
            const workerListeners = {
                onmessage: null,
                message: new Set(),
            };

            const workerScope = {
                addEventListener: (event, callback) => {
                    switch (event) {
                        case "message": {
                            workerListeners.message.add(callback);
                        } break;
                    }
                },
                removeEventListener: (event, callback) => {
                    switch (event) {
                        case "message": {
                            workerListeners.message.delete(callback);
                        } break;
                    }
                },

                get onmessage() { return workerListeners.onmessage; },
                set onmessage(fn) { workerListeners.onmessage = fn; },

                postMessage: data => {
                    if (terminated) return;

                    setTimeout(() => {
                        if (terminated) return;

                        try {
                            data = structuredClone(data);

                            if (mainListeners.onmessage)
                                mainListeners.onmessage({ data });
                            for (const listener of mainListeners.message)
                                listener({ data });
                        } catch (error) {
                            if (mainListeners.onerror)
                                mainListeners.onerror(error);
                            for (const listener of mainListeners.error)
                                listener(error);
                        }
                    }, 0);
                }
            };

            const func = new Function("self", code.split("\n").map(ln => `\t${ln}`.trimEnd()).join("\n")).bind(workerScope);
            try {
                func(workerScope);
            } catch (error) {
                if (mainListeners.onerror)
                    mainListeners.onerror(error);
                for (const listener of mainListeners.error)
                    listener(error);
            }

            return {
                addEventListener: (event, callback) => {
                    switch (event) {
                        case "message": {
                            mainListeners.message.add(callback);
                        } break;
                        case "error": {
                            mainListeners.error.add(callback);
                        } break;
                        case "messageerror": {
                            mainListeners.messageerror.add(callback);
                        } break;
                    }
                },
                removeEventListener: (event, callback) => {
                    switch (event) {
                        case "message": {
                            mainListeners.message.delete(callback);
                        } break;
                        case "error": {
                            mainListeners.error.delete(callback);
                        } break;
                        case "messageerror": {
                            mainListeners.messageerror.delete(callback);
                        } break;
                    }
                },

                get onmessage() { return mainListeners.onmessage; },
                set onmessage(fn) { mainListeners.onmessage = fn; },

                get onerror() { return mainListeners.onerror; },
                set onerror(fn) { mainListeners.onerror = fn; },

                get onmessageerror() { return mainListeners.onmessageerror; },
                set onmessageerror(fn) { mainListeners.onmessageerror = fn; },

                postMessage: data => {
                    if (terminated) return;

                    setTimeout(() => {
                        if (terminated) return;

                        try {
                            data = structuredClone(data);

                            try {
                                if (workerListeners.onmessage)
                                    workerListeners.onmessage({ data });
                                for (const listener of workerListeners.message)
                                    listener({ data });
                            } catch (error) {
                                if (mainListeners.onerror)
                                    mainListeners.onerror(error);
                                for (const listener of mainListeners.error)
                                    listener(error);
                            }
                        } catch (error) {
                            if (mainListeners.onmessageerror)
                                mainListeners.onmessageerror(error);
                            for (const listener of mainListeners.messageerror)
                                listener(error);
                        }
                    }, 0);
                },

                terminate: () => {
                    terminated = true;

                    workerListeners.onmessage = null;
                    workerListeners.message.clear();

                    mainListeners.onmessage = null;
                    mainListeners.message.clear();

                    mainListeners.onerror = null;
                    mainListeners.error.clear();

                    mainListeners.onmessageerror = null;
                    mainListeners.messageerror.clear();
                }
            };
        }
    }
}

export { WebWorker };