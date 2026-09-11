const DPR = Math.min(devicePixelRatio || 1, 2);

class WelcomeBackground {
    #$paper;
    #pen;

    #performanceSetting = "adaptive";

    #observer;
    #observerCache = { width: undefined, height: undefined };
    #observerCallback(entries) {
        const { width: cacheWidth, height: cacheHeight } = this.#observerCache;

        for (const entry of entries) {
            const { width, height } = $node.contentRect;
            if (width !== cacheWidth || height !== cacheHeight)
                this.#resize(width, height);
        }
    }

    #resize(width, height) {
        this.#observerCache.width = width;
        this.#observerCache.height = height;

        this.#$paper.width = width;
        this.#$paper.height = height;

        this.#pen.setTransform(1, 0, 0, 1, 0, 0);
        this.#pen.scale(DPR, DPR);
    }

    #dots = [ ];

    constructor($paper, performanceSetting) {
        this.#$paper = $paper;
        this.#pen = $paper.getContext("2d");

        this.#performanceSetting = performanceSetting;

        this.#observer = new ResizeObserver(this.#observerCallback);
        this.#observer.observe($paper);

        this.#resize($paper.clientWidth, $paper.clientHeight);

        for (let i = 0; i < 100; i++)
            this.#dots.push(new Dot());
    }

    update() {
        const imageData = this.#pen.createImageData(width, height);
        const data = imageData.data;

        for (const dot of this.#dots) {


            dot.move();
        }
    }

    animate() {
        const animationFunction = () => {
            this.update();
            this.animationFrame = requestAnimationFrame(() => animationFunction());
        };

        this.animationFrame = requestAnimationFrame(() => animationFunction());
    }

    terminate() {
        this.#observer.disconnect();
        if (this.animationFrame)
            cancelAnimationFrame(this.animationFrame);
    }
}

class Dot {
    static colors = [
        Object.freeze([ 102, 126, 234 ]),
        Object.freeze([ 240, 147, 251 ]),
        Object.freeze([ 118, 75, 162 ]),
        Object.freeze([ 217, 70, 239 ])
    ];

    size = 1;
    color = [ 255, 255, 255 ];

    x = 0;
    y = 0;

    vx = 0;
    vy = 0;

    ax = 0;
    ay = 0;

    constructor() {
        this.size = Math.random() * 3 + 1 | 0;

        this.x = Math.random();
        this.y = Math.random();

        this.vx = (Math.random() - .5) * .5;
		this.vy = (Math.random() - .5) * .5;

        this.ax = (Math.random() - .5) * .1;
        this.ay = (Math.random() - .5) * .1;

        this.color = Dot.colors[Math.random() * Dot.colors.length | 0];
    }

    move() {
        this.x = ((this.x + this.vx) % 1 + 1) % 1;
        this.y = ((this.y + this.vy) % 1 + 1) % 1;

        this.vx = Math.max(Math.min(this.vx + this.ax, .5), -.5);
        this.vy = Math.max(Math.min(this.vy + this.ay, .5), -.5);

        this.ax = Math.max(Math.min((this.ax + (Math.random() - .5) * .01), .1), -.1);
        this.ay = Math.max(Math.min((this.ay + (Math.random() - .5) * .01), .1), -.1);
    }

    draw() {
        const coordinates = [ { x: this.x, y: this.y, coverage: 1 } ];
    }
}

export { WelcomeBackground }