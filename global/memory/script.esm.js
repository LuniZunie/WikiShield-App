class Memory {
    #size;
    #timeout;

    #store;
    #timeouts;

    constructor({ timeout, size } = { }) {
        if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0))
            throw new RangeError("timeout must be a non-negative finite number");
        else if (size !== undefined && (!Number.isInteger(size) || size < 0))
            throw new RangeError("size must be a non-negative integer");

        this.#size = size;
        this.#timeout = timeout;

        this.#store = new Map();
        this.#timeouts = new Map();
    }

    #clearTimeout(key) {
        const timer = this.#timeouts.get(key);

        if (timer !== undefined) {
            clearTimeout(timer);
            this.#timeouts.delete(key);
        }
    }

    clear() {
        for (const timeout of this.#timeouts.values())
            clearTimeout(timeout);

        this.#store.clear();
        this.#timeouts.clear();
    }

    has(key) {
        return this.#store.has(key);
    }

    get(key) {
        return this.#store.get(key);
    }

    set(key, value) {
        const exists = this.#store.has(key);
        if (exists) {
            this.#store.delete(key);
            this.#clearTimeout(key);
        }

        this.#store.set(key, value);

        if (this.#timeout !== undefined)
            this.#timeouts.set(key, setTimeout(() => {
                this.delete(key);
            }, this.#timeout));

        if (this.#size !== undefined && this.#store.size > this.#size)
            this.delete(this.#store.keys().next().value);

        return this;
    }

    add(key) {
        if (!this.#store.has(key))
            this.set(key, true);

        return this;
    }

    delete(key) {
        if (!this.#store.has(key))
            return false;

        this.#store.delete(key);
        this.#clearTimeout(key);

        return true;
    }

    get size() {
        return this.#size;
    }
    get timeout() {
        return this.#timeout;
    }

    get count() {
        return this.#store.size;
    }

    keys() {
        return this.#store.keys();
    }

    values() {
        return this.#store.values();
    }

    entries() {
        return this.#store.entries();
    }

    [Symbol.iterator]() {
        return this.#store[Symbol.iterator]();
    }
}

export { Memory };