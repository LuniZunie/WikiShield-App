class Stack {
	constructor(maxSize = 50) {
		this.items = [ ];
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
		this.items = [ ];
	}

	get length() {
		return this.items.length;
	}
	set length(v) {
		this.items.length = Math.min(v, this.maxSize);
	}
}

module.exports = { Stack };