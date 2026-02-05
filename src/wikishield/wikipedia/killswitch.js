export class Killswitch {
    static #page = "User:LuniZunie/killswitch.js";

    static #soft = 11;
    static #hard = 1;

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
        try {
            const content = (await this.#api.getPagesContent([ Killswitch.#page ], true, "en.wikipedia.org"))?.[Killswitch.#page] ?? "";
            const data = JSON.parse(content)?.WikiShield;
            if (!data)
                throw new Error("No killswitch found");

            if (data.disabled)
                return this.#emit("kill");

            const soft = data.reload?.soft ?? 0;
            const hard = data.reload?.hard ?? 0;

            if (hard > Killswitch.#hard)
                return this.#emit("force-update");
            else if (soft > Killswitch.#soft) {
                Killswitch.#soft = soft;
                return this.#emit("update");
            }

            return this.#emit("okay");
        } catch (error) {
            return this.#emit("unsafe");
        }
    }

    monitor(interval = 10 * 1000) {
        if (this.#interval)
            clearInterval(this.#interval);
        this.#interval = setInterval(() => this.check(), +interval);
        return this;
    }
}