class VolumeControl extends HTMLElement {
	static get observedAttributes() {
		return ['title', 'description', 'value'];
	}

	constructor() {
		super();
		this._title = '';
		this._description = '';
		this._value = 0.5;
		this._sound = '';
		this._preview = null;
	}

	connectedCallback() {
		this.render();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'title':
				this._title = newValue || '';
				if (this.titleEl)
					this.titleEl.textContent = this._title;
				break;
			case 'description':
				this._description = newValue || '';
				if (this.descEl)
					this.descEl.textContent = this._description;
				break;
			case 'value':
				this._value = Math.max(0, Math.min(1, parseFloat(newValue)));
				if (this.slider)
					this.slider.value = this._value;
				if (this.input)
					this.input.value = this._value.toFixed(2);
				break;
		}
	}

	get title() {
		return this._title;
	}

	set title(val) {
		this.setAttribute('title', val);
	}

	get value() {
		return this._value;
	}

	set value(val) {
		this.setAttribute('value', val);
	}

	setPreview(audio, path) {
		this._preview = { audio, path };
		this.render();
	}

	handleVolumeChange = (e) => {
		const newValue = Math.max(0, Math.min(1, parseFloat(e.target.value)));
		this._value = newValue;
		this.slider.value = newValue;
		this.input.value = newValue.toFixed(2);
		this.dispatchEvent(new CustomEvent('change', {
			detail: { value: newValue },
			bubbles: true
		}));
	}

	render() {
		this.className = 'volume-control';
		this.innerHTML = '';

		// Header
		const header = document.createElement('div');
		header.className = 'volume-control-header';

		const info = document.createElement('div');
		info.className = 'volume-control-info';

		this.titleEl = document.createElement('div');
		this.titleEl.className = 'volume-control-title';
		this.titleEl.textContent = this._title;

		this.descEl = document.createElement('div');
		this.descEl.className = 'volume-control-desc';
		this.descEl.textContent = this._description;

		info.appendChild(this.titleEl);
		info.appendChild(this.descEl);

		header.appendChild(info);
		if (this._preview) {
			const $preview = document.createElement('button');
			$preview.className = 'volume-control-preview';
			$preview.title = 'Preview sound';
			$preview.addEventListener('click', () => {
				if ($preview.classList.contains('playing'))
					return;

				$preview.classList.add('playing');
				const $icon = $preview.querySelector('i');
				if ($icon)
					$icon.className = 'fa fa-stop';

				const controller = new AbortController();
				$preview.onclick = () => controller.abort();

				this._preview.audio.stopPreviews();
				this._preview.audio.playSound(this._preview.path, controller.signal, true)
					.finally(() => {
						$preview.onclick = null;
						$preview.classList.remove('playing');
						if ($icon)
							$icon.className = 'fa fa-play';
					});
			});

			const playIcon = document.createElement('i');
			playIcon.className = 'fa fa-play';
			$preview.appendChild(playIcon);

			header.appendChild($preview);
		}
		this.appendChild(header);

		const sliderContainer = document.createElement('div');
		sliderContainer.className = 'volume-control-slider-container';

		this.slider = document.createElement('input');
		this.slider.type = 'range';
		this.slider.className = 'volume-control-slider';
		this.slider.min = '0';
		this.slider.max = '1';
		this.slider.step = '0.01';
		this.slider.value = this._value;
		this.slider.autocomplete = 'off';
		this.slider.addEventListener('input', this.handleVolumeChange);
		sliderContainer.appendChild(this.slider);

		this.input = document.createElement('input');
		this.input.type = 'number';
		this.input.className = 'volume-control-input';
		this.input.min = '0';
		this.input.max = '1';
		this.input.step = '0.01';
		this.input.value = this._value.toFixed(2);
		this.input.autocomplete = 'off';
		this.input.addEventListener('input', this.handleVolumeChange);
		sliderContainer.appendChild(this.input);

		this.appendChild(sliderContainer);
	}
}

customElements.define('volume-control', VolumeControl);