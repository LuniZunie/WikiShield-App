class ToggleInput extends HTMLElement {
	static get observedAttributes() {
		return ['value', 'checked'];
	}

	constructor() {
		super();
		this._value = false;
	}

	connectedCallback() {
		this.render();
		this.updateState();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		if (name === 'value' || name === 'checked') {
			this._value = newValue === 'true' || newValue === '1' || newValue === '';
			this.updateState();
		}
	}

	get value() {
		return this._value;
	}

	set value(val) {
		this._value = !!val;
		this.setAttribute('value', this._value);
		this.updateState();
	}

	get checked() {
		return this._value;
	}

	set checked(val) {
		this.value = val;
	}

	handleClick = () => {
		this._value = !this._value;
		this.updateState();
		this.dispatchEvent(new CustomEvent('change', {
			detail: { value: this._value, checked: this._value },
			bubbles: true
		}));
	}

	updateState() {
		this.classList.toggle('active', this._value);
	}

	render() {
		this.classList.add('settings-toggle');
		this.innerHTML = '';

		const toggleSwitch = document.createElement('div');
		toggleSwitch.className = 'toggle-switch';

		const toggleSlider = document.createElement('div');
		toggleSlider.className = 'toggle-slider';

		toggleSwitch.appendChild(toggleSlider);
		this.appendChild(toggleSwitch);

		this.addEventListener('click', this.handleClick);
	}
}

customElements.define('toggle-input', ToggleInput);