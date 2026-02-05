import { expiryRegex } from '../utilities/helpers.js';

class DurationInput extends HTMLElement {
    constructor() {
        super();

        this.duration = {
            years: 0,
            months: 0,
            weeks: 0,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
        };

        this.isInfinite = false;
    }

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        const units = [
            { key: 'years', label: 'Years' },
            { key: 'months', label: 'Months' },
            { key: 'weeks', label: 'Weeks' },
            { key: 'days', label: 'Days' },
            { key: 'hours', label: 'Hours' },
            { key: 'minutes', label: 'Minutes' },
            { key: 'seconds', label: 'Seconds' },
        ];

        this.innerHTML = `
            <label class="infinity-label">
                <span>Infinite Duration</span>
            </label>
            <div class="duration-inputs">
                ${units.map(unit => `
                    <label>
                        <span>${unit.label}</span>
                        <input
                            type="number"
                            min="0"
                            data-unit="${unit.key}"
                            value="0"
                            step="1"
                            placeholder="0"
                        />
                    </label>
                `).join('')}
            </div>
        `;
    }

    attachEventListeners() {
        const $infinity = this.querySelector('.infinity-label');

        // Toggle infinite duration
        $infinity.addEventListener('click', () => {
            this.isInfinite = !this.isInfinite;
            $infinity.classList.toggle('selected', this.isInfinite);
            this.dispatchChangeEvent();
        });

        // Handle duration input changes
        this.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', (event) => {
                const unit = event.target.dataset.unit;
                this.duration[unit] = parseInt(event.target.value, 10) || 0;
                this.dispatchChangeEvent();
            });
        });
    }

    dispatchChangeEvent() {
        this.dispatchEvent(new CustomEvent('change', {
            detail: this.getDurationString(),
            bubbles: true,
        }));
    }

    get value() {
        return this.getDurationString();
    }

    getDurationString() {
        if (this.isInfinite) {
            return 'infinite';
        }

        let durationStr = '';
        const unitMap = {
            years: 'Y',
            months: 'M',
            weeks: 'W',
            days: 'D',
            hours: 'H',
            minutes: 'M',
            seconds: 'S',
        };

        for (const [unit, value] of Object.entries(this.duration)) {
            if (value > 0) {
                durationStr += `${value}${unitMap[unit]}`;
            }
        }

        return durationStr || '0S';
    }

    set value(durationStr) {
        // Handle infinite duration
        if (durationStr === 'infinite' || durationStr === 'infinity' || durationStr === '∞') {
            this.isInfinite = true;
            const $infinity = this.querySelector('.infinity-label');
            if ($infinity) {
                $infinity.classList.add('selected');
            }
            return;
        }

        // Reset infinite state
        this.isInfinite = false;
        const $infinity = this.querySelector('.infinity-label');
        if ($infinity) {
            $infinity.classList.remove('selected');
        }

        // Parse duration string
        const match = expiryRegex.exec(durationStr);
        if (match) {
            for (const unit of Object.keys(this.duration)) {
                const value = match.groups[unit];
                this.duration[unit] = value ? parseInt(value, 10) : 0;

                const input = this.querySelector(`input[data-unit="${unit}"]`);
                if (input) {
                    input.value = this.duration[unit];
                }
            }
        }
    }
}
customElements.define('duration-input', DurationInput);