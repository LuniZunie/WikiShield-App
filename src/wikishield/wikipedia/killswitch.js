import { fullTrim } from "../../../global/full-trim/script.esm.js";
import { generateRandomUUID } from "../../../global/UUID/script.esm.js";

import { Multithread } from "../multithreading/class.js";

class Killswitch {
    static #page = "User:LuniZunie/JSON/Killswitch.json";

    static #soft = 11;
    static #hard = 1;

    #worker = null;

    #api = null;

    #events = {
        okay: [ ],
        unsafe: [ ],

        update: [ ],
        "force-update": [ ],

        kill: [ ],
    };

    constructor(ws) {
        this.#api = ws.api;

        this.#worker = new Multithread(Multithread.LOADED_FILES["background-checks"]);
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

    async monitor(interval = 10 * 1000) {
        this.#worker.onmessage = event => {
            const { command, data } = event.data.body;
            if (command !== "killswitch")
                return;

            const { event: eventName, soft } = data;
            if (eventName === "update")
                Killswitch.#soft = soft;
            this.#emit(eventName);
        };
        this.#worker.onerror = error => {
            console.error("[WikiShield] Killswitch worker error:", error);
            this.#emit("unsafe");
        };
        this.#worker.onmessageerror = error => {
            console.error("[WikiShield] Killswitch worker message error:", error);
            this.#emit("unsafe");
        };

        this.#worker.post({
            command: "killswitch",
            data: {
                interval,
                expected: {
                    soft: Killswitch.#soft,
                    hard: Killswitch.#hard
                },
                fetchArgs: await this.#api.get({
                    action: "query",
                    prop: "revisions",
                    rvprop: "content",
                    rvslots: "*",
                    titles: Killswitch.#page
                }, false, "en.wikipedia.org")
            }
        });
    }
}

export { Killswitch };