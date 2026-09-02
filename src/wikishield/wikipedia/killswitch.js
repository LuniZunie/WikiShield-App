import { fullTrim } from "../../../global/full-trim/script.esm.js";
import { generateRandomUUID } from "../../../global/UUID/script.esm.js";

class Killswitch {
    static #page = "User:LuniZunie/JSON/Killswitch.json";

    static #soft = 11;
    static #hard = 1;

    #thread = null;

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

        this.#thread = ws.multithreads["background-checks"];
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

    async monitor(interval = 10000) {
        const getPostBody = async () => {
            return {
                command: "killswitch",
                data: {
                    interval,
                    expected: {
                        soft: Killswitch.#soft,
                        hard: Killswitch.#hard
                    },
                    fetchKillswitch: await this.#api.get({
                        action: "query",
                        prop: "revisions",
                        rvprop: "content",
                        rvslots: "*",
                        titles: Killswitch.#page
                    }, false, "en.wikipedia.org"),
                    retries: 0
                }
            };
        };

        this.#thread.onmessage = async event => {
            const { command, data } = event.data.body;
            switch (command) {
                case "killswitch": {
                    const { event: eventName, soft } = data;
                    if (eventName === "update")
                        Killswitch.#soft = soft;
                    this.#emit(eventName);
                } break;
                case "killswitch-resync": {
                    const { retries } = data;
                    try {
                        const body = await getPostBody();
                        body.data.retries = retries;
                        this.#thread.post(body);
                    } catch (error) {
                        console.error("[WikiShield] Killswitch worker resync error:", error);
                        this.#emit("unsafe");
                    }
                } break;
            }
        };
        this.#thread.onerror = error => {
            console.error("[WikiShield] Killswitch worker error:", error);
            this.#emit("unsafe");
        };
        this.#thread.onmessageerror = error => {
            console.error("[WikiShield] Killswitch worker message error:", error);
            this.#emit("unsafe");
        };

        this.#thread.post(await getPostBody());
    }
}

export { Killswitch };