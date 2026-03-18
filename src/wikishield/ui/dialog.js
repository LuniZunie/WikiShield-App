export class Dialog {
    constructor(ws) {
        this.ws = ws;

        this.dialogs = {
            processing: false,

            active: null,
            queue: [ ],
        };

        this.popups = [ ];

        addEventListener("focus", () => {
            if (this.popups.length > 0) {
                this.popups.forEach(popupId => electron.closePopup(popupId));
                this.popups = [];

                requestAnimationFrame(() => {
                    if (this.popups.length === 0)
                        document.querySelector("#popup-blocker")?.remove();
                });
            }
        });

        electron.onPopupClosed(popupId => {
            const index = this.popups.indexOf(popupId);
            if (index !== -1)
                this.popups.splice(index, 1);

            if (this.popups.length === 0)
                requestAnimationFrame(() => {
                    if (this.popups.length === 0)
                        document.querySelector("#popup-blocker")?.remove();
                });
        });
    }

    controller(event) {

    }

    check() {
        if (this.popups.length === 0)
            return requestAnimationFrame(() => {
                if (this.popups.length === 0)
                    document.querySelector("#popup-blocker")?.remove();
            });

        requestAnimationFrame(() => this.check());
    }

    toast(title, message, type = "default", duration = 5000) {
		const zen = this.ws.store.settings.zen_mode;
		if (zen.enabled && !zen.toasts.enabled)
			return false;

		const $toast = document.createElement("div");
		$toast.classList.add("toast-alert", type);

		const $icon = document.createElement("div");
		$icon.classList.add("toast-icon");
		$toast.appendChild($icon);

		const $i = document.createElement("i");
		$i.classList.add("fa");
		$icon.appendChild($i);
		switch (type) {
			case "success": {
				$i.classList.add("fa-check");
			} break;
			case "warning": {
				$i.classList.add("fa-exclamation-triangle");
			} break;
			case "error": {
				$i.classList.add("fa-xmark");
			} break;
			default: {
				$i.classList.add("fa-info-circle");
			} break;
		}

		const $content = document.createElement("div");
		$content.classList.add("toast-content");
		$toast.appendChild($content);

		const $title = document.createElement("div");
		$title.classList.add("toast-title");
		$title.textContent = title;
		$content.appendChild($title);

		const $message = document.createElement("div");
		$message.classList.add("toast-message");
		$message.textContent = message;
		$content.appendChild($message);

		const $close = document.createElement("div");
		$close.classList.add("toast-close");
		$close.addEventListener("click", () => {
			this.#hideToast($toast);
		});
		$toast.appendChild($close);

		const $closeIcon = document.createElement("i");
		$closeIcon.classList.add("fa", "fa-xmark");
		$close.appendChild($closeIcon);

		document.body.querySelector("#app").appendChild($toast);

		setTimeout(() => {
			this.ws.audio.playSound([ "notification", "toast" ]);
			$toast.classList.add("show");
		}, 10);
        if (duration > 0)
            setTimeout(() => this.#hideToast($toast), duration);

		return true;
	}

    #hideToast($toast) {
        if (!$toast?.parentElement)
            return;

        $toast.classList.add("hidden");
        setTimeout(() => {
            if ($toast.parentElement)
                $toast.remove();
        }, 300);
    }

    async #process() {
        if (this.dialogs.processing || this.dialogs.queue.length === 0)
            return;

        this.dialogs.processing = true;

        const { fn, resolve, reject } = this.dialogs.queue.shift();
        try {
            this.dialogs.active = true;

            const result = await fn();
            this.dialogs.active = null;
            resolve(result);
        } catch (e) {
            this.dialogs.active = null;
            reject(e);
        } finally {
            this.dialogs.processing = false;
            requestAnimationFrame(() => this.#process());
        }
    }

    #enqueue(fn, child = false) {
        return new Promise((resolve, reject) => {
            if (child && this.dialogs.active)
                return void(fn().then(resolve).catch(reject));

            this.dialogs.queue.push({ fn, child, resolve, reject });
            this.#process();
        });
    }

    #input(title, message, placeholder = "", defaultValue = "") {
        return new Promise(resolve => {
            const $overlay = document.createElement("div");
            $overlay.classList.add("confirmation-modal-overlay");
            document.body.querySelector("#app").appendChild($overlay);

            const $modal = document.createElement("div");
            $modal.classList.add("confirmation-modal");
            $overlay.appendChild($modal);

            const $header = document.createElement("div");
            $header.classList.add("confirmation-modal-header");
            $modal.appendChild($header);

            const $title = document.createElement("div");
            $title.classList.add("confirmation-modal-title");
            $title.textContent = title;
            $header.appendChild($title);

            const $body = document.createElement("div");
            $body.classList.add("confirmation-modal-body");
            $body.innerHTML = message;
            $modal.appendChild($body);

            const $input = document.createElement("input");
            $input.type = "text";
            $input.classList.add("confirmation-modal-input");
            $input.placeholder = placeholder;
            $input.value = defaultValue;
            $body.appendChild($input);
            $input.focus();
            $input.select();

            const $footer = document.createElement("div");
            $footer.classList.add("confirmation-modal-footer");
            $modal.appendChild($footer);

            const $cancel = document.createElement("button");
            $cancel.classList.add("confirmation-modal-button", "confirmation-modal-button-cancel");
            $cancel.style.setProperty("--background", "211, 51, 51");
            $cancel.textContent = "Cancel";
            $footer.appendChild($cancel);

            const $submit = document.createElement("button");
            $submit.classList.add("confirmation-modal-button", "confirmation-modal-button-submit");
            $submit.style.setProperty("--background", "51, 153, 211");
            $submit.textContent = "Submit";
            $footer.appendChild($submit);

            const closeModal = result => {
                document.removeEventListener("keydown", keyHandler, true);

                $overlay.classList.add("closing");
                $modal.classList.add("closing");

                setTimeout(() => {
                    $overlay.remove();
                    resolve(result);
                }, 200);
            };

            const keyHandler = event => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.stopPropagation();

					closeModal($input.value);

					return false;
				} else if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();

					closeModal(null);

					return false;
				} else if (event.key !== "Tab") {
					if (event.target.tagName === "INPUT")
						return;

					event.preventDefault();
					event.stopPropagation();

					return false;
				}
			};
			document.addEventListener("keydown", keyHandler, true);

            $cancel.addEventListener("click", () => closeModal(null));
            $submit.addEventListener("click", () => closeModal($input.value));

            $overlay.addEventListener("click", e => {
                if (e.target === $overlay)
                    closeModal(null);
            });
        });
    }
    input(title, message, placeholder = "", defaultValue = "", child = false) {
        return this.#enqueue(() => this.#input(title, message, placeholder, defaultValue), child);
    }

    #UAA(username) {
        return new Promise(resolve => {
            const closeModal = result => {
                document.removeEventListener("keydown", keyHandler, true);

                $overlay.classList.add("closing");
                $modal.classList.add("closing");

                setTimeout(() => {
                    $overlay.remove();
                    resolve(result);
                }, 200);
            };

            const keyHandler = event => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();

					closeModal(null);

					return false;
				} else if (event.key !== "Tab") {
					if (event.target.tagName === "INPUT")
						return;

					event.preventDefault();
					event.stopPropagation();

					return false;
				}
			};
			document.addEventListener("keydown", keyHandler, true);

            const $overlay = document.createElement("div");
            $overlay.classList.add("confirmation-modal-overlay");
            document.body.querySelector("#app").appendChild($overlay);

            const $modal = document.createElement("div");
            $modal.classList.add("confirmation-modal");
            $overlay.appendChild($modal);

            const $header = document.createElement("div");
            $header.classList.add("confirmation-modal-header");
            $modal.appendChild($header);

            const $title = document.createElement("div");
            $title.classList.add("confirmation-modal-title");
            $title.textContent = "Report to UAA";
            $header.appendChild($title);

            const $body = document.createElement("div");
            $body.classList.add("confirmation-modal-body");
            $body.innerHTML = "Select reason for reporting <span class='confirmation-modal-username'></span> to UAA:";
            $modal.appendChild($body);
            $body.querySelector(".confirmation-modal-username").textContent = username;

            const $footer = document.createElement("div");
            $footer.classList.add("confirmation-modal-footer", "confirmation-modal-footer-vertical");
            $modal.appendChild($footer);

            [ "Disruptive", "Offensive", "Promotional", "Misleading" ].forEach(reason => {
                const text = `${reason} username`;

                const $button = document.createElement("button");
                $button.classList.add("confirmation-modal-button", "confirmation-modal-button-reason");
                $button.textContent = text;
                $button.addEventListener("click", () => closeModal(text));
                $footer.appendChild($button);
            });

            const $cancel = document.createElement("button");
            $cancel.classList.add("confirmation-modal-button", "confirmation-modal-button-cancel");
            $cancel.style.setProperty("--background", "211, 51, 51");
            $cancel.textContent = "Cancel";
            $cancel.addEventListener("click", () => closeModal(null));
            $footer.appendChild($cancel);

            $overlay.addEventListener("click", event => {
                if (event.target === $overlay)
                    closeModal(null);
            });
        });
    }
    UAA(username, child = false) {
        return this.#enqueue(() => this.#UAA(username), child);
    }

    #confirm(title, message, username = null, hideUAA = false) {
        return new Promise(resolve => {
            const closeModal = result => {
                document.removeEventListener("keydown", keyHandler, true);

                $overlay.classList.add("closing");
                $modal.classList.add("closing");

                setTimeout(() => {
                    $overlay.remove();
                    resolve(result);
                }, 200);
            };

            const keyHandler = event => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();

					closeModal(null);

					return false;
				} else if (event.key !== "Tab") {
					if (event.target.tagName === "INPUT")
						return;

					event.preventDefault();
					event.stopPropagation();

					return false;
				}
			};
			document.addEventListener("keydown", keyHandler, true);

            const $overlay = document.createElement("div");
            $overlay.classList.add("confirmation-modal-overlay");
            document.body.querySelector("#app").appendChild($overlay);

            const $modal = document.createElement("div");
            $modal.classList.add("confirmation-modal");
            $overlay.appendChild($modal);

            const $header = document.createElement("div");
            $header.classList.add("confirmation-modal-header");
            $modal.appendChild($header);

            const $title = document.createElement("div");
            $title.classList.add("confirmation-modal-title");
            $title.textContent = title;
            $header.appendChild($title);

            const $body = document.createElement("div");
            $body.classList.add("confirmation-modal-body");
            $body.innerHTML = message;
            $modal.appendChild($body);

            const $footer = document.createElement("div");
            $footer.classList.add("confirmation-modal-footer");
            $modal.appendChild($footer);

            if (username && !hideUAA) {
                const $uaa = document.createElement("button");
                $uaa.classList.add("confirmation-modal-button", "confirmation-modal-button-uaa");
                $uaa.style.setProperty("--background", "211, 51, 51");
                $uaa.textContent = "Report to UAA";
                $footer.appendChild($uaa);
                $uaa.addEventListener("click", () => {
                    document.removeEventListener("keydown", keyHandler, true);

                    $overlay.classList.add("closing");
                    $modal.classList.add("closing");

                    setTimeout(async () => {
                        $overlay.remove();

                        const reason = await this.UAA(username, true);
                        if (reason)
                            this.ws.execute({
                                name: "reportToUAA",
                                params: {
                                    reportMessage: reason,
                                }
                            }, undefined, undefined, { user: { name: username } }); // fake edit object
                        else
                            resolve(await this.confirm(title, message, username, false, true));
                    }, 200);
                });
            }

            const $right = document.createElement("div");
            $right.classList.add("confirmation-modal-footer-right");
            $footer.appendChild($right);

            const $no = document.createElement("button");
            $no.classList.add("confirmation-modal-button", "confirmation-modal-button-no");
            $no.textContent = "No";
            $no.addEventListener("click", () => closeModal(false));
            $right.appendChild($no);

            const $yes = document.createElement("button");
            $yes.classList.add("confirmation-modal-button", "confirmation-modal-button-yes");
            $yes.style.setProperty("--background", "51, 102, 204");
            $yes.textContent = "Yes";
            $yes.addEventListener("click", () => closeModal(true));
            $right.appendChild($yes);

            $overlay.addEventListener("click", e => {
                if (e.target === $overlay)
                    closeModal(null);
            });

            requestAnimationFrame(() => $yes.focus());
        });
    }
    confirm(title, message, username = null, hideUAA = false, child = false) {
        return this.#enqueue(() => this.#confirm(title, message, username, hideUAA), child);
    }
}