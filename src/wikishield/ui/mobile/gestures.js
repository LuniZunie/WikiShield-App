export function addGestureListener($element, callback) {
    if (window.TouchEvent) {
        // types: "tap", "swipeleft", "swiperight", "swipeup", "swipedown"
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        $element.addEventListener("touchstart", event => {
            if (event.touches.length > 1)
                return;
            const touch = event.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
        });

        $element.addEventListener("touchend", event => {
            if (event.changedTouches.length > 1)
                return;
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            const deltaTime = Date.now() - touchStartTime;

            if (deltaTime < 500) {
                if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                    callback("tap", event);
                } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    if (deltaX > 30) {
                        callback("swiperight", event);
                    } else if (deltaX < -30) {
                        callback("swipeleft", event);
                    }
                } else {
                    if (deltaY > 30) {
                        callback("swipedown", event);
                    } else if (deltaY < -30) {
                        callback("swipeup", event);
                    }
                }
            }
        });
    }
}