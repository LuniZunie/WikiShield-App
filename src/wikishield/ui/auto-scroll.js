const TPS = 60, SPT = 1 / TPS; // Ticks per second, seconds per tick

async function SmoothScroll($el, delta, time, callback = () => true) {
    if (delta === 0)
        return Promise.resolve([ 0, 0 ]);

    const start = $el.scrollLeft, end = start + delta;
    const deadline = performance.now() + time;

    let resolve;
    const promise = new Promise(res => resolve = res);

    const scroll = () => {
        const now = performance.now();

        const pos = start + Math.min(1, (now - (deadline - time)) / time) * delta;
        if (now >= deadline) {
            $el.scrollLeft = end;
            resolve([ 0, 0 ]);
        } else if (!callback($el, pos))
            resolve([ delta - pos + start, Math.max(0, deadline - now) ]);
        else {
            $el.scrollLeft = pos;
            requestAnimationFrame(scroll);
        }
    };

    requestAnimationFrame(scroll);
    return promise;
}

function AutoScroll() {
    document.querySelectorAll(".auto-scroll").forEach($auto => {
        if (!$auto.dataset.autoScrollInitialized) {
            $auto.parentElement.addEventListener("wheel", event => {
                $auto.dataset.autoScrollFreeze = 750;
                $auto.dataset.autoScrollLastTime = performance.now();

                let offset = parseFloat($auto.dataset.autoScrollOffset) || 0;
                const x = Math.abs(event.deltaX),
                      y = Math.abs(event.deltaY),
                      z = Math.abs(event.deltaZ),
                      delta = x + y + z;

                if (delta === 0)
                    return;

                let direction;
                switch (Math.max(x, y, z)) {
                    case x: direction = Math.sign(event.deltaX); break;
                    case y: direction = Math.sign(event.deltaY); break;
                    case z: direction = Math.sign(event.deltaZ); break;
                }

                offset += direction * delta;
                $auto.dataset.autoScrollOffset = offset;
            }, { passive: true });
            $auto.dataset.autoScrollInitialized = true;
        }

        let offset = parseFloat($auto.dataset.autoScrollOffset) || 0;
        if ("autoScrollFreeze" in $auto.dataset) {
            const start = parseFloat($auto.dataset.autoScrollLastTime) || performance.now(), end = performance.now();

            offset += end - start;
            $auto.dataset.autoScrollOffset = offset;
            $auto.dataset.autoScrollLastTime = end;

            const freeze = parseFloat($auto.dataset.autoScrollFreeze);
            if (freeze > 0)
                $auto.dataset.autoScrollFreeze = freeze - end + start;
            else {
                delete $auto.dataset.autoScrollFreeze;
                delete $auto.dataset.autoScrollLastTime;
            }
        }

        const speed = parseFloat($auto.dataset.autoScrollSpeed) || 1;
        let carry = parseFloat($auto.dataset.autoScrollCarry) || 0;
        carry += speed;

        const delta = Math.floor(carry);
        $auto.dataset.autoScrollCarry = (carry - delta).toString();

        let scrolls = $auto.querySelectorAll(":scope > .auto-scroll-item").length;
        if (scrolls === 0) {
            const content = $auto.innerHTML;
            $auto.innerHTML = "";

            const $scroll = document.createElement("span");
            $scroll.className = "auto-scroll-item";
            $scroll.innerHTML = content;
            $auto.appendChild($scroll);

            scrolls = 1;
        }

        const $scroll = $auto.querySelector(":scope > .auto-scroll-item");
        const cs = getComputedStyle($scroll);

        const textWidth = $scroll.clientWidth + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
        const containerWidth = $auto.clientWidth;

        if (textWidth < containerWidth)
            return void($auto.querySelectorAll(":scope > .auto-scroll-item:not(:first-child)").forEach($el => $el.remove()));

        const min = Math.ceil(containerWidth / textWidth) + 1;
        const n = min - scrolls;
        if (n > 0)
            for (let i = 0; i < n; i++) {
                const $clone = $scroll.cloneNode(true);
                const $parent = $scroll.parentNode;

                $parent.insertBefore($clone, $scroll.nextSibling);
            }
        else if (n < 0) {
            const $extra = $auto.querySelectorAll(":scope > .auto-scroll-item");
            for (let i = 0; i < -n; i++)
                $extra[i]?.remove();
        }

        const pos = ((performance.now() - offset) / 1000 * TPS) * speed % textWidth;
        $auto.scrollLeft = pos;

        const scroll = ($el, delta, time) => {
            SmoothScroll($el, delta, time, ($el, pos) => {
                const len = textWidth;
                if (pos >= len)
                    return void($el.scrollLeft = pos % len) ?? false;
                return true;
            }).then(([ rDelta, rTime ]) => {
                if (rDelta > 0)
                    scroll($el, rDelta, rTime);
            });
        };

        if (speed > 0)
            scroll($auto, delta, SPT * 1000);
    });
}

export { AutoScroll };