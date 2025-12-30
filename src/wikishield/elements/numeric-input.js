export class NumericInput extends HTMLElement {
	static get observedAttributes() {
		return ['value', 'min', 'max', 'step'];
	}

	constructor() {
		super();
		this.inputValue = 0;
		this._min = -Infinity;
		this._max = Infinity;
		this._step = 1;
	}

	connectedCallback() {
		this.render();
		this.setupEventListeners();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'value':
				this.inputValue = Number(newValue) || 0;
				if (this.input) {
					this.input.value = this.inputValue;
				}
				break;
			case 'min':
				this._min = Number(newValue ?? -Infinity);
				break;
			case 'max':
				this._max = Number(newValue ?? Infinity);
				break;
			case 'step':
				this._step = Number(newValue ?? 1);
				break;
		}
	}

	get value() {
		return this.inputValue;
	}

	set value(val) {
		this.setAttribute('value', val);
	}

	get min() {
		return this._min;
	}

	get max() {
		return this._max;
	}

	get step() {
		return this._step;
	}

	handleMinus = () => {
		const currentValue = Number(this.inputValue);
		const newValue = Math.round(Math.max(currentValue - this.step, this.min) * 100) / 100;
		this.updateValue(newValue);
	}

	handlePlus = () => {
		const currentValue = Number(this.inputValue);
		const newValue = Math.round(Math.min(currentValue + this.step, this.max) * 100) / 100;
		this.updateValue(newValue);
	}

	handleInputChange = () => {
		const inputVal = this.input.value;

		if (isNaN(Number(inputVal))) {
			this.input.value = this.inputValue;
			return;
		}

		let newValue = Math.round(Math.min(Math.max(Number(inputVal), this.min), this.max) * 100) / 100;
		newValue = this.step >= 1 ? Math.round(newValue) : newValue;

		this.updateValue(newValue);
	}

	handleKeyUp = (e) => {
		if (e.key.toLowerCase() === "enter") {
			this.handleInputChange();
			e.target.blur();
		}
	}

	handleInput = (e) => {
		this.inputValue = e.target.value;
	}

	updateValue(newValue) {
		this.inputValue = newValue;
		this.input.value = newValue;
		this.dispatchEvent(new CustomEvent('change', {
			detail: { value: newValue },
			bubbles: true
		}));
	}

	setupEventListeners() {
		this.minusBtn.addEventListener('click', this.handleMinus);
		this.plusBtn.addEventListener('click', this.handlePlus);
		this.input.addEventListener('input', this.handleInput);
		this.input.addEventListener('blur', this.handleInputChange);
		this.input.addEventListener('keyup', this.handleKeyUp);
        this.input.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY < 0)
                this.handlePlus();
            else if (e.deltaY > 0)
                this.handleMinus();
        });
	}

	render() {
		this.className = 'numeric-input-container';

		this.minusBtn = document.createElement('span');
		this.minusBtn.className = 'fa fa-minus numeric-input-button';

		this.input = document.createElement('input');
		this.input.type = 'text';
		this.input.className = 'numeric-input';
		this.input.value = this.inputValue;
		this.input.autocomplete = 'off';

		this.plusBtn = document.createElement('span');
		this.plusBtn.className = 'fa fa-plus numeric-input-button';

		this.appendChild(this.minusBtn);
		this.appendChild(this.input);
		this.appendChild(this.plusBtn);
	}
}
customElements.define('numeric-input', NumericInput);