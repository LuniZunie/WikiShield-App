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
	constructor(options = { }) {
		this.order = { };
		this.store = new Map();
		this.timeouts = new Map();

		if ("timeout" in options)
			this.timeout = options.timeout;
		if ("size" in options)
			this.maxSize = options.size;
	}

	clear() {
		this.order = { };
		this.store.clear();
		this.timeouts.clear();
	}

	has(...keys) {
        const lastKey = keys.pop();
        let scope = this.store;
		for (const key of keys) {
            if (!scope.has(key))
                return false;

            const temp = scope.get(key);
            if (temp.terminal)
                return false;

            scope = temp.children;
        }

        return scope.get(lastKey)?.defined === true;
	}

	get(...keys) {
        const lastKey = keys.pop();
        let scope = this.store;
		for (const key of keys) {
            if (!scope.has(key))
                return undefined;

            const temp = scope.get(key);
            if (temp.terminal)
                return undefined;

            scope = temp.children;
        }

        return scope.get(lastKey)?.value;
	}

	set(...keys) {
        const value = keys.pop();

		let UUID = ((...keys) => {
            const lastKey = keys.pop();
            let scope = this.store;
            for (const key of keys) {
                if (!scope.has(key))
                    return undefined;

                const temp = scope.get(key);
                if (temp.terminal)
                    return undefined;

                scope = temp.children;
            }

            return scope.get(lastKey)?.UUID;
        })(...keys);

        delete this.order[UUID];

        if (UUID === undefined)
            UUID = generateRandomUUID();

        const finalKey = keys.pop();
        let scope = this.store;
        for (const key of keys) {
            if (scope.has(key)) {
                const temp = scope.get(key);
                temp.terminal = false;
                temp.children ??= new Map();

                scope = temp.children;
            } else {
                const temp = {
                    defined: false,

                    terminal: false,
                    children: new Map()
                };

                scope.set(key, temp);
                scope = temp.children;
            }
        }

		const final = scope.get(finalKey) ?? { terminal: true };
        final.UUID = UUID;
        final.defined = true;
        final.value = value;
        scope.set(finalKey, final);

        this.order[UUID] = keys.concat([ finalKey ]);

		if (this.timeouts.has(UUID))
			clearTimeout(this.timeouts.get(UUID));

		if (this.timeout !== undefined)
			this.timeouts.set(UUID, setTimeout(() => { this.#deleteByUUID(UUID); }, this.timeout));

		if (this.maxSize !== undefined && Object.keys(this.order).length > this.maxSize)
			this.#deleteByUUID(this.order.shift());
	}
    add(key) {
        if (!this.store.has(key))
            this.set(key, true);
    }

    #deleteByUUID(UUID) {
        if (this.timeouts.has(UUID))
            clearTimeout(this.timeouts.get(UUID));
        this.timeouts.delete(UUID);

        const keys = this.order[UUID];
        delete this.order[UUID];

        const scopes = [ { children: this.store } ];
        let scope = this.store;
        for (const key of keys) {
            const temp = scope.get(key);
            scopes.push(temp);

            scope = temp.children;
        }

        const final = scopes.pop();
        final.defined = false;
        delete final.value;
        if (final.children?.size > 0)
            return;

        for (let i = scopes.length - 1; i >= 0; i--) {
            const scope = scopes[i];
            const key = keys.pop();

            scope.children.delete(key);
            if (scope.children.size > 0 || scope.defined)
                break;

            scope.terminal = true;
            delete scope.children;
        }
    }
	delete(...keys) {
        const UUID = ((...keys) => {
            const lastKey = keys.pop();
            let scope = this.store;
            for (const key of keys) {
                if (!scope.has(key))
                    return undefined;

                const temp = scope.get(key);
                if (temp.terminal)
                    return undefined;

                scope = temp.children;
            }

            return scope.get(lastKey)?.UUID;
        })(...keys);

        if (UUID !== undefined)
            this.#deleteByUUID(UUID);
	}

	size() {
		return Object.keys(this.order).length;
	}
}

export { Trie };