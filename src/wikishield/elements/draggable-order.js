class DraggableOrderList extends HTMLElement {
	constructor() {
		super();
		this.items = [];
		this.draggedIndex = null;
		this.placeholderIndex = null;
		this.itemWrappers = [];
	}

	connectedCallback() {
		this.className = 'draggable-order-list';
		this.syncItemsFromChildren();
	}

	syncItemsFromChildren() {
		const children = Array.from(this.children);
		this.items = children.map((child, i) => ({
			child,
			key: child.dataset.key || child.getAttribute('key') || i
		}));
		this.render();
	}

	addItem(element, key) {
		this.items.push({ child: element, key: key || this.items.length });
		this.render();
	}

	clearItems() {
		this.items = [];
		this.render();
	}

	handleDragStart = (index, e) => {
		this.draggedIndex = index;
		this.placeholderIndex = index;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', index);

		// Add a slight delay to allow the drag image to be captured
		requestAnimationFrame(() => {
			this.updateDragState();
		});
	}

	handleDragOver = (index, e) => {
		e.preventDefault();

		if (this.draggedIndex === null || index === this.placeholderIndex) return;

		// Reorder items in real-time
		const newItems = [...this.items];
		const draggedItem = newItems[this.draggedIndex];

		// Remove from old position
		newItems.splice(this.draggedIndex, 1);
		// Insert at new position
		newItems.splice(index, 0, draggedItem);

		this.items = newItems;
		this.draggedIndex = index;
		this.placeholderIndex = index;
		this.render();
	}

	handleDragEnd = () => {
		// Notify parent of the final order
		this.dispatchEvent(new CustomEvent('reorder', {
			detail: { keys: this.items.map(item => item.key) },
			bubbles: true
		}));

		this.draggedIndex = null;
		this.placeholderIndex = null;
		this.updateDragState();
	}

	updateDragState() {
		const isDragging = this.draggedIndex !== null;
		this.classList.toggle('is-dragging', isDragging);

		this.itemWrappers.forEach((wrapper, index) => {
			wrapper.classList.toggle('dragging', this.draggedIndex === index);
		});
	}

	render() {
		this.innerHTML = '';
		this.itemWrappers = [];

		this.items.forEach((item, index) => {
			const wrapper = document.createElement('div');
			wrapper.className = 'draggable-order-item-wrapper';
			wrapper.draggable = true;
			wrapper.dataset.key = item.key;

			wrapper.addEventListener('dragstart', (e) => this.handleDragStart(index, e));
			wrapper.addEventListener('dragover', (e) => this.handleDragOver(index, e));
			wrapper.addEventListener('dragend', this.handleDragEnd);

			wrapper.appendChild(item.child.cloneNode ? item.child.cloneNode(true) : item.child);
			this.appendChild(wrapper);
			this.itemWrappers.push(wrapper);
		});

		this.updateDragState();
	}
}

class DraggableOrderItem extends HTMLElement {
	static get observedAttributes() {
		return ['name', 'enabled'];
	}

	constructor() {
		super();
		this._name = '';
		this._enabled = true;
	}

	connectedCallback() {
		this.render();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'name':
				this._name = newValue || '';
				if (this.nameSpan) {
					this.nameSpan.textContent = this._name;
				}
				break;
			case 'enabled':
				this._enabled = newValue !== 'false' && newValue !== '0';
				this.updateEnabledState();
				break;
		}
	}

	get name() {
		return this._name;
	}

	set name(val) {
		this.setAttribute('name', val);
	}

	get enabled() {
		return this._enabled;
	}

	set enabled(val) {
		this.setAttribute('enabled', val);
	}

	handleToggle = (e) => {
		e.stopPropagation();
		this._enabled = !this._enabled;
		this.updateEnabledState();
		this.dispatchEvent(new CustomEvent('toggle', {
			detail: { enabled: this._enabled },
			bubbles: true
		}));
	}

	updateEnabledState() {
		this.classList.toggle('disabled', !this._enabled);
		if (this.toggle) {
			this.toggle.title = this._enabled ? 'Click to disable' : 'Click to enable';
		}
	}

	render() {
		this.className = 'draggable-order-item';
		this.innerHTML = '';

		this.nameSpan = document.createElement('span');
		this.nameSpan.className = 'draggable-order-item-name';
		this.nameSpan.textContent = this._name;

		this.toggle = document.createElement('div');
		this.toggle.className = 'draggable-order-item-toggle';
		this.toggle.addEventListener('click', this.handleToggle);

		this.appendChild(this.nameSpan);
		this.appendChild(this.toggle);

		this.updateEnabledState();
	}
}

customElements.define('draggable-order-list', DraggableOrderList);
customElements.define('draggable-order-item', DraggableOrderItem);