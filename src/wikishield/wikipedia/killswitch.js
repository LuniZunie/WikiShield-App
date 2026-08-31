import { fullTrim } from "../../../global/full-trim/script.esm.js";
import { generateRandomUUID } from "../../../global/UUID/script.esm.js";

import { WebWorker } from "../utilities/web-worker.js";

class Killswitch {
    static #page = "User:LuniZunie/JSON/Killswitch.json";

    static #soft = 11;
    static #hard = 1;

    #worker = null;

    #api = null;
    #interval = null;

    #events = {
        okay: [ ],
        unsafe: [ ],

        update: [ ],
        "force-update": [ ],

        kill: [ ],
    };

    constructor(ws) {
        this.#api = ws.api;

        this.#worker = new WebWorker(fullTrim(`
            self.onmessage = async event => {
                const { UUID, staticSoft, staticHard, args } = event.data;

                try {
                    const response = await fetch(...args)
                        .then(response => response.json())
                        .then(data => data.query?.pages || { })
                        .catch((err) => { return console.error(err) || { }; });

                    const content = Object.values(response)?.[0]?.revisions?.[0]?.slots?.main?.content || "";
                    const data = JSON.parse(content)?.WikiShield;
                    if (!data)
                        throw new Error("No killswitch found");
                    else if (data.disabled)
                        return self.postMessage({ UUID, event: "kill" });

                    const soft = data.reload?.soft ?? 0;
                    const hard = data.reload?.hard ?? 0;

                    if (hard > staticHard)
                        return self.postMessage({ UUID, event: "force-update" });
                    else if (soft > staticSoft)
                        return self.postMessage({ UUID, event: "update", soft });

                    return self.postMessage({ UUID, event: "okay" });
                } catch {
                    self.postMessage({ UUID, event: "unsafe" });
                }
            };
        `));
    }

    on(event, callback, options = { }) {
        if (this.#events[event])
            this.#events[event].push({ callback, options });

        return this;
    }

    #emit(event) {
        if (this.#events[event])
            for (const listener of this.#events[event])
                try {
                    listener.callback();
                } catch { } finally {
                    if (listener.options?.once === true)
                        this.#events[event] = this.#events[event].filter(l => l !== listener);
                }

        return this;
    }

    async check() {
        const UUID = generateRandomUUID();

        return new Promise(async (resolve, reject) => {
            this.#worker.onmessage = event => {
                const { UUID: returnedUUID, event: eventName, soft } = event.data;
                if (returnedUUID !== UUID)
                    return; // was not meant for us

                if (eventName === "update")
                    Killswitch.#soft = soft;

                this.#emit(eventName);
                resolve();
            };

            this.#worker.onerror = error => {
                console.error("[WikiShield] Killswitch worker error:", error);

                this.#emit("unsafe");
                reject(error);
            };

            this.#worker.postMessage({
                UUID,
                staticSoft: Killswitch.#soft,
                staticHard: Killswitch.#hard,
                args: await this.#api.get({
                    action: "query",
                    prop: "revisions",
                    rvprop: "content",
                    rvslots: "*",
                    titles: Killswitch.#page
                }, false, "en.wikipedia.org")
            });
        });
    }

    monitor(interval = 10 * 1000) {
        if (this.#interval)
            clearInterval(this.#interval);
        this.#interval = setInterval(() => this.check(), +interval);
        return this;
    }
}

export { Killswitch };