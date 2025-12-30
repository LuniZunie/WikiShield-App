export class Memory {
	constructor(options = {}) {
		this.order = [ ];
		this.store = new Map();
		this.timeouts = new Map();

		if ("timeout" in options) {
			this.timeout = options.timeout;
		}

		if ("size" in options) {
			this.maxSize = options.size;
		}
	}

	clear() {
		this.order = [];
		this.store.clear();
		this.timeouts.clear();
	}

	has(key) {
		return this.store.has(key);
	}

	get(key) {
		return this.store.get(key);
	}

	set(key, value) {
		const existingIndex = this.order.indexOf(key);
		if (existingIndex !== -1) {
			this.order.splice(existingIndex, 1);
		}

		this.order.push(key);
		this.store.set(key, value);

		if (this.timeouts.has(key)) {
			clearTimeout(this.timeouts.get(key));
		}

		if (this.timeout !== undefined)
			this.timeouts.set(key, setTimeout(() => { this.delete(key); }, this.timeout));

		if (this.maxSize !== undefined && this.store.size > this.maxSize) {
			const oldestKey = this.order.shift();
			this.delete(oldestKey);
		}
	}
    add(key) {
        if (!this.store.has(key)) {
            this.set(key, true);
        }
    }

	delete(key) {
		this.store.delete(key);

		clearTimeout(this.timeouts.get(key));
		this.timeouts.delete(key);
	}

	size() {
		return this.store.size;
	}
}

export class Stack {
	constructor(maxSize = 50) {
		this.items = [];
		this.maxSize = maxSize;
	}

	push(item) {
		this.items.push(item);
		if (this.items.length > this.maxSize)
			this.items.shift();
	}
	pop() {
		return this.items.pop();
	}

	unshift(item) {
		this.items.unshift(item);
		if (this.items.length > this.maxSize)
			this.items.pop();
	}
	shift() {
		return this.items.shift();
	}

	peek() {
		return this.items[this.items.length - 1];
	}

	clear() {
		this.items = [];
	}

	get length() {
		return this.items.length;
	}
	set length(v) {
		this.items.length = Math.min(v, this.maxSize);
	}
}