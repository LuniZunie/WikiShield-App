const userProvedWorthiness = () => {
    window.localStorage.setItem("seen-mobile-tutorial", new Date().getTime().toString()); // user has proved they know how to use gestures
};

let preventStopScrolling = false;
const stopScrolling = event => {
    if (!preventStopScrolling && event.cancelable)
        event.preventDefault();
};

export function SetupGestures(ws) {
    ($editDetails => {
        const start = { dragging: false, x: 0, y: 0 };

        const eventStart = (x, y) => {
            start.dragging = true;
            start.x = x;
            start.y = y;
        };
        const eventMove = (x, y) => {
            if (!start.dragging)
                return;

            $editDetails.style.transition = "none";

            const maxHeight = window.innerHeight * .4;

            const deltaY = y - start.y;
            if (deltaY > 0) {
                if ($editDetails.classList.contains("expanded")) {
                    preventStopScrolling = $editDetails.scrollTop > 0;
                    if (!preventStopScrolling)
                        $editDetails.style.height = `${Math.max(maxHeight - deltaY, 75)}px`;
                } else
                    preventStopScrolling = false;
            } else {
                if ($editDetails.classList.contains("expanded"))
                    preventStopScrolling = true;
                else {
                    $editDetails.style.height = `${Math.min(75 - deltaY, maxHeight)}px`;
                    preventStopScrolling = false;
                }
            }
        };
        const eventEnd = (x, y) => {
            if (!start.dragging)
                return;

            $editDetails.style.transition = "";

            start.dragging = false;

            const deltaX = x - start.x;
            const deltaY = y - start.y;
            const delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            $editDetails.style.height = "";

            if (delta < 30) {
                userProvedWorthiness();
                return $editDetails.classList.toggle("expanded");
            }

            const maxHeight = window.innerHeight * .4;
            if ($editDetails.classList.contains("expanded")) {
                if (deltaY > maxHeight / 2) {
                    userProvedWorthiness();
                    $editDetails.classList.remove("expanded");
                }
            } else {
                if (deltaY < -maxHeight / 2) {
                    userProvedWorthiness();
                    $editDetails.classList.add("expanded");
                }
            }
        };

        $editDetails.addEventListener("pointerdown", event => {
            if (document.querySelectorAll(".tooltip.buttons").length)
                return;
            else if (event.target.closest("a"))
                return;
            else if (window.getSelection().toString().trim().length)
                return;
            eventStart(event.clientX, event.clientY);
            window.addEventListener("touchmove", stopScrolling, { passive: false });
        }, { passive: true });
        window.addEventListener("pointermove", event => {
            eventMove(event.clientX, event.clientY);
        }, { passive: true });
        window.addEventListener("pointerup", event => {
            eventEnd(event.clientX, event.clientY);
            preventStopScrolling = false;
            window.removeEventListener("touchmove", stopScrolling, { passive: false });
        }, { passive: true });
        window.addEventListener("pointercancel", event => {
            eventEnd(event.clientX, event.clientY);
            preventStopScrolling = false;
            window.removeEventListener("touchmove", stopScrolling, { passive: false });
        }, { passive: true });
    })(document.querySelector("#edit-details"));

    ($diffContainer => {
        const start = { done: false, dragging: false, x: 0, y: 0 };
        let stopScrollingAdded = false;
        const ensureStopScrolling = () => {
            if (!stopScrollingAdded) {
                window.addEventListener("touchmove", stopScrolling, { passive: false });
                stopScrollingAdded = true;
            }
        };
        const removeStopScrolling = () => {
            if (stopScrollingAdded) {
                window.removeEventListener("touchmove", stopScrolling, { passive: false });
                stopScrollingAdded = false;
            }
        };

        const eventStart = (x, y) => {
            start.done = false;
            start.dragging = true;
            start.x = x;
            start.y = y;
        };
        const eventMove = (x, y, event) => {
            if (!start.dragging || start.done)
                return;

            const deltaX = x - start.x, deltaY = y - start.y;
            if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10)
                return start.dragging = false;
            else if (Math.abs(deltaX) < Math.min(100, window.innerWidth * .1))
                return;

            start.done = true;
            if (deltaX > 0)
                ws.execute({
				    actions: [
					    {
						    name: "previous-item",
						    params: { }
					    },
                    ]
                });
            else
                ws.execute({
                    actions: [
                        {
                            name: "next-item",
                            params: { }
                        },
                    ]
                });

            userProvedWorthiness();
        };
        const eventEnd = (x, y) => {
            if (!start.dragging)
                return;

            start.dragging = false;
        };

        $diffContainer.addEventListener("pointerdown", event => {
            if (document.querySelectorAll(".tooltip.buttons").length)
                return;
            else if (event.target.closest("a"))
                return;
            eventStart(event.clientX, event.clientY);
        }, { passive: true });
        window.addEventListener("pointermove", event => {
            eventMove(event.clientX, event.clientY, event);
        }, { passive: true });
        window.addEventListener("pointerup", event => {
            eventEnd(event.clientX, event.clientY);
            removeStopScrolling();
        }, { passive: true });
        window.addEventListener("pointercancel", event => {
            eventEnd(event.clientX, event.clientY);
            removeStopScrolling();
        }, { passive: true });
    })(document.querySelector("#diff-container"));
};