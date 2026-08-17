class Stack {
	#size;
	#items;

	#start;
	#count;

	constructor(size = 50) {
		if (!Number.isInteger(size) || size < 0)
			throw new Error("Size must be a non-negative integer");

		this.#size = size;
		this.#items = new Array(size);

		this.#start = 0;
		this.#count = 0;
	}

	push(item) {
		if (this.#size === 0)
			return;

		if (this.#count === this.#size) {
			this.#items[this.#start] = item;
			this.#start = (this.#start + 1) % this.#size;
		} else {
			this.#items[(this.#start + this.#count) % this.#size] = item;
			this.#count++;
		}
	}
	pop() {
		if (this.#count === 0)
			return undefined;

		const index = (this.#start + this.#count - 1) % this.#size;
		const item = this.#items[index];

		this.#items[index] = undefined;
		this.#count--;

		return item;
	}

	unshift(item) {
		if (this.#size === 0)
			return;

		this.#start = (this.#start - 1 + this.#size) % this.#size;
		this.#items[this.#start] = item;

		if (this.#count < this.#size)
			this.#count++;
	}
	shift() {
		if (this.#count === 0)
			return undefined;

		const item = this.#items[this.#start];

		this.#items[this.#start] = undefined;
		this.#start = (this.#start + 1) % this.#size;
		this.#count--;

		return item;
	}

	peek() {
		if (this.#count === 0)
			return undefined;
		return this.#items[(this.#start + this.#count - 1) % this.#size];
	}

	clear() {
		this.#items.fill(undefined);

		this.#start = 0;
		this.#count = 0;
	}

	get count() {
		return this.#count;
	}

	get size() {
		return this.#size;
	}
	set size(newSize) {
		if (!Number.isInteger(newSize) || newSize < 0)
			throw new Error("Size must be a non-negative integer");

		if (newSize === this.#size)
			return;
		else if (newSize < this.#count) {
			const itemsToRemove = this.#count - newSize;
			this.#start = (this.#start + itemsToRemove) % this.#size;
			this.#count = newSize;
		}

		const newItems = new Array(newSize);
		for (let i = 0; i < this.#count; i++)
			newItems[i] = this.#items[(this.#start + i) % this.#size];

		this.#items = newItems;
		this.#start = 0;
		this.#size = newSize;
	}

	get items() {
		const result = [ ];
		for (let i = 0; i < this.#count; i++)
			result.push(this.#items[(this.#start + i) % this.#size]);
		return result;
	}
}

export { Stack };