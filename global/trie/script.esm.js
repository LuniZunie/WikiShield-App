/*
const Node = {
    UUID: <UUID>,

    defined: <boolean>,
    value: <any>,

    terminal: <boolean>,
    children: Map<any, Node>
};
*/

import { generateRandomUUID } from "../UUID/script.esm.js";

class Trie {
    #size;
    #timeout;

    #store;
    #order;
    #timeouts;

    constructor({ timeout, size } = { }) {
        if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 0))
            throw new RangeError("timeout must be a non-negative finite number");
        else if (size !== undefined && (!Number.isInteger(size) || size < 0))
            throw new RangeError("size must be a non-negative integer");

        this.#size = size;
        this.#timeout = timeout;

        this.#store = new Map();
        this.#order = new Map();
        this.#timeouts = new Map();
    }

    #clearTimeout(UUID) {
        const timer = this.#timeouts.get(UUID);
        if (timer !== undefined) {
            clearTimeout(timer);
            this.#timeouts.delete(UUID);
        }
    }

    #findNode(keys) {
        let scope = this.#store;
        for (const key of keys) {
            const node = scope.get(key);
            if (node === undefined)
                return undefined;

            scope = node.children;
        }

        return scope;
    }

    #findFinal(keys) {
        if (keys.length === 0)
            return undefined;

        const finalKey = keys[keys.length - 1];
        const scope = this.#findNode(keys.slice(0, -1));

        return scope?.get(finalKey);
    }

    #deleteByUUID(UUID) {
        const keys = this.#order.get(UUID);
        if (keys === undefined)
            return false;

        this.#clearTimeout(UUID);
        this.#order.delete(UUID);

        const scopes = [ this.#store ];
        let scope = this.#store;

        for (const key of keys) {
            const node = scope.get(key);
            if (node === undefined)
                return false;

            scopes.push(node);
            scope = node.children;
        }

        const final = scopes[scopes.length - 1];
        final.defined = false;
        delete final.UUID;
        delete final.value;

        if (final.children.size > 0)
            return true;

        for (let i = keys.length - 1; i >= 0; i--) {
            const parent = scopes[i];
            const key = keys[i];
            const node = parent.get(key);

            parent.delete(key);
            if (parent.size > 0)
                break;
        }

        return true;
    }

    clear() {
        for (const timeout of this.#timeouts.values())
            clearTimeout(timeout);

        this.#store.clear();
        this.#order.clear();
        this.#timeouts.clear();
    }

    has(...keys) {
        return this.#findFinal(keys)?.defined === true;
    }

    get(...keys) {
        const node = this.#findFinal(keys);

        return node?.defined === true ? node.value : undefined;
    }

    set(...args) {
        const value = args.pop();
        const keys = args;

        if (keys.length === 0)
            throw new TypeError("at least one key is required");

        const existing = this.#findFinal(keys);
        let UUID = existing?.UUID;
        if (UUID !== undefined) {
            this.#order.delete(UUID);
            this.#clearTimeout(UUID);
        } else
            UUID = generateRandomUUID();

        const finalKey = keys[keys.length - 1];
        let scope = this.#store;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            let node = scope.get(key);

            if (node === undefined) {
                node = {
                    defined: false,
                    children: new Map()
                };

                scope.set(key, node);
            }

            scope = node.children;
        }

        let final = scope.get(finalKey);
        if (final === undefined) {
            final = {
                defined: false,
                children: new Map()
            };

            scope.set(finalKey, final);
        }

        final.UUID = UUID;
        final.defined = true;
        final.value = value;

        this.#order.set(UUID, keys);

        if (this.#timeout !== undefined)
            this.#timeouts.set(UUID, setTimeout(() => {
                this.#deleteByUUID(UUID);
            }, this.#timeout));

        if (this.#size !== undefined && this.#order.size > this.#size)
            this.#deleteByUUID(this.#order.keys().next().value);

        return this;
    }

    add(...keys) {
        if (!this.has(...keys))
            this.set(...keys, true);

        return this;
    }

    delete(...keys) {
        const UUID = this.#findFinal(keys)?.UUID;
        if (UUID === undefined)
            return false;
        return this.#deleteByUUID(UUID);
    }

    get size() {
        return this.#size;
    }
    get timeout() {
        return this.#timeout;
    }

    get count() {
        return this.#order.size;
    }
}

export { Trie };