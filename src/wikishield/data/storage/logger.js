export class Logger {
    constructor() {
        this.logs = [];
    }

    getLogs() {
        return [ ...this.logs ];
    }

    #log(type, message, expected = false) {
        const timestamp = new Date().toISOString();
        this.logs.push({ type, timestamp, message, expected });
    }

    log(message, expected) {
        this.#log("log", message, expected);
    }

    warn(message, expected) {
        this.#log("warn", message, expected);
    }
    error(message, expected) {
        this.#log("error", message, expected);
    }
    dev(message, expected) {
        this.#log("dev", message, expected);
    }
}