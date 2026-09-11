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
            const { width, height } = entry.contentRect;
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

        this.#observer = new ResizeObserver((...args) => this.#observerCallback(...args));
        this.#observer.observe($paper);

        this.#resize($paper.clientWidth, $paper.clientHeight);

        for (let i = 0; i < 100; i++)
            this.#dots.push(new Dot(this));
    }

    update() {
        const pen = this.#pen;
        const { width, height } = this.#observerCache;

        for (const connections of this.getConnections()) {
            const [ start, end, color, opacity ] = connections;

            pen.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
            pen.beginPath();
            pen.moveTo(start.x, start.y);
            pen.lineTo(end.x, end.y);
            pen.stroke();
        }

        for (const dot of this.#dots) {
            pen.fillStyle = `rgba(${dot.color[0]}, ${dot.color[1]}, ${dot.color[2]}, ${dot.color[3]})`;

            pen.beginPath();
            pen.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
            pen.fill();

            dot.move();
        }
    }

    getConnections() {
        const { width, height } = this.#observerCache;

        const threshhold = Math.min(width, height) * .25;

        const getAverageColor = (a, b) => [
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2,
            (a[2] + b[2]) / 2,
        ];

        const cache = new Map();
        const connections = [ ];
        for (const a of this.#dots) {
            cache.set(a, new Set());
            for (const b of this.#dots) {
                if (a === b || cache.get(b)?.has(a))
                    continue;
                else
                    cache.get(a).add(b);

                const averageColor = getAverageColor(a.color, b.color);

                {
                    const distance = Math.hypot(a.x - b.x, a.y - b.y);
                    if (distance <= threshhold)
                        connections.push([ { x: a.x, y: a.y }, { x: b.x, y: b.y }, averageColor, (1 - distance / threshhold) ** 2 * (a.size + b.size) / 8 ]);
                }

                {
                    const [ left, right ] = b.x >= a.x ? [ a, b ] : [ b, a ];

                    const distance = Math.hypot(right.x - width - left.x, right.y - left.y);
                    if (distance <= threshhold) {
                        const opacity = (1 - distance / threshhold) ** 2 * .6;

                        /*
                            y = mx + b
                            b = y - mx

                            y = left.y
                            m = (right.y - left.y) / (right.x - width - left.x)
                            x = left.x

                            b = left.y - (right.y - left.y) / (right.x - width - left.x) * left.x
                        */
                        const yIntercept = Math.round(left.y - (right.y - left.y) / (right.x - width - left.x) * left.x);
                        connections.push(
                            [ { x: right.x, y: right.y }, { x: width, y: yIntercept }, averageColor, opacity ],
                            [ { x: 0, y: yIntercept }, { x: left.x, y: left.y }, averageColor, opacity ]
                        );
                    }
                }

                {
                    const [ top, bottom ] = b.y >= a.y ? [ a, b ] : [ b, a ];

                    const distance = Math.hypot(bottom.x - top.x, bottom.y - height - top.y);
                    if (distance <= threshhold) {
                        const opacity = (1 - distance / threshhold) ** 2 * .6;

                        /*
                            y = mx + b
                            x = (y - b) / m

                            need to find b:
                            b = y - mx

                            y = top.y
                            m = (bottom.y - height - top.y) / (bottom.x - top.x)
                            x = top.x

                            b = top.y - (bottom.y - height - top.y) / (bottom.x - top.x) * top.x

                            now find x:
                            y = 0
                            b = top.y - (bottom.y - height - top.y) / (bottom.x - top.x) * top.x
                            m = (bottom.y - height - top.y) / (bottom.x - top.x);

                            x = (0 - (top.y - (bottom.y - height - top.y) / (bottom.x - top.x) * top.x)) / ((bottom.y - height - top.y) / (bottom.x - top.x))

                            simplify:
                            x = (0 - (y1 - (y2 - h - y1) / (x2 - x1) * x1)) / ((y2 - h - y1) / (x2 - x1))

                            x = (x1 * (y2 - h) - x2 * y1) / (y2 - h - y1)

                            x = (top.x * (bottom.y - height) - bottom.x * top.y) / (bottom.y - height - top.y)
                        */

                        const xIntercept = top.x === bottom.x ?
                            top.x :
                            Math.round((top.x * (bottom.y - height) - bottom.x * top.y) / (bottom.y - height - top.y));
                        connections.push(
                            [ { x: bottom.x, y: bottom.y }, { x: xIntercept, y: height }, averageColor, opacity ],
                            [ { x: xIntercept, y: 0 }, { x: top.x, y: top.y }, averageColor, opacity ]
                        );
                    }
                }
            }
        }

        return connections;
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

    get width() {
        return this.#observerCache.width;
    }
    get height() {
        return this.#observerCache.height;
    }

    get dots() {
        return this.#dots;
    }
}

class Dot {
    static colors = [
        Object.freeze([ 102, 126, 234, .8 ]),
        Object.freeze([ 240, 147, 251, .8 ]),
        Object.freeze([ 118, 75, 162, .8 ]),
        Object.freeze([ 217, 70, 239, .8 ])
    ];

    constructor(parent) {
        this.parent = parent;

        this.size = Math.random() * 3 + 1 | 0;

        this.x = Math.random() * parent.width;
        this.y = Math.random() * parent.height;

        this.vx = (Math.random() - .5) * .25;
		this.vy = (Math.random() - .5) * .25;

        this.ax = (Math.random() - .5) * .01;
        this.ay = (Math.random() - .5) * .01;

        this.color = Dot.colors[Math.random() * Dot.colors.length | 0];
    }

    move() {
        const { width, height } = this.parent;

        this.x = ((this.x + this.vx) % width + width) % width;
        this.y = ((this.y + this.vy) % height + height) % height;

        this.vx = Math.max(Math.min(this.vx + this.ax, .25), -.25);
        this.vy = Math.max(Math.min(this.vy + this.ay, .25), -.25);

        if (Math.random() < .01)
            this.ax = (Math.random() - .5) * .01;
        if (Math.random() < .01)
            this.ay = (Math.random() - .5) * .01;

        this.size = Math.max(Math.min(this.size + (Math.random() - .5) * .1, 4), 1);
    }
}

export { WelcomeBackground }