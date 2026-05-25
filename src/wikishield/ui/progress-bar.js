export class ProgressBar {
    constructor() {
        this.$bar = document.createElement("div");
        this.$bar.classList.add("progress-bar");
        this.$bar.style.opacity = 1;
        document.querySelector('#progress-bar-container').appendChild(this.$bar);

        this.$overlay = document.createElement("div");
        this.$overlay.classList.add("progress-bar-overlay");
        this.$overlay.style.width = "0%";
        this.$bar.appendChild(this.$overlay);

        this.$text = document.createElement("div");
        this.$text.classList.add("progress-bar-text");
        this.$bar.appendChild(this.$text);
    }

    set(text, portion, error) {
        this.$text.textContent = text;
        this.$overlay.style.width = `${Math.min(Math.max(portion, 0), 1) * 100}%`;
        this.$bar.classList.toggle("error", error);

        if (portion >= 1)
            setTimeout(() => {
                this.$bar.style.opacity = 0;
                setTimeout(() => this.$bar.remove(), 300);
            }, 1700);
    }
};