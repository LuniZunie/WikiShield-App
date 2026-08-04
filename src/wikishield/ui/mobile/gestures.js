const stopScrolling = event => {
    if (event.cancelable)
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
                if ($editDetails.classList.contains("expanded"))
                    $editDetails.style.height = `${Math.max(maxHeight - deltaY, 75)}px`;
            } else {
                if (!$editDetails.classList.contains("expanded"))
                    $editDetails.style.height = `${Math.min(75 - deltaY, maxHeight)}px`;
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

            if (delta < 30)
                return $editDetails.classList.toggle("expanded");

            const maxHeight = window.innerHeight * .4;
            if ($editDetails.classList.contains("expanded")) {
                if (deltaY > maxHeight / 2)
                    $editDetails.classList.remove("expanded");
            } else {
                if (deltaY < -maxHeight / 2)
                    $editDetails.classList.add("expanded");
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
            window.removeEventListener("touchmove", stopScrolling, { passive: false });
        }, { passive: true });
        window.addEventListener("pointercancel", event => {
            eventEnd(event.clientX, event.clientY);
            window.removeEventListener("touchmove", stopScrolling, { passive: false });
        }, { passive: true });
    })(document.querySelector("#edit-details"));

    ($diffContainer => {
        const start = { dragging: false, x: 0, y: 0 };
        let _stopScrollingAdded = false;
        const ensureStopScrolling = () => {
            if (!_stopScrollingAdded) {
                window.addEventListener("touchmove", stopScrolling, { passive: false });
                _stopScrollingAdded = true;
            }
        };
        const removeStopScrolling = () => {
            if (_stopScrollingAdded) {
                window.removeEventListener("touchmove", stopScrolling, { passive: false });
                _stopScrollingAdded = false;
            }
        };

        const eventStart = (x, y) => {
            start.dragging = true;
            start.x = x;
            start.y = y;
        };
        const eventEnd = (x, y) => {
            if (!start.dragging)
                return;

            start.dragging = false;

            const deltaX = x - start.x;
            if (Math.abs(deltaX) < Math.min(100, window.innerWidth * .1))
                return;

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
        };

        const eventMove = (x, y, event) => {
            if (!start.dragging)
                return;

            const deltaX = x - start.x;
            const deltaY = y - start.y;

            if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
                start.dragging = false;
                return;
            }

            if (event && event.pointerType === "touch")
                ensureStopScrolling();
        };

        $diffContainer.addEventListener("pointerdown", event => {
            if (document.querySelectorAll(".tooltip.buttons").length)
                return;
            else if (event.target.closest("a"))
                return;
            else if (window.getSelection().toString().trim().length)
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