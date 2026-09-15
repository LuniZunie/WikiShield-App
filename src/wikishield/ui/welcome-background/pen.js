// Utility functions (moved outside hot path for performance)
const averageColor = (a, b) => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const almostEqual = (a, b, epsilon = 1e-9) => Math.abs(a - b) < epsilon;

const clipLineToRect = (p0x, p0y, p1x, p1y, minX, minY, maxX, maxY) => {
    const dx = p1x - p0x;
    const dy = p1y - p0y;

    let t0 = 0, t1 = 1;

    const clip = (p, q) => {
        if (almostEqual(p, 0))
            return q >= 0;

        const r = q / p;
        if (p < 0) {
            if (r > t1)
                return false;
            if (r > t0)
                t0 = r;
        } else {
            if (r < t0)
                return false;
            if (r < t1)
                t1 = r;
        }

        return true;
    };

    if (
        !clip(-dx, p0x - minX) ||
        !clip(dx, maxX - p0x) ||
        !clip(-dy, p0y - minY) ||
        !clip(dy, maxY - p0y)
    )
        return null;

    return [
        p0x + dx * t0,
        p0y + dy * t0,
        p0x + dx * t1,
        p0y + dy * t1,
    ];
};

class WelcomeBackground {
    #$paper;
    #pen;

    #performanceSetting;

    #observer;
    #observerCache = { width: undefined, height: undefined };
    #observerCallback(entries) {
        const { width: cacheWidth, height: cacheHeight } = this.#observerCache;

        for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width !== cacheWidth || height !== cacheHeight) {
                if (this.#resizeCallback)
                    cancelAnimationFrame(this.#resizeCallback);
                this.#resizeCallback = requestAnimationFrame(() => this.#resize(width, height));
            }
        }
    }

    #resizeCallback;
    #resize(width, height) {
        if (this.#resizeCallback)
            cancelAnimationFrame(this.#resizeCallback);

        const { width: oldWidth, height: oldHeight } = this.#observerCache;

        let $copy;
        if (oldWidth && oldHeight) {
            $copy = document.createElement("canvas");
            $copy.width = oldWidth;
            $copy.height = oldHeight;

            $copy.getContext("2d").drawImage(this.#$paper, 0, 0);
        }

        this.#observerCache.width = width;
        this.#observerCache.height = height;

        this.#$paper.width = width;
        this.#$paper.height = height;

        const scaleX = width / oldWidth || 1;
		const scaleY = height / oldHeight || 1;

        this.#dots.forEach(dot => {
            dot.x *= scaleX;
            dot.y *= scaleY;
        });

        const targetDots = Dot.target(width, height);
        if (targetDots > this.#dots.length)
            for (let i = this.#dots.length; i < targetDots; i++)
                this.#dots.push(new Dot(this));
        else if (targetDots < this.#dots.length)
            this.#dots.length = targetDots;

        this.#pen.setTransform(1, 0, 0, 1, 0, 0);

        if ($copy)
            this.#pen.drawImage(
                $copy,
                0, 0, $copy.width, $copy.height,
                0, 0, width, height
            );
    }

    #dots = [ ];

    constructor($paper, performanceSetting) {
        this.#$paper = $paper;
        this.#pen = $paper.getContext("2d");

        this.#performanceSetting = performanceSetting;

        this.#observer = new ResizeObserver((...args) => this.#observerCallback(...args));
        this.#observer.observe($paper);

        this.#resize($paper.clientWidth, $paper.clientHeight);
    }

    update() {
        const pen = this.#pen;
        const { width, height } = this.#observerCache;

        pen.fillStyle = "rgba(0, 0, 0, .1)";
        pen.fillRect(0, 0, width, height);

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
        const threshold = Math.min(width, height) * .25;
        const thresholdSq = threshold * threshold;
        const invWidth = 1 / width;
        const invHeight = 1 / height;

        const connections = [ ];

        const addWrappedConnection = (a, b, offsetX, offsetY, color, baseDx, baseDy, baseDistSq) => {
            const dx = baseDx + offsetX * width;
            const dy = baseDy + offsetY * height;
            const distSq = dx * dx + dy * dy;

            if (distSq > thresholdSq)
                return;

            const distance = Math.sqrt(distSq);
            const opacity = (1 - distance / threshold) ** 2 * .6 * (a.size + b.size) / 8;

            const targetX = b.x + offsetX * width;
            const targetY = b.y + offsetY * height;

            const minTileX = Math.floor(Math.min(a.x, targetX) * invWidth);
            const maxTileX = Math.floor(Math.max(a.x, targetX) * invWidth);
            const minTileY = Math.floor(Math.min(a.y, targetY) * invHeight);
            const maxTileY = Math.floor(Math.max(a.y, targetY) * invHeight);

            for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
                    const tileLeft = tileX * width;
                    const tileTop = tileY * height;
                    const tileRight = tileLeft + width;
                    const tileBottom = tileTop + height;

                    const clipped = clipLineToRect(
                        a.x, a.y,
                        targetX, targetY,
                        tileLeft, tileTop, tileRight, tileBottom
                    );

                    if (!clipped)
                        continue;

                    const [ fromX, fromY, toX, toY ] = clipped;
                    if (almostEqual(fromX, toX) && almostEqual(fromY, toY))
                        continue;

                    connections.push([
                        {
                            x: clamp(fromX - tileLeft, 0, width),
                            y: clamp(fromY - tileTop, 0, height),
                        },
                        {
                            x: clamp(toX - tileLeft, 0, width),
                            y: clamp(toY - tileTop, 0, height),
                        },
                        color,
                        opacity,
                    ]);
                }
            }
        };

        const dots = this.#dots;
        const dotsLength = dots.length;

        for (let i = 0; i < dotsLength; i++) {
            const a = dots[i];

            for (let j = i + 1; j < dotsLength; j++) {
                const b = dots[j];
                const baseDx = b.x - a.x;
                const baseDy = b.y - a.y;
                const baseDistSq = baseDx * baseDx + baseDy * baseDy;

                // Early exit if direct distance is already too far
                if (baseDistSq > thresholdSq) {
                    // Check if any wrapping offset could work
                    const maxOffsetDist = Math.abs(width) + Math.abs(height);
                    if (baseDistSq > (threshold + maxOffsetDist) ** 2)
                        continue;
                }

                const color = averageColor(a.color, b.color);

                for (let offsetY = -1; offsetY <= 1; offsetY++) {
                    for (let offsetX = -1; offsetX <= 1; offsetX++) {
                        addWrappedConnection(a, b, offsetX, offsetY, color, baseDx, baseDy, baseDistSq);
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
    static target(width, height) {
        return Math.max(40, Math.min(250, Math.floor((width * height) / 7000)));
    }

    static colors = [
        Object.freeze([ 102, 126, 234, .8 ]),
        Object.freeze([ 240, 147, 251, .8 ]),
        Object.freeze([ 118, 75, 162, .8 ]),
        Object.freeze([ 217, 70, 239, .8 ])
    ];

    constructor(parent) {
        this.parent = parent;

        this.size = Math.random() * 1 + 1 | 0;

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

        this.size = Math.max(Math.min(this.size + (Math.random() - .5) * .1, 2), 1);
    }
}

export { WelcomeBackground }