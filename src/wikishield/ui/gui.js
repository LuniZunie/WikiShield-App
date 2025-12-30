import { WikiShield } from "../core/wikishield.js";

import { Dialog } from "./dialog.js";
import { EventManager } from "../core/event-manager.js";
import { Settings } from "./settings.js";
import { Queue } from "../core/queue.js";
import { warnings, warningsLookup, warningTemplateColors, getWarningFromLookup } from "../data/warnings.js";
import { profanity } from "../data/profanity.js";
import { generateRandomUUID } from "../utils/UUID.js";
import { BuildPalette } from "../utils/build-palette.js";

export class GUI {
	static palettes = {
		// matplotlib-plasma
		traffic: BuildPalette(1000, "#78c675", "#fdff7a", "#fcff54", "#fbff12", "#ffc619", "#ff8812", "#f56214", "#f73214", "#fc0303", "#fc0303"),
		magma: BuildPalette(1000, "#000004", "#1b0c41", "#4a0c6b", "#781c6d", "#a52c60", "#cf4446", "#ed6925", "#fb9b06", "#f7d13d", "#fcffa4"),
		plasma: BuildPalette(1000, "#0d0887", "#46039f", "#7201a8", "#9c179e", "#bd3786", "#d8576b", "#ed7953", "#fb9f3a", "#fdca26", "#f0f921"),
		viridis: BuildPalette(1000, "#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"),
		natural: BuildPalette(1000, "#ffffff", "#18ff18"),
		cool: BuildPalette(1000, "#ffffff", "#1818ff"),
		heat: BuildPalette(1000, "#ffffff", "#ff1818"),
		grey: BuildPalette(1000, "#000000", "#ffffff"),
	}

	constructor(ws) {
		this.ws = ws;

		this.newerRevisionInterval = null;

		this.dialog = new Dialog(this.ws);
		this.events = new EventManager(this.ws);
		this.settings = new Settings(this.ws);

		this.intervals = {
			outdated: null,
		};

		this.controllers = {
			current: null,
		};
	}

	async build() {
		document.querySelector("#initial").classList.remove("hidden");
		document.querySelectorAll(".VERSION").forEach(elem => elem.textContent = WikiShield.config.version);

		const controller = new AbortController();
		this.ws.audio.playSound([ "startup" ], controller.signal);

		let animationFrame;
		const startupPerformance = this.ws.store.settings.performance.startup;
		if (startupPerformance !== "always_off") {
			const paper = document.getElementById("dots-canvas");
			const pen = paper.getContext("2d");

			const DPR = Math.min(window.devicePixelRatio || 1, 2);
			class Dot {
				static dots = [ ];
				static target = 0;

				static colors = [
					'102, 126, 234',  // Blue
					'240, 147, 251',  // Pink
					'118, 75, 162',   // Purple
					'217, 70, 239'    // Magenta
				];

				radius = 2;
				constructor() {
					this.x = Math.random() * paper.width;
					this.y = Math.random() * paper.height;

					this.vx = (Math.random() - 0.5) * 0.5;
					this.vy = (Math.random() - 0.5) * 0.5;

					this.color = Dot.colors[Math.random() * Dot.colors.length | 0];
					this.fill = `rgba(${this.color}, 0.8)`;
					this.shadow = `rgba(${this.color}, 0.8)`;
				}

				update() {
					this.x += this.vx;
					this.y += this.vy;

					if (this.x < 0)
						this.x = paper.width;
					else if (this.x > paper.width)
						this.x = 0;

					if (this.y < 0)
						this.y = paper.height;
					else if (this.y > paper.height)
						this.y = 0;
				}

				draw() {
					pen.beginPath();

					pen.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

					pen.fillStyle = this.fill;
					pen.fill();
				}
			}

			let resizeRAF = null;
			const resizeCanvas = () => {
				if (resizeRAF)
					return;
				resizeRAF = requestAnimationFrame(() => {
					resizeRAF = null;
					const oldWidth = paper.width;
					const oldHeight = paper.height;

					paper.width = Math.floor(window.innerWidth * DPR);
					paper.height = Math.floor(window.innerHeight * DPR);
					paper.style.width = `${window.innerWidth}px`;
					paper.style.height = `${window.innerHeight}px`;

					pen.setTransform(1, 0, 0, 1, 0, 0);
					pen.scale(DPR, DPR);

					const scaleX = paper.width / (oldWidth || paper.width);
					const scaleY = paper.height / (oldHeight || paper.height);

					Dot.dots.forEach(dot => {
						dot.x *= scaleX;
						dot.y *= scaleY;
					});

					Dot.target = Math.floor((window.innerWidth * window.innerHeight) / 7000);
					Dot.target = Math.max(40, Math.min(250, Dot.target));

					if (Dot.target > Dot.dots.length)
						for (let i = Dot.dots.length; i < Dot.target; i++)
							Dot.dots.push(new Dot());
					else if (Dot.target < Dot.dots.length)
						Dot.dots.length = Dot.target;
				});
			};
			resizeCanvas();
			window.addEventListener('resize', resizeCanvas);

			const GRID_SIZE = 160;

			const LOW_FPS_THRESHOLD = 30;
			const LOW_FPS_DURATION_MS = 500;

			let lowFPSStart = null;
			let lastTimestamp = performance.now();
			const lastDeltaTimes = new Array(15).fill(1000 / 60);

			const animate = () => {
				{
					const now = performance.now();

					const deltaTime = now - lastTimestamp;
					lastTimestamp = now;

					lastDeltaTimes.shift();
					lastDeltaTimes.push(deltaTime);

					const noOutliers = [ ...lastDeltaTimes ].sort((a, b) => a - b).slice(2, -2);

					const averageDeltaTime = noOutliers.reduce((a, b) => a + b, 0) / noOutliers.length;
					const FPS = 1000 / averageDeltaTime;

					if (startupPerformance === "adaptive") {
						if (FPS < LOW_FPS_THRESHOLD) {
							if (lowFPSStart === null)
								lowFPSStart = now;

							if (now - lowFPSStart >= LOW_FPS_DURATION_MS) {
								if (animationFrame)
									window.cancelAnimationFrame(animationFrame);
								animationFrame = null;

								pen.clearRect(0, 0, paper.width, paper.height);

								return;
							}
						} else
							lowFPSStart = null;

						if (FPS < 45 && Dot.dots.length > 60) {
							Dot.dots.length = Math.max(60, Math.floor(Dot.dots.length * 0.9));
							Dot.target = Dot.dots.length;
						}
					}
				}

				pen.clearRect(0, 0, paper.width, paper.height);

				Dot.dots.forEach(dot => {
					dot.update();
					dot.draw();
				});

				const cols = Math.ceil(window.innerWidth / GRID_SIZE);
				const rows = Math.ceil(window.innerHeight / GRID_SIZE);
				const grid = new Array(cols * rows);
				for (let i = 0; i < grid.length; i++)
					grid[i] = [ ];

				Dot.dots.forEach((d, index) => {
					const cx = Math.max(0, Math.min(cols - 1, Math.floor(d.x / GRID_SIZE)));
					const cy = Math.max(0, Math.min(rows - 1, Math.floor(d.y / GRID_SIZE)));
					grid[cy * cols + cx].push(index);
				});

				const linkRange = 150;
				const halfW = window.innerWidth / 2;
				const halfH = window.innerHeight / 2;
				for (let cy = 0; cy < rows; cy++) {
					for (let cx = 0; cx < cols; cx++) {
						const cellIdx = cy * cols + cx;
						const indices = grid[cellIdx];
						if (indices.length === 0)
							continue;

						for (let nyOff = -1; nyOff <= 1; nyOff++) {
							const ny = (cy + nyOff + rows) % rows;
							for (let nxOff = -1; nxOff <= 1; nxOff++) {
								const nx = (cx + nxOff + cols) % cols;
								const nIdx = ny * cols + nx;
								const neighbors = grid[nIdx];
								if (neighbors.length === 0)
									continue;

								for (let ii = 0; ii < indices.length; ii++) {
									const a = Dot.dots[indices[ii]];
									for (let jj = 0; jj < neighbors.length; jj++) {
										const bi = neighbors[jj];
										if (bi <= indices[ii])
											continue;
										const b = Dot.dots[bi];

										let dx = a.x - b.x;
										let dy = a.y - b.y;

										if (dx > halfW)
											dx -= window.innerWidth;
										if (dx < -halfW)
											dx += window.innerWidth;

										if (dy > halfH)
											dy -= window.innerHeight;
										if (dy < -halfH)
											dy += window.innerHeight;

										const dist2 = dx * dx + dy * dy;
										if (dist2 < linkRange * linkRange) {
											const distance = Math.sqrt(dist2);
											const opacity = (1 - distance / linkRange) * 0.4;

											const aSplit = a.color.split(',');
											const bSplit = b.color.split(',');
											const avgR = (parseInt(aSplit[0]) + parseInt(bSplit[0])) / 2;
											const avgG = (parseInt(aSplit[1]) + parseInt(bSplit[1])) / 2;
											const avgB = (parseInt(aSplit[2]) + parseInt(bSplit[2])) / 2;

											pen.beginPath();

											pen.moveTo(a.x, a.y);
											pen.lineTo(a.x - dx, a.y - dy);

											pen.lineWidth = 1;
											pen.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${opacity})`;
											pen.stroke();
										}
									}
								}
							}
						}
					}
				}

				animationFrame = window.requestAnimationFrame(animate);
			};

			animate();
		}

		if (this.ws.rights.rollback) {
			document.querySelector("#rollback-needed").classList.add("hidden");
			document.querySelector("#start-button").classList.remove("hidden");
		} else {
			document.querySelector("#rollback-needed").classList.remove("hidden");
			document.querySelector("#start-button").classList.add("hidden");
		}

		document.querySelector("#start-button").addEventListener("click", () => {
			controller.abort();
			this.ws.audio.playSound([ "ui", "click" ]);

			if (animationFrame)
				cancelAnimationFrame(animationFrame);
			this.ws.start();
		});
	}

	async start() {
		this.settings.start();

		document.querySelector("#initial").classList.add("hidden");
		document.querySelector("#app").classList.remove("hidden");

		document.querySelectorAll(".bottom-tool-trigger").forEach($trigger => {
			$trigger.addEventListener("click", (e) => {
				e.stopPropagation();

				const $item = $trigger.closest(".bottom-tool-item");
				const $menu = document.querySelector(`#${$item.dataset.menu}-menu`);
				const isOpen = $menu.classList.contains("show");

				switch ($item.dataset.menu) {
					case "revert": {
						$menu.innerHTML = "";
						this.createRevertMenu("reverts", $menu, this.ws.queue.current.item);
					} break;
					case "warn": {
						$menu.innerHTML = "";
						this.createRevertMenu("warnings", $menu, this.ws.queue.current.item);
					} break;
					case "page": {
						const item = this.ws.queue.current.item;
						const watched = item?.page?.watched === true;

						document.querySelector("#page-watch").classList.toggle("hidden", watched);
						document.querySelector("#page-unwatch").classList.toggle("hidden", !watched);
					} break;
				}

				this.closeMenus();

				if (!isOpen) {
					$menu.classList.add("show");
					$trigger.classList.add("active");

					this.positionBottomMenu($item, $menu);
				}
			});
		});

		document.querySelectorAll(".submenu-trigger").forEach($trigger => {
			let exited = generateRandomUUID();
			$trigger.addEventListener("mouseenter", () => {
				exited = null;

				const $parentMenu = $trigger.closest(".bottom-tool-menu");
				if ($parentMenu) {
					$parentMenu.querySelectorAll(".submenu").forEach($submenu => $submenu.classList.remove("show"));
				}

				const $submenu = $trigger.querySelector(".submenu");
				if ($submenu) {
					this.events.submenu($submenu, $submenu.dataset.eventName);
					$submenu.classList.add("show");
					this.positionSubmenu($submenu, $trigger);
				}
			});

			$trigger.addEventListener("mouseleave", () => {
				const UUID = generateRandomUUID();
				exited = UUID;

				window.setTimeout(() => {
					if (exited !== UUID)
						return;

					const $submenu = $trigger.querySelector(".submenu");
					if ($submenu)
						$submenu.classList.remove("show");
				}, 500);
			});
		});

		document.querySelectorAll(".menu-option:not(.submenu-trigger)").forEach($option => {
			$option.addEventListener("click", () => this.closeMenus());
		});

		document.querySelectorAll(".submenu").forEach($submenu => {
			$submenu.addEventListener("click", e => e.stopPropagation());
		});

		document.querySelectorAll("#queue-tabs > .queue-tab").forEach($el => this.addTooltipListener($el));

		{
			const types = [ "alert", "message" ];
			types.forEach(type => {
				const $icon = document.querySelector(`#${type}s-icon`);
				this.addTooltipListener($icon);
				$icon.addEventListener("click", () => {
					const $panel = document.querySelector(`#${type}s-panel`);
					$panel.classList.toggle("show");
					if ($panel.classList.contains("show"))
						this.ws.notifications.seen(type);
				});
				document.querySelector(`#mark-all-${type}s-read`).addEventListener("click", e => {
					this.ws.notifications.read(type);
				});
			});
			document.addEventListener("click", e => {
				for (const type of types) {
					const $panel = document.querySelector(`#${type}s-panel`);
					const $icon = document.querySelector(`#${type}s-icon`);
					if (!$panel?.contains(e.target) && !$icon?.contains(e.target))
						$panel?.classList.remove("show");
				}

				if (!e.target.closest(".bottom-tool-menu"))
					this.closeMenus();
			});
		}

		const $latest = document.querySelector("#latest-edits-tab");
		$latest.addEventListener("click", () => this.updateDiffDisplay(this.ws.queue.current.item, false));
		this.addTooltipListener($latest);

		const $consecutive = document.querySelector("#consecutive-edits-tab");
		$consecutive.addEventListener("click", () => this.updateDiffDisplay(this.ws.queue.current.item, true));
		this.addTooltipListener($consecutive);

		document.querySelector("#pending-changes-container > .accept").addEventListener("click", async e => {
			await this.ws.gui.settings.waitForClose();
			const message = await this.dialog.input(
				"Accept Pending Changes",
				"Enter an optional edit summary for accepting this change:",
				"Edit summary (optional)",
				""
			);
			if (message !== null)
				this.ws.execute({
					actions: [
						{
							name: "next-item",
							params: { }
						},
						{
							name: "accept-pending-edit",
							params: {
								reason: message
							}
						}
					]
				});
		});
		document.querySelector("#pending-changes-container > .reject").addEventListener("click", async e => {
			await this.ws.gui.settings.waitForClose();
			const message = await this.dialog.input(
				"Reject Pending Changes",
				"Enter an optional edit summary for rejecting this change:",
				"Edit summary (optional)",
				""
			);
			if (message !== null)
				this.ws.execute({
					actions: [
						{
							name: "next-item",
							params: { }
						},
						{
							name: "reject-pending-edit",
							params: {
								reason: message
							}
						}
					]
				});
		});

		document.querySelectorAll("#bottom-tools [data-tooltip]").forEach($el => this.addTooltipListener($el));

		{
			const $queue = document.querySelector("#queue");
			{
				const width = this.ws.store.UI.queue.width;
				if (width) {
					$queue.style.width = width;
					document.querySelector("#right-container").style.width = `calc(100% - ${width})`;
				}
			}

			const $details = document.querySelector("#right-details");
			{
				const width = this.ws.store.UI.details.width;
				if (width) {
					$details.style.width = width;
					document.querySelector("#right-top").style.width = width;
					document.querySelector("#main-container").style.width = `calc(100% - ${width})`;
					document.querySelector("#middle-top").style.width = `calc(100% - ${width})`;
				}
			}

			const resize = {
				active: null,
				section: null,

				x: null,
				width: null,

				windowWidth: null
			};
			const startResize = ($handle, $section, e) => {
				e.preventDefault();

				resize.active = $handle;
				resize.section = $section;

				resize.x = e.clientX;
				resize.width = $section.getBoundingClientRect().width;

				resize.windowWidth = window.innerWidth;
			};

			const $queueHandle = document.querySelector("#queue-width-adjust");
			$queueHandle.addEventListener("pointerdown", e => startResize($queueHandle, $queue, e));

			const $detailsHandle = document.querySelector("#details-width-adjust");
			$detailsHandle.addEventListener("pointerdown", e => startResize($detailsHandle, $details, e));

			window.addEventListener("pointerup", () => {
				if (resize.active === $queueHandle)
					this.ws.store.UI.queue.width = $queue.style.width;
				else if (resize.active === $detailsHandle)
					this.ws.store.UI.details.width = $details.style.width;

				resize.active = null;
				resize.section = null;
			});

			window.addEventListener("pointermove", e => {
				if (!resize.active)
					return;

				const dx = e.clientX - resize.x;

				let newWidth;
				if (resize.active === $queueHandle)
					newWidth = resize.width + dx;
				else if (resize.active === $detailsHandle)
					newWidth = resize.width - dx;

				const min = resize.windowWidth * 0.1; // 10vw
				const max = resize.windowWidth * 0.3; // 30vw
				newWidth = Math.max(min, Math.min(max, newWidth));

				const vw = (newWidth / resize.windowWidth) * 100;
				resize.section.style.width = `${vw}vw`;

				if (resize.active === $queueHandle)
					document.querySelector("#right-container").style.width = `calc(100% - ${vw}vw)`;
				else if (resize.active === $detailsHandle) {
					document.querySelector("#right-top").style.width = `${vw}vw`;
					document.querySelector("#main-container").style.width = `calc(100% - ${vw}vw)`;
					document.querySelector("#middle-top").style.width = `calc(100% - ${vw}vw)`;
				}
			});
		}

		window.addEventListener("click", event => {
			[...document.querySelectorAll(".tooltip.buttons")].forEach(elem => elem.remove());

			const $href = event.target.closest("[href]");
			if ($href) {
				const url = new URL($href.href, window.location.href);
				if (url.origin === window.location.origin && url.pathname === window.location.pathname)
					return;

				if ($href.dataset.multipleHrefs) {
					try {
						const [ type, values ] = $href.dataset.multipleHrefs.split(";");
						const items = Object.fromEntries(values.split("&").map(keyValue => {
							const [ key, value ] = keyValue.split("=");
							return [ key, decodeURIComponent(value) ];
						}));

						switch (type) {
							case "page": {
								const title = items.title;
								const id = +items.id;

								this.createTooltip($href, "buttons", null, null, null, $tooltip => {
									const $page = document.createElement("div");
									$page.classList.add("button");
									$page.innerText = "Page";
									$page.addEventListener("click", event => {
										this.ws.open(this.ws.page(title), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($page);

									const $preview = document.createElement("div");
									$preview.classList.add("button");
									$preview.innerText = "Revision";
									$preview.addEventListener("click", event => {
										this.ws.open(this.ws.page(`Special:Permalink/${id}`), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($preview);

									const $history = document.createElement("div");
									$history.classList.add("button");
									$history.innerText = "Diff";
									$history.addEventListener("click", event => {
										this.ws.open(this.ws.page(`Special:Diff/${id}`), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($history);
								});
							} break;
							case "log": {
								const title = items.title;
								const log = JSON.parse(items.log);

								this.createTooltip($href, "buttons", null, null, null, $tooltip => {
									const $page = document.createElement("div");
									$page.classList.add("button");
									$page.innerText = "Page";
									$page.addEventListener("click", event => {
										this.ws.open(this.ws.page(title), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($page);

									const $preview = document.createElement("div");
									$preview.classList.add("button");
									$preview.innerText = "Log";
									$preview.addEventListener("click", event => {
										const page = this.ws.page(`Special:Log/${encodeURIComponent(log.user)}?page=${encodeURIComponent(title)}&type=${log.type}&wptime=${log.timestamp}&limit=1`, false, false);
										const popup = this.ws.open(page, event.altKey);
										$tooltip.remove();

										popup.addEventListener("load", () => {
											popup.scroll({ behavior: 'smooth', top: popup.document.body.scrollHeight });
										}, { once: true });
									});
									$tooltip.appendChild($preview);
								});
							} break;
							case "user": {
								const username = items.name;

								this.createTooltip($href, "buttons", null, null, null, $tooltip => {
									const $preview = document.createElement("div");
									$preview.classList.add("button");
									$preview.innerText = "User talk";
									$preview.addEventListener("click", event => {
										this.ws.open(this.ws.page(`User talk:${username}`), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($preview);

									const $history = document.createElement("div");
									$history.classList.add("button");
									$history.innerText = "User contribs";
									$history.addEventListener("click", event => {
										this.ws.open(this.ws.page(`Special:Contribs/${username}`), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($history);

									const $page = document.createElement("div");
									$page.classList.add("button");
									$page.innerText = "User page";
									$page.addEventListener("click", event => {
										this.ws.open(this.ws.page(`User:${username}`), event.altKey);
										$tooltip.remove();
									});
									$tooltip.appendChild($page);
								});
							} break;
						}
					} catch (error) {
						this.ws.open($href.getAttribute("href"), event.altKey);
					} finally {
						event.preventDefault();
					}
				} else {
					this.ws.open($href.getAttribute("href"), event.altKey);
				}
			}
		});

		const version = WikiShield.config.changelog.version;
		if (version.endsWith("!") || version !== this.ws.store.changelog) {
			this.ws.store.changelog = version.replace(/!$/, "");
			window.electronAPI.open?.("changelog");
		}

		this.updateZenMode();
		this.reorderQueues();
		this.newCurrentItem(null);

		this.events.button(document.querySelector("#user-open-user-page"), "open-user-page");
		this.events.button(document.querySelector("#user-open-user-talk"), "open-user-talk");
		this.events.button(document.querySelector("#user-view-contribs"), "open-user-contributions");
		this.events.button(document.querySelector("#user-view-filter-log"), "open-filter-log");
		this.events.button(document.querySelector("#user-whitelist"), "whitelist-user");
		this.events.button(document.querySelector("#user-unwhitelist"), "unwhitelist-user");
		this.events.button(document.querySelector("#user-highlight"), "highlight-user");
		this.events.button(document.querySelector("#user-unhighlight"), "unhighlight-user");
		this.events.submenu(document.querySelector("#user-report-aiv .submenu"), "report-user-to-aiv");
		this.events.submenu(document.querySelector("#user-report-uaa .submenu"), "report-user-to-uaa");
		this.events.submenu(document.querySelector("#user-welcome .submenu"), "welcome-user");

		this.events.button(document.querySelector("#page-open-page"), "open-page");
		this.events.button(document.querySelector("#page-open-talk"), "open-page-talk");
		this.events.button(document.querySelector("#page-watch"), "watch-page");
		this.events.button(document.querySelector("#page-unwatch"), "unwatch-page");
		this.events.button(document.querySelector("#page-whitelist"), "whitelist-page");
		this.events.button(document.querySelector("#page-unwhitelist"), "unwhitelist-page");
		this.events.button(document.querySelector("#page-highlight"), "highlight-page");
		this.events.button(document.querySelector("#page-unhighlight"), "unhighlight-page");
		this.events.submenu(document.querySelector("#page-request-protection .submenu"), "request-page-protection");
		this.events.button(document.querySelector("#page-view-history"), "open-page-history");

		this.events.button(document.querySelector("#edit-view-revision"), "open-revision");
		this.events.button(document.querySelector("#edit-view-diff"), "open-diff");
		this.events.button(document.querySelector("#edit-thank-user"), "thank-user");
		this.events.submenu(document.querySelector("#edit-rollback .submenu"), "rollback-edit");
		this.events.submenu(document.querySelector("#edit-rollback-goodfaith .submenu"), "rollback-goodfaith-edit");
		this.events.submenu(document.querySelector("#edit-undo .submenu"), "undo-edit");

		Queue.types.forEach(type => {
			this.events.button(document.querySelector(`#queue-tab-${type}`), `switch-to-${type}-queue`);
		});

		this.update();
		this.renderQueue();

		setInterval(this.loading.bind(this), 300);
	}

	update() {
		try {
			document.querySelectorAll("[data-time]").forEach($el => {
				const timestamp = new Date($el.dataset.time);
				switch ($el.dataset.timeFormat) {
					case "time-ago": {
						$el.textContent = this.ws.util.timeAgo(timestamp);
					} break;
					case "notification": {
						$el.textContent = this.ws.util.formatNotificationTime(timestamp);
					} break;
				}
			});
		} catch (error) {
			console.error("Error updating time elements:", error);
		}

		requestAnimationFrame(() => this.update());
	}

	loading() {
		try {
			document.querySelectorAll(".loading-dots").forEach($el => {
				const text = $el.textContent;
				const dotCount = (text.match(/\./g) || []).length;
				if (dotCount >= 3)
					$el.textContent = text.slice(0, -3);
				else
					$el.textContent += ".";
			});
		} catch (error) {
			console.error("Error in loading indicator update:", error);
		}
	}

	generateItemHTML(item) {
		const highlight = this.ws.store.highlight;

		const $item = document.createElement("div");

		const $content = document.createElement("div");
		$content.classList.add("queue-item-content");
		$item.appendChild($content);

		const $user = document.createElement("div");
		{
			$user.classList.add("queue-item-user");
			$user.classList.toggle("queue-highlight", highlight.users.has(item.user.name));
			$user.classList.toggle("queue-user-empty-talk", item.user.talk === undefined);
			$user.dataset.tooltip = item.user.name;
			$user.dataset.tooltipDelay = 500;
			$content.appendChild($user);

			const $icon = document.createElement("span");
			$icon.classList.add("fa", "fa-user", "queue-item-icon");
			$user.prepend($icon);

			const $name = document.createElement("span");
			$name.classList.toggle("user-blocked", item.user.blocked ?? false);
			$name.textContent = item.user.name;
			$user.appendChild($name);
		}

		const $time = document.createElement("div");
		{
			$time.classList.add("queue-item-time");
			$time.dataset.tooltip = new Date(item.timestamp).toLocaleString();
			$time.dataset.tooltipDelay = 500;
			$content.appendChild($time);

			const $icon = document.createElement("span");
			$icon.classList.add("fa", "fa-clock", "queue-item-icon");
			$time.prepend($icon);

			const $relative = document.createElement("span");
			$relative.dataset.time = item.timestamp;
			$relative.dataset.timeFormat = "time-ago";
			$relative.textContent = this.ws.util.timeAgo(item.timestamp);
			$time.appendChild($relative);
		}

		if (Array.isArray(item.tags)) {
			const $tags = document.createElement("div");
			{
				$tags.classList.add("queue-item-tags");
				$tags.dataset.tooltip = item.tags.join(", ");
				$tags.dataset.tooltipDelay = 500;
				$content.appendChild($tags);
			}

			item.tags.sort((a, b) => highlight.tags.has(a) - highlight.tags.has(b)); // TODO check if this is correct
			for (const tag of item.tags) {
				const $tag = document.createElement("span");
				$tag.classList.add("queue-item-tag");
				$tag.classList.toggle("queue-highlight", highlight.tags.has(tag));
				$tag.textContent = tag;
				$tags.appendChild($tag);
			}
		}

		switch (Queue.groups[item.type]) {
			case "edit": {
				const $ores = document.createElement("div");
				{
					$ores.classList.add("queue-item-color");
					$ores.dataset.oresScore = `${Math.round((item.ores || 0) * 100)}%`;
					$ores.dataset.rawOresScore = item.ores || 0;
					$ores.style.backgroundColor = this.getORESColor(item.ores);
					$item.prepend($ores);
				}

				const $title = document.createElement("div");
				{
					$title.classList.add("queue-item-title");
					$title.classList.toggle("queue-highlight", highlight.pages.has(item.page.title));
					$title.dataset.tooltip = item.page.title;
					$title.dataset.tooltipDelay = 500;
					$title.textContent = item.page.title;
					$content.prepend($title);

					const $icon = document.createElement("span");
					$icon.classList.add("fa", "fa-file-lines", "queue-item-icon");
					$title.prepend($icon);
				}

				const $summary = document.createElement("div");
				{
					$summary.classList.add("queue-item-summary");
					$content.insertBefore($summary, $time);

					if (item.comment) {
						$summary.dataset.tooltip = item.comment;
						$summary.dataset.tooltipDelay = 500;
						$summary.textContent = item.comment;
					} else {
						const $noSummary = document.createElement("em");
						$noSummary.textContent = "No summary provided";
						$summary.appendChild($noSummary);
					}

					if (item.minor) {
						const $minor = document.createElement("span");
						$minor.classList.add("minor-indicator");
						$minor.dataset.tooltip = "Minor edit";
						$minor.dataset.tooltipDelay = 500;
						$minor.textContent = "m";
						$summary.prepend($minor);
					}
				}

				const $change = document.createElement("div");
				{
					const sizediff = item.sizediff || 0;

					$change.classList.add("queue-item-change");
					$change.innerHTML = this.ws.util.getChangeString(sizediff || 0);

					$change.style.color = this.ws.util.getChangeColor(sizediff || 0);
					if (Math.abs(sizediff || 0) >= 500)
						$change.style.fontWeight = "bold";

					$item.appendChild($change);
				}
			} break;
			case "logevent": {
				$user.classList.add("queue-log-title");
			} break;
		}

		return $item.innerHTML;
	}

	renderQueue(queue = null, current = null, type = null) {
		queue ??= this.ws.queue.current.queue;
		current ??= this.ws.queue.current.item;
		type ??= this.ws.queue.current.type;

		this.updateQueueTabs();
		if (type !== this.ws.queue.current.type)
			return;

		const $queue = document.querySelector("#queue-items");
		if (queue.length === 0) {
			const $empty = document.createElement("div");
			$empty.classList.add("queue-empty");
			$empty.textContent = "No items in queue";
			$queue.innerHTML = $empty.outerHTML;

			if (this.ws.queue.queues[type].previous !== current) {
				this.ws.queue.queues[type].previous = current;
				this.newCurrentItem(current);
			}

			return;
		} else
			$queue.querySelectorAll(".queue-empty").forEach($el => $el.remove());

		const dom = new Map();
		for (const $el of $queue.children)
			dom.set(+$el.dataset.id, $el);

		let $previous = null;
		for (const item of queue) {
			let $el = dom.get(item.id);
			if (!$el) {
				$el = document.createElement("div");
				$el.classList.add("queue-item");
				$el.dataset.id = item.id;
				$el.dataset.type = type;
				$el.innerHTML = this.generateItemHTML(item);

				if (item.mentions.has && this.ws.store.settings.username_highlighting.enabled) {
					$el.classList.add("queue-item-mentions-me");
					$el.dataset.tooltip = "This queue item contains your username";

					this.addTooltipListener($el);
				}

				$el.addEventListener("click", () => {
					this.ws.queue.queues[type].item = item;
					this.ws.current = this.ws.queue.queues[type]; // saftey fallback

					this.renderQueue();
				});

				$queue.appendChild($el);
				$el.querySelectorAll("[data-tooltip]").forEach($tooltip => this.addTooltipListener($tooltip));
			}

			if ($previous === null) {
				if ($el !== $queue.firstChild)
					$queue.insertBefore($el, $queue.firstChild);
			} else if ($el.previousSibling !== $previous)
				$queue.insertBefore($el, $previous.nextSibling);

			$el.classList.toggle("queue-item-current", item === current);
			$previous = $el;
		}

		for (const [ id, $el ] of dom.entries())
			if (!queue.some(item => item.id === id))
				$el.remove();

		if (this.ws.queue.queues[type].previous !== current) {
			this.ws.queue.queues[type].previous = current;
			this.newCurrentItem(current);
		}
	}
	removeQueueItem(type, id) {
		const $el = document.querySelector(`.queue-item[data-type="${type}"][data-id="${id}"]`);
		if ($el) {
			$el.remove();
			this.updateQueueTabs([ type ]);
		}
	}
	clearQueueItems() {
		document.querySelector("#queue-items").innerHTML = "";
		this.updateQueueTabs();
	}

	async newCurrentItem(item = null) {
		this.controllers.current?.abort();

		const controller = new AbortController();
		this.controllers.current = controller;

		this.stopOutdatedCheck();
		this.toggleEditWarNotice(item?.reverts >= 3, item?.reverts || 0);
		this.toggleOutdatedNotice(false);
		this.togglePendingNotice(false);

		this.closeMenus();
		this.removeTooltips();

		document.querySelectorAll("#right-top > div > :not(.hidden)").forEach(el => el.classList.add("hidden"));

		const $contributions = document.querySelector("#user-contribs-content");
		$contributions.innerHTML = "";

		const $history = document.querySelector("#page-history-content");
		$history.innerHTML = "";

		document.querySelector("#user-contribs-count").classList.toggle("hidden", item === null);
		document.querySelector("#user-warn-level").classList.toggle("hidden", item === null);
		document.querySelector("#user-block-count").classList.add("hidden");

		document.querySelector("#pending-changes-container").classList.toggle("hidden", !this.ws.queue.pending.has(item?.id));

		if (item === null) {
			document.querySelectorAll("[data-queue-type]").forEach($el => $el.classList.add("hidden"));

			document.querySelector("#middle-top").innerHTML = "";
			document.querySelector("#diff-container").innerHTML = "";

			document.querySelector("#page-metadata").innerHTML = "";
			document.querySelector("#protection-indicator").innerHTML = "";

			if ([ ...document.querySelectorAll(`#queue-tabs > .queue-tab`) ].every(tab => getComputedStyle(tab).display === "none"))
				document.querySelector("#diff-container").innerHTML = `
					<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: grey;">
						<div style="font-size: 48px; margin-bottom: 16px;">
							<i class="fas fa-shield-alt"></i>
						</div>
						<div style="font-size: 24px; margin-bottom: 8px; text-align: center;">
							No queues are enabled
						</div>
						<div style="font-size: 14px; text-align: center; max-width: 100%; margin-top: 10px;">
							I heard there was a WikiShield,<br>
							Which entered an oversaturated field,<br>
							But you don&rsquo;t ever use Huggle, do you?<br>
							Well it simplifies any AIV,<br>
							But superintendence matters to me
							<span style="display: block; margin-top: 8px;">&mdash; User:WikiMacaroons</span>
						</div>
					</div>
				`;

			return;
		}

		const type = item.type;
		const group = Queue.groups[type];
		document.querySelectorAll("[data-queue-type]").forEach($el => {
			const forType = $el.dataset.queueType || "*";
			if (forType === "*")
				$el.classList.remove("hidden");
			else
				$el.classList.toggle("hidden", !forType.split(",").includes(group));
		});

		const watched = item?.page?.watched;
		document.querySelector("#page-watch").classList.toggle("hidden", watched === true);
		document.querySelector("#page-unwatch").classList.toggle("hidden", watched !== true);

		document.querySelector("#user-report-uaa").classList.toggle("hidden", item?.user.anon);

		document.querySelector("#user-contribs-count").textContent = `${item.user.edits} edit${item.user.edits === 1 ? "" : "s"}`;

		if (this.ws.AI) {
			const storage = this.ws.store;
			if (item.AI.edit === null && storage.settings.AI.edit_analysis.enabled)
				this.ws.AI.analyze.edit(item)
					.then(analysis => {
						item.AI.edit = analysis;
					})
					.catch(err => {
						item.AI.edit = {
							error: err.message
						};
					}).finally(() => {
						if (this.ws.queue.current.item === item)
							this.updateAIAnalysisDisplay(item.AI.edit);
					});

			if (item.AI.username === null && !item.user.anon && !storage.whitelist.users.has(item.user) && storage.settings.AI.username_analysis.enabled)
				this.ws.AI.analyze.username(item)
					.then(analysis => {
						item.AI.username = analysis;
						if (analysis.flag)
							this.ws.queue.promptUAA(item, analysis);
					})
					.catch(err => {
						item.AI.username = {
							error: err.message
						};
					});
		}
		this.updateAIAnalysisDisplay(item.AI.edit);

		if (!item.seen) {
			item.seen = true;

			this.ws.store.statistics.edits_reviewed.total++;
			switch (this.ws.queue.current.type) {
				case "recent": {
					this.ws.store.statistics.recent_changes_reviewed.total++;
				} break;
				case "pending": {
					this.ws.store.statistics.pending_changes_reviewed.total++;
				} break;
				case "watchlist": {
					this.ws.store.statistics.watchlist_changes_reviewed.total++;
				} break;
				case "users": {
					this.ws.store.statistics.users_reviewed.total++;
				} break;
			}
		}

		const $warnings = document.querySelector("#user-warn-level");
		{
			$warnings.style.backgroundColor = warningTemplateColors[item.user.warning] || "grey";
			$warnings.textContent = item.user.warning;

			if (item.user.warning === "0") {
				$warnings.dataset.tooltip = "No warnings";
				$warnings.dataset.tooltipHtml = false;
			} else {
				const warnings = item.user.warnings;
				if (warnings.length > 0) {
					const $tooltip = document.createElement("div");

					const $title = document.createElement("div");
					$title.classList.add("tooltip-title");
					$title.textContent = `Warnings for ${item.user.name}`;
					$tooltip.appendChild($title);

					for (const warning of warnings) {
						const $warning = document.createElement("div");
						$warning.classList.add("tooltip-item", "user-warnings");
						$tooltip.appendChild($warning);

						const $level = document.createElement("span");
						$level.classList.add("tooltip-item-level");
						$level.textContent = `${warning.template}${warning.level}`;
						$warning.appendChild($level);

						const $details = document.createElement("div");
						$details.classList.add("tooltip-item-details");
						$warning.appendChild($details);

						const $user = document.createElement("span");
						$user.classList.add("tooltip-item-user");
						$user.textContent = warning.username ? `by User:${warning.username}` : "by Unknown";
						$details.appendChild($user);

						$details.appendChild(document.createElement("br"));

						const $date = document.createElement("span");
						$date.classList.add("tooltip-item-date");
						$details.appendChild($date);

						if (warning.timestamp) {
							$date.dataset.time = warning.timestamp;
							$date.dataset.timeFormat = "notification";
							$date.textContent = this.ws.util.formatNotificationTime(new Date(warning.timestamp));
						} else
							$date.textContent = "Date unknown";
					}

					$warnings.dataset.tooltip = $tooltip.innerHTML;
					$warnings.dataset.tooltipHtml = true;
				}
			}

			const $temp = $warnings.cloneNode(true); // to get rid of old tooltip listeners
			$warnings.parentNode.replaceChild($temp, $warnings);
			this.addTooltipListener($temp);
		}

		const $blocks = document.querySelector("#user-block-count");
		if ($blocks) {
			const blocks = item.user.blocks;
			if (blocks.length > 0) {
				const $tooltip = document.createElement("div");

				const $title = document.createElement("div");
				$title.classList.add("tooltip-title");
				$title.textContent = `Blocks for ${item.user.name}`;
				$tooltip.appendChild($title);

				for (const block of blocks) {
					const $block = document.createElement("div");
					$block.classList.add("tooltip-item", "user-blocks");
					$tooltip.appendChild($block);

					const $level = document.createElement("span");
					$level.classList.add("tooltip-item-level");
					$level.textContent = this.ws.util.truncate(block.comment || "No reason provided", 100);
					$block.appendChild($level);

					const $details = document.createElement("div");
					$details.classList.add("tooltip-item-details");
					$block.appendChild($details);

					const $user = document.createElement("span");
					$user.classList.add("tooltip-item-user");
					$user.textContent = block.user ? `by User:${block.user}` : "by Unknown";
					$details.appendChild($user);

					$details.appendChild(document.createElement("br"));

					const $date = document.createElement("span");
					$date.classList.add("tooltip-item-time");
					$details.appendChild($date);

					if (block.timestamp) {
						$date.dataset.time = block.timestamp;
						$date.dataset.timeFormat = "notification";
						$date.textContent = this.ws.util.formatNotificationTime(new Date(block.timestamp));
					} else
						$date.textContent = "Date unknown";

					$date.textContent += ` (for ${block.params?.duration || "an unknown duration"})`;
				}

				$blocks.classList.remove("hidden");
				$blocks.innerHTML = `${blocks.length}&times;`;
				$blocks.dataset.tooltip = $tooltip.innerHTML;
				$blocks.dataset.tooltipHtml = true;
			} else {
				$blocks.innerHTML = "";
				delete $blocks.dataset.tooltip;
				delete $blocks.dataset.tooltipHtml;
			}

			const $temp = $blocks.cloneNode(true); // to get rid of old tooltip listeners
			$blocks.parentNode.replaceChild($temp, $blocks);
			this.addTooltipListener($temp);
		}

		{ // users whitelist & highlight buttons
			const $whitelist = document.querySelector("#user-whitelist");
			const $unwhitelist = document.querySelector("#user-unwhitelist");
			if ($whitelist && $unwhitelist) {
				const func = () => {
					const isWhitelisted = this.ws.store.whitelist.users.has(item.user.name);
					$whitelist.classList.toggle("hidden", isWhitelisted);
					$unwhitelist.classList.toggle("hidden", !isWhitelisted);
				};

				$whitelist.onclick = func;
				$unwhitelist.onclick = func;

				func();
			}

			const $highlight = document.querySelector("#user-highlight");
			const $unhighlight = document.querySelector("#user-unhighlight");
			if ($highlight && $unhighlight) {
				const func = () => {
					const isHighlighted = this.ws.store.highlight.users.has(item.user.name);
					$highlight.classList.toggle("hidden", isHighlighted);
					$unhighlight.classList.toggle("hidden", !isHighlighted);
				};

				$highlight.onclick = func;
				$unhighlight.onclick = func;

				func();
			}
		}

		{ // pages whitelist & highlight buttons
			const $addWhitelist = document.querySelector("#page-whitelist");
			const $removeWhitelist = document.querySelector("#page-unwhitelist");
			if ($addWhitelist && $removeWhitelist) {
				const func = () => {
					const isWhitelisted = this.ws.store.whitelist.pages.has(item.page.title);
					$addWhitelist.classList.toggle("hidden", isWhitelisted);
					$removeWhitelist.classList.toggle("hidden", !isWhitelisted);
				};

				$addWhitelist.onclick = func;
				$removeWhitelist.onclick = func;

				func();
			}

			const $highlight = document.querySelector("#page-highlight");
			const $unhighlight = document.querySelector("#page-unhighlight");
			if ($highlight && $unhighlight) {
				const func = () => {
					const isHighlighted = this.ws.store.highlight.pages.has(item.page.title);
					$highlight.classList.toggle("hidden", isHighlighted);
					$unhighlight.classList.toggle("hidden", !isHighlighted);
				};

				$highlight.onclick = func;
				$unhighlight.onclick = func;

				func();
			}
		}

		{ // contributions
			const load = async signal => {
				const contributions = item.user.contributions;
				for (const item of contributions) {
					const $item = document.createElement("div");
					$item.className = "queue-item no-transition";
					$item.classList.toggle("queue-item-current", item.id === this.ws.queue.current.item.id);
					$item.innerHTML = this.generateItemHTML({
						page: { title: item.title },
						user: { name: item.user },
						comment: "Loading...",
						timestamp: item.timestamp,
						sizediff: 0,
						ores: NaN,
						tags: item.tags || [],
						type: "edit",
					});
					$contributions.appendChild($item);

					window.requestAnimationFrame(() => $item.classList.remove("no-transition"));
				}

				const items = await this.ws.queue.generate("edit", contributions, true);
				if (signal.aborted)
					return;

				$contributions.innerHTML = "";
				for (const item of items) {
					const $item = document.createElement("div");
					$item.className = "queue-item no-transition";
					$item.classList.toggle("queue-item-current", item.id === this.ws.queue.current.item.id);
					$item.innerHTML = this.generateItemHTML(item);
					$contributions.appendChild($item);

					$item.addEventListener("mouseover", () => this.ws.queue.propagate(item));
					$item.addEventListener("click", () => this.ws.queue.loadFromItem(item));
					$item.querySelectorAll("[data-tooltip]").forEach($tooltip => this.addTooltipListener($tooltip));

					window.requestAnimationFrame(() => $item.classList.remove("no-transition"));
				}
			};
			load(controller.signal).catch(err => {
				if (controller.signal.aborted)
					return;
				console.error("Error loading contributions:", err);
			});
		}

		switch (group) {
			case "edit": {
				this.startOutdatedCheck(item);
				if (!item.pending)
					item.consecutive.then(data => {
						if (this.ws.queue.current.item !== item)
							return;
						else if (data.count < 2)
							return;

						document.querySelector("#latest-edits-tab").classList.remove("hidden");
						document.querySelector("#consecutive-edits-tab").classList.remove("hidden");
					});


				const $middle = document.querySelector("#middle-top");
				{
					$middle.innerHTML = "";

					const $line = document.createElement("div");
					$line.classList.add("middle-top-line");
					$line.innerHTML = `${item.display.title}${item.display.username}`;
					$middle.appendChild($line);

					const $size = document.createElement("div");
					$line.appendChild($size);

					const $icon = document.createElement("span");
					$icon.classList.add("fa", "fa-pencil");
					$size.appendChild($icon);

					const $text = document.createElement("span");
					$text.id = "diff-size-text";
					$text.style.color = this.ws.util.getChangeColor(0);
					$text.innerHTML = this.ws.util.getChangeString(0);
					$size.appendChild($text);

					const $comment = document.createElement("div");
					$comment.classList.add("middle-top-comment");
					$middle.appendChild($comment);
				}

				const $protection = document.querySelector("#protection-indicator");
				if ($protection) {
					const protection = item.page.protection;
					if (protection.protected) {
						let icon, tooltip;
						switch (protection.level) {
							case "sysop": {
								icon = "OP";
								tooltip = "Requires sysop right to edit";
							} break;
							case "extendedconfirmed": {
								icon = "X";
								tooltip = "Requires extended confirmed right to edit";
							} break;
							case "autoconfirmed": {
								icon = "A";
								tooltip = "Requires autoconfirmed right to edit";
							} break;
							default: {
								icon = "P";
								tooltip = "Protected";
							} break;
						}

						$protection.innerHTML = `<span class="protection-icon" data-tooltip="${tooltip}">${icon}</span>`;
						this.addTooltipListener($protection.querySelector("[data-tooltip]"));
					} else if (item.pending) {
						const comment = item.pending.stability?.comment || "No comment provided";
						$protection.innerHTML = `<span class="protection-icon" data-tooltip="Pending changes: ${comment}">PC</span>`;
						this.addTooltipListener($protection.querySelector("[data-tooltip]"));
					} else {
						$protection.innerHTML = "";
					}
				}

				const $metadata = document.querySelector("#page-metadata");
				if ($metadata)
					$metadata.innerHTML = item.page.metadata.join(" &middot; ");

				{ // history
					const load = async signal => {
						const history = item.page.history;
						for (const item of history) {
							const $item = document.createElement("div");
							$item.className = "queue-item no-transition";
							$item.classList.toggle("queue-item-current", item.id === this.ws.queue.current.item.id);
							$item.innerHTML = this.generateItemHTML({
								page: { title: item.title },
								user: { name: item.user },
								comment: "Loading...",
								timestamp: item.timestamp,
								sizediff: 0,
								ores: NaN,
								tags: item.tags || [],
								type: "edit",
							});
							$history.appendChild($item);

							window.requestAnimationFrame(() => $item.classList.remove("no-transition"));
						}

						const items = await this.ws.queue.generate("edit", history, true);
						if (signal.aborted)
							return;

						$history.innerHTML = "";
						for (const item of items) {
							const $item = document.createElement("div");
							$item.className = "queue-item no-transition";
							$item.classList.toggle("queue-item-current", item.id === this.ws.queue.current.item.id);
							$item.innerHTML = this.generateItemHTML(item);
							$history.appendChild($item);

							$item.addEventListener("mouseover", () => this.ws.queue.propagate(item));
							$item.addEventListener("click", () => this.ws.queue.loadFromItem(item));
							$item.querySelectorAll("[data-tooltip]").forEach($tooltip => this.addTooltipListener($tooltip));

							window.requestAnimationFrame(() => $item.classList.remove("no-transition"));
						}
					};
					load(controller.signal).catch(err => {
						if (controller.signal.aborted)
							return;
						console.error("Error loading history:", err);
					});
				}
			} break;
			case "logevent": {
				const $middle = document.querySelector("#middle-top");
				{
					$middle.innerHTML = "";

					const $line = document.createElement("div");
					$line.classList.add("middle-top-line");
					$line.innerHTML = `Log entry on ${item.display.title} by ${item.display.performer}`;
					$middle.appendChild($line);

					const $comment = document.createElement("div");
					$comment.classList.add("middle-top-comment");
					$middle.appendChild($comment);
				}
			} break;
		}

		this.updateDiffDisplay(item, false);
	}

	updateDiffDisplay(item, consecutive) {
		if (!item)
			return;

		document.querySelectorAll("#right-top > .tabs > .tab.selected").forEach($tab => $tab.classList.remove("selected"));

		const $diff = document.querySelector("#diff-container");
		switch (Queue.groups[item.type]) {
			case "edit": {
				const pending = this.ws.queue.pending.get(item.id);
				if (pending) {
					const $size = document.querySelector("#diff-size-text");
					$size.innerHTML = this.ws.util.getChangeString(pending.sizediff || 0);
					$size.style.color = this.ws.util.getChangeColor(pending.sizediff || 0);

					const $comment = document.querySelector("#middle-top .middle-top-comment");
					{
						$comment.innerHTML = "";

						const $edits = document.createElement("div");
						{
							$comment.appendChild($edits);

							const $icon = document.createElement("span");
							$icon.classList.add("fa", "fa-edit");
							$edits.appendChild($icon);

							const $text = document.createElement("span");
							$text.id = "pending-edits";
							$text.textContent = `${pending.count} edit${pending.count !== 1 ? "s" : ""}`;
							$edits.appendChild($text);
						}

						const $users = document.createElement("div");
						{
							$comment.appendChild($users);

							const $icon = document.createElement("span");
							$icon.classList.add("fa", "fa-user");
							$users.appendChild($icon);

							const users = Object.values(pending.users).length;
							const $text = document.createElement("span");
							$text.id = "pending-users";
							$text.textContent = `${users} user${users !== 1 ? "s" : ""}`;
							$users.appendChild($text);
						}

						const $time = document.createElement("div");
						{
							$comment.appendChild($time);

							const $icon = document.createElement("span");
							$icon.classList.add("fa", "fa-clock");
							$time.appendChild($icon);

							const $consecutive = document.createElement("span");
							$consecutive.id = "consecutive-time";
							$consecutive.dataset.tooltip = new Date(pending.timestamp.old).toLocaleString();
							$consecutive.textContent = "over the course of ";
							$time.appendChild($consecutive);

							const $span = document.createElement("span");
							{
								$span.dataset.time = pending.timestamp.old;
								$span.dataset.timeFormat = "notification";
								$span.textContent = this.ws.util.formatNotificationTime(new Date(pending.timestamp.old));
								$time.appendChild($span);
							}

							this.addTooltipListener($consecutive);
						}
					}

					$diff.innerHTML = `<table>${item.diff ?? "<em>No diff available</em>"}</table>`;
				} else if (consecutive) {
					document.querySelector("#consecutive-edits-tab").classList.add("selected");

					$diff.innerHTML = `<table>Loading consecutive edits&hellip;</table>`;
					item.consecutive.then(data => {
						if (this.ws.queue.current.item !== item)
							return;

						const $size = document.querySelector("#diff-size-text");
						$size.innerHTML = this.ws.util.getChangeString(data.sizediff || 0);
						$size.style.color = this.ws.util.getChangeColor(data.sizediff || 0);

						const $comment = document.querySelector("#middle-top .middle-top-comment");
						{
							$comment.innerHTML = "";

							const $edits = document.createElement("div");
							{
								$comment.appendChild($edits);

								const $icon = document.createElement("span");
								$icon.classList.add("fa", "fa-edit");
								$edits.appendChild($icon);

								const $text = document.createElement("span");
								$text.id = "consecutive-edits";
								$text.textContent = `${data.count} edit${data.count !== 1 ? "s" : ""}`;
								$edits.appendChild($text);
							}

							const $time = document.createElement("div");
							{
								$comment.appendChild($time);

								const $icon = document.createElement("span");
								$icon.classList.add("fa", "fa-clock");
								$time.appendChild($icon);

								const $consecutive = document.createElement("span");
								$consecutive.id = "consecutive-time";
								$consecutive.dataset.tooltip = new Date(data.timestamp.old).toLocaleString();
								$consecutive.textContent = "over the course of";
								$time.appendChild($consecutive);

								const $span = document.createElement("span");
								{
									$span.dataset.time = data.timestamp.old;
									$span.dataset.timeFormat = "notification";
									$span.textContent = this.ws.util.formatNotificationTime(new Date(data.timestamp.old));
									$time.appendChild($span);
								}

								this.addTooltipListener($consecutive);
							}
						}

						$diff.innerHTML = `<table>${data.diff ?? "<em>No diff available</em>"}</table>`;
					});
				} else {
					document.querySelector("#latest-edits-tab").classList.add("selected");

					$diff.innerHTML = `<table>${item.diff ?? "<em>No diff available</em>"}</table>`;

					const $size = document.querySelector("#diff-size-text");
					$size.innerHTML = this.ws.util.getChangeString(item.sizediff || 0);
					$size.style.color = this.ws.util.getChangeColor(item.sizediff || 0);

					const $comment = document.querySelector("#middle-top .middle-top-comment");
					{
						$comment.innerHTML = "";

						const $icon = document.createElement("span");
						$icon.classList.add("fa", "fa-comment-dots");
						$comment.appendChild($icon);

						const $summary = document.createElement("span");
						$summary.classList.add("summary");
						$summary.dataset.tooltip = item.comment;
						if (item.comment)
							$summary.textContent = this.ws.util.truncate(item.comment, 100);
						else
							$summary.innerHTML = "<em>No summary provided</em>";
						$comment.appendChild($summary);

						if (item.minor) {
							const $minor = document.createElement("span");
							$minor.classList.add("minor-indicator");
							$minor.dataset.tooltip = "Minor edit";
							$minor.textContent = "m";
							$comment.prepend($minor);

							this.addTooltipListener($minor);
						}

						this.addTooltipListener($summary);
					}
				}

				$diff.querySelectorAll(":is(.mw-diff-movedpara-left, .mw-diff-movedpara-right)").forEach($el => {
					const href = $el.href.split("#")[1];
					delete $el.href;
					$el.addEventListener("click", (e) => {
						e.preventDefault();
						$diff.querySelector(`a[name="${href}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
					});
				});

				if (this.ws.store.settings.username_highlighting.enabled) {
					const username = this.ws.api.username;
					if (username) {
						if (item.mentions.diff)
							$diff.querySelectorAll("td").forEach($td => {
								if ($td.textContent && this.ws.util.match(username, $td.textContent))
									$td.classList.add("ws-username-highlight");
							});

						if (item.mentions.comment)
							if (item.comment && this.ws.util.match(username, item.comment))
								document.querySelector("#middle-top .middle-top-comment .summary").classList.add("ws-username-highlight");
					}
				}

				const $first = $diff.querySelector("table .diff-addedline, table .diff-deletedline");
				if ($first) {
					$diff.offsetHeight; // force reflow
					$first.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			} break;
			case "logevent": {
				switch (item.type) {
					case "users": {
						$diff.innerHTML = "";

						const evaluation = profanity.evaluate(item.user.name);

						const $container = document.createElement("div");
						$container.classList.add("profanity");
						$diff.appendChild($container);

						const $header = document.createElement("div");
						{
							$header.classList.add("profanity-header");
							$container.appendChild($header);

							const $score = document.createElement("div");
							{
								$score.classList.add("profanity-score");
								$header.appendChild($score);

								const $label = document.createElement("span");
								$label.classList.add("score-label");
								$label.textContent = "Profanity Score:";
								$score.appendChild($label);

								const $value = document.createElement("span");
								$value.classList.add("score-value");
								$value.textContent = evaluation.finalScore;
								$score.appendChild($value);
							}

							const $risk = document.createElement("div");
							{
								$risk.classList.add("profanity-risk", `risk-${evaluation.risk.toLowerCase()}`);
								$header.appendChild($risk);

								const $icon = document.createElement("span");
								$icon.classList.add("fa");
								switch (evaluation.risk) {
									case "No": {
										$icon.classList.add("fa-smile");
									} break;
									case "Low": {
										$icon.classList.add("fa-thumbs-up");
									} break;
									case "Medium": {
										$icon.classList.add("fa-meh");
									} break;
									case "High": {
										$icon.classList.add("fa-thumbs-down");
									} break;
									case "Critical": {
										$icon.classList.add("fa-skull-crossbones");
									} break;
								}
								$risk.appendChild($icon);

								const $label = document.createElement("span");
								$label.textContent = `${evaluation.risk} risk`;
								$risk.appendChild($label);
							}
						}

						const matches = evaluation.matches;
						if (matches.length > 0) {
							const $header = document.createElement("div");
							$header.classList.add("profanity-matches-header");
							$container.appendChild($header);

							const $icon = document.createElement("span");
							$icon.classList.add("fa", "fa-search");
							$header.appendChild($icon);

							const $text = document.createElement("span");
							$text.textContent = `Matched Terms (${matches.length})`;
							$header.appendChild($text);

							const $matches = document.createElement("div");
							$matches.classList.add("profanity-matches-list");
							$container.appendChild($matches);

							for (const match of matches) {
								const $match = document.createElement("div");
								{
									$match.classList.add("profanity-match");
									$matches.appendChild($match);

									const $header = document.createElement("div");
									{
										$header.classList.add("match-header");
										$match.appendChild($header);

										const $text = document.createElement("span");
										{
											$text.classList.add("match-text");
											$text.textContent = match.match;
											$header.appendChild($text);
										}

										const $arrow = document.createElement("span");
										{
											$arrow.classList.add("fa", "fa-arrow-right");
											$header.appendChild($arrow);
										}

										const $name = document.createElement("span");
										{
											$name.classList.add("match-name");
											$name.textContent = match.name;
											$header.appendChild($name);
										}
									}

									const $details = document.createElement("div");
									{
										$details.classList.add("match-details");
										$match.appendChild($details);

										const $confidence = document.createElement("div");
										{
											$confidence.classList.add("match-stat");
											$details.appendChild($confidence);

											const $label = document.createElement("span");
											{
												$label.classList.add("stat-label");
												$label.textContent = "Confidence";
												$confidence.appendChild($label);
											}

											const $value = document.createElement("span");
											{
												$value.classList.add("stat-value");
												$value.dataset.tooltip = "How certain we are this is a match.";
												$value.dataset.tooltipDelay = 500;
												$value.textContent = `${Math.round(match.confidence * 100)}%`;
												$confidence.appendChild($value);
											}
										}

										const $obfuscation = document.createElement("div");
										{
											$obfuscation.classList.add("match-stat");
											$details.appendChild($obfuscation);

											const $label = document.createElement("span");
											{
												$label.classList.add("stat-label");
												$label.textContent = "Obfuscation";
												$obfuscation.appendChild($label);
											}

											const $value = document.createElement("span");
											{
												$value.classList.add("stat-value");
												$value.dataset.tooltip = "How much the term was altered from its original form.";
												$value.dataset.tooltipDelay = 500;
												$value.textContent = `${Math.round(match.obfuscation * 100)}%`;
												$obfuscation.appendChild($value);
											}
										}

										const $severity = document.createElement("div");
										{
											$severity.classList.add("match-stat");
											$details.appendChild($severity);

											const $label = document.createElement("span");
											{
												$label.classList.add("stat-label");
												$label.textContent = "Severity";
												$severity.appendChild($label);
											}

											const $value = document.createElement("span");
											{
												$value.classList.add("stat-value", `severity-${match.severity}`);
												$value.dataset.tooltip = "How severe this term is considered.";
												$value.dataset.tooltipDelay = 500;
												$value.textContent = match.severity;
												$severity.appendChild($value);
											}
										}
									}

									if (match.note) {
										const $note = document.createElement("div");
										{
											$note.classList.add("match-note");
											$match.appendChild($note);

											const $icon = document.createElement("span");
											{
												$icon.classList.add("fa", "fa-info-circle");
												$note.appendChild($icon);
											}

											const $text = document.createElement("span");
											{
												$text.classList.add("note-text");
												$text.textContent = match.note;
												$note.appendChild($text);
											}
										}
									}
								}

								$match.querySelectorAll("[data-tooltip]").forEach($tooltip => this.addTooltipListener($tooltip));
							}
						} else {
							const $noMatches = document.createElement("div");
							$noMatches.classList.add("profanity-no-matches");
							$container.appendChild($noMatches);

							const $icon = document.createElement("span");
							$icon.classList.add("fa", "fa-check-circle");
							$noMatches.appendChild($icon);

							const $text = document.createElement("span");
							$text.textContent = "No profanity detected.";
							$noMatches.appendChild($text);
						}
					} break;
				}
			} break;
		}
	}
	updateAIAnalysisDisplay(analysis) {
		const $analysis = document.querySelector("#ai-analysis-container");
		if ($analysis && analysis)
			$analysis.classList.remove("hidden");
		else
			return $analysis.classList.add("hidden");

		if (analysis.error) {
			// TODO
		} else {
			const $assessment = $analysis.querySelector(":scope > .header > .assessment");
			$assessment.textContent = analysis.assessment;
			$assessment.classList.add("assessment", analysis.assessment.toLowerCase().replace(/\s+/g, "-"));

			$analysis.querySelector(":scope > .header > .confidence").textContent = `${Math.round((analysis.confidence || 0) * 100)}% confidence`;
			$analysis.querySelector(":scope > .explanation").textContent = analysis.explanation || "No explanation provided.";

			const $issues = $analysis.querySelector(":scope > .issues");
			$issues.innerHTML = "";

			for (const issue of analysis.issues || []) {
				const $issue = document.createElement("div");
				$issue.classList.add("issue", issue.severity.toLowerCase().replace(/\s+/g, "-"));
				$issue.textContent = issue.policy;
				$issues.appendChild($issue);
			}

			$analysis.querySelectorAll("[data-tooltip]").forEach($tooltip => this.addTooltipListener($tooltip));
		}
	}

	async outdated(item) {
		if (Queue.groups[item.type] !== "edit") {
			this.toggleOutdatedNotice(false);
			this.togglePendingNotice(false);
			return;
		}

		if (item.type === "pending")
			return this.togglePendingNotice(!this.ws.queue.pending.has(item.id), true);
		else if (!item.pending && this.ws.queue.type === "pending")
			return this.togglePendingNotice(true, false);

		try {
			const newer = (await this.ws.api.getLatestIDs([ item.page.title ]))[item.page.title];
			this.toggleOutdatedNotice(newer > item.id, newer, item.page.title);
		} catch (error) {
			console.error("Error checking if edit is outdated:", error);
			this.toggleOutdatedNotice(false);
		}
	}
	startOutdatedCheck(item) {
		this.stopOutdatedCheck();

		this.outdated(item);
		this.intervals.outdated = window.setInterval(() => {
			if (this.ws.queue.current.item === item)
				this.outdated(item);
			else
				this.stopOutdatedCheck();
		}, 1000);
	}
	stopOutdatedCheck() {
		if (this.intervals.outdated) {
			window.clearInterval(this.intervals.outdated);
			this.intervals.outdated = null;
		}
		this.toggleOutdatedNotice(false);
		this.togglePendingNotice(false);
	}

	toggleEditWarNotice(show, count) {
		const $exists = document.querySelector("#edit-war-notice");
		show ??= !$exists;
		if (show === Boolean($exists))
			return;

		if (show) {
			const $notice = document.createElement("div");
			$notice.id = "edit-war-notice";
			$notice.classList.add("notice", "edit-war");

			const $icon = document.createElement("span");
			$icon.classList.add("fa", "fa-warning");
			$notice.appendChild($icon);

			const $text = document.createElement("span");
			$text.classList.add("text");
			$text.innerHTML = `<b>3RR:</b> You have made ${count} reverts on this page in the last 24 hours.`;
			$notice.appendChild($text);

			const $diff = document.querySelector("#diff-container");
			$diff.parentElement.insertBefore($notice, $diff);
		} else {
			const $notice = document.querySelector("#edit-war-notice");
			if ($notice)
				$notice.remove();
		}
	}
	toggleOutdatedNotice(show, newer, page) {
		const $exists = document.querySelector("#outdated-notice");
		show ??= !$exists;
		if (show === Boolean($exists)) {
			if ($exists) {
				$exists.dataset.id = newer;
				$exists.dataset.page = page;
			}

			return;
		}

		if (show) {
			const $notice = document.createElement("div");
			$notice.id = "outdated-notice";
			$notice.classList.add("notice", "outdated");
			$notice.dataset.id = newer;
			$notice.dataset.page = page;

			const $icon = document.createElement("span");
			$icon.classList.add("fa", "fa-clock-rotate-left");
			$notice.appendChild($icon);

			const $text = document.createElement("span");
			$text.classList.add("text");
			$text.textContent = "Newer revision available on this page.";
			$notice.appendChild($text);

			const $button = document.createElement("span");
			$button.classList.add("button");
			$button.innerHTML = "View latest <i class='fas fa-arrow-right'></i>";
			$button.addEventListener("click", e => {
				e.preventDefault();

				const page = $notice.dataset.page;
				const id = +$notice.dataset.id;
				if (page && id)
					this.ws.queue.loadFromRevision(page, id);
			});
			$notice.appendChild($button);

			const $diff = document.querySelector("#diff-container");
			$diff.parentElement.insertBefore($notice, $diff);
		} else {
			const $notice = document.querySelector("#outdated-notice");
			if ($notice)
				$notice.remove();
		}
	}
	togglePendingNotice(show, pending) {
		const $exists = document.querySelector("#pending-notice");
		show ??= !$exists;
		if (show === Boolean($exists))
			return;

		if (show) {
			const $notice = document.createElement("div");
			$notice.id = "pending-notice";
			$notice.classList.add("notice", "outdated", "pending");

			const $icon = document.createElement("span");
			$icon.classList.add("fa", "fa-shield-alt");
			$notice.appendChild($icon);

			const $text = document.createElement("span");
			$text.classList.add("text");
			$text.textContent = pending ?
				"This revision cannot be reviewed because it is outdated" :
				"This revision cannot be reviewed because it is not pending review";
			$notice.appendChild($text);

			const $diff = document.querySelector("#diff-container");
			$diff.parentElement.insertBefore($notice, $diff);
		} else {
			const $notice = document.querySelector("#pending-notice");
			if ($notice)
				$notice.remove();
		}
	}

	getORESColor(ores) {
		if (isNaN(ores) || ores < 0)
			return "rgba(128, 128, 128, .5)"; // Gray for unknown

		ores = Math.min(Math.max(ores || 0, 0), 1);
		const palette = GUI.palettes[this.ws.store.UI.theme.palette];
		return palette[ores * (palette.length - 1) | 0];
	}

	updatePalette() {
		document.querySelectorAll(".queue-item-color").forEach($el => {
			$el.style.backgroundColor = this.getORESColor(parseFloat($el.dataset.rawOresScore));
		});
	}

	updateZenMode() {
		const zen = this.ws.store.settings.zen_mode;
		if (zen.enabled && zen.music.enabled)
			this.ws.audio.playPlaylist([ "music", "zen_mode" ]);
		else
			this.ws.audio.stopPlaylist([ "music", "zen_mode" ]);

		document.querySelectorAll("[data-zen-show]").forEach($el => {
			$el.style.display = zen.enabled && !zen[$el.dataset.zenShow].enabled ? "none" : "";
		});
	}

	reorderQueues() {
		const queues = Queue.types.map(type => ({ name: type, ...this.ws.store.settings.queue[type] }));
		queues.sort((a, b) => a.order - b.order);

		queues.forEach(queue => {
			const $tab = document.querySelector(`#queue-tab-${queue.name}`);
			if ($tab) {
				$tab.style.display = queue.enabled ? "" : "none";
				$tab.parentElement.appendChild($tab);
			}
		});

		const tab = queues.find(q => q.enabled)?.name;
		if (tab)
			this.ws.queue.switch(tab);
	}

	updateQueueTabs(types = Queue.types) {
		const queues = this.ws.queue.queues;
		types.forEach(type => {
			const $tab = document.querySelector(`#queue-tab-${type}`);
			if (!$tab || !queues[type])
				return;

			const $count = $tab.querySelector(":scope > span > .icon-count");

			const len = queues[type].queue.length;
			$count.classList.toggle("hidden", len === 0);
			$count.textContent = len;

			$tab.classList.toggle("mentions-me", this.ws.store.settings.username_highlighting.enabled && queues[type].queue.some(item => item.mentions.has));
		});
	}

	createTooltip($target, className = "", content = "", isHTML = false, delay = 10, callback = null) {
		const $tooltip = document.createElement("div");
		$tooltip.className = `tooltip ${className}`;

		if (isHTML)
			$tooltip.innerHTML = content;
		else
			$tooltip.textContent = content;

		document.body.querySelector("#app").appendChild($tooltip);
		if (typeof callback === "function")
			callback($tooltip);

		$tooltip.offsetHeight; // Force reflow

		const tooltipRect = $tooltip.getBoundingClientRect();
		const w = tooltipRect.width, h = tooltipRect.height;

		const targetRect = $target.getBoundingClientRect();

		const cx = (targetRect.left + targetRect.right - w) / 2;

		const fitRight = targetRect.right < window.innerWidth - w - 30;
		const fitLeft = targetRect.left > w + 30;
		const fitMiddle = cx > 10 && cx + w < window.innerWidth - 10;

		const fitTop = fitMiddle && targetRect.top > h + 30;
		const fitBottom = fitMiddle && targetRect.bottom < window.innerHeight - h - 30;

		if (fitTop) {
			$tooltip.style.left = `${(targetRect.left + targetRect.right - w) / 2}px`;
			$tooltip.style.top = `${targetRect.top - h - 10}px`;
		} else if (fitBottom) {
			$tooltip.style.left = `${(targetRect.left + targetRect.right - w) / 2}px`;
			$tooltip.style.top = `${targetRect.bottom + 10}px`;
		} else if (fitRight) {
			$tooltip.style.left = `${targetRect.right + 10}px`;
			$tooltip.style.top = `${targetRect.top - 4}px`;
		} else if (fitLeft) {
			$tooltip.style.left = `${targetRect.left - w - 10}px`;
			$tooltip.style.top = `${targetRect.top - 4}px`;
		} else { // fallback
			$tooltip.style.left = `${Math.max(10, (targetRect.left + targetRect.right - w) / 2)}px`;
			$tooltip.style.top = `${Math.max(10, targetRect.bottom + 10)}px`;
		}

		$target.addEventListener("mousewheel", e => $tooltip.scrollBy(e.deltaX, e.deltaY));

		$tooltip.style.opacity = 0;
		setTimeout(() => $tooltip.style.opacity = 1, delay);

		return $tooltip;
	}

	removeTooltips() {
		document.querySelectorAll(".tooltip").forEach($tooltip => $tooltip.remove());
	}

	addTooltipListener($el) {
		let $tooltip;
		$el.addEventListener("mouseenter", () => {
			if (!$el.dataset.tooltip)
				return;
			else if ($tooltip)
				$tooltip.remove();

			$tooltip = this.createTooltip($el, "", $el.dataset.tooltip, $el.dataset.tooltipHtml === "true", +$el.dataset.tooltipDelay || 10);
		});

		$el.addEventListener("mouseleave", () => {
			if ($tooltip) {
				$tooltip.remove();
				$tooltip = null;
			}
		});
	}

	positionBottomMenu($button, $menu) {
		// Reset positioning
		$menu.style.left = '';
		$menu.style.right = '';
		$menu.style.top = '';
		$menu.style.bottom = '';

		const position = () => {
			if (!$menu.classList.contains("show"))
				return;

			const menuRect = $menu.getBoundingClientRect();
			const buttonRect = $button.getBoundingClientRect();

			const vw = window.innerWidth;
			const vh = window.innerHeight;

			const fitsLeft = buttonRect.left + menuRect.width <= vw;
			if (fitsLeft) {
				$menu.style.left = `${buttonRect.left}px`;
				$menu.style.right = 'auto';
			} else {
				$menu.style.right = `${vw - buttonRect.right}px`;
				$menu.style.left = 'auto';
			}

			const fitsAbove = buttonRect.top >= menuRect.height;
			if (fitsAbove) {
				$menu.style.bottom = `${vh - buttonRect.top}px`;
				$menu.style.top = 'auto';
			} else {
				$menu.style.top = `${buttonRect.bottom}px`;
				$menu.style.bottom = 'auto';
			}

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
	}

	positionSubmenu($submenu, $trigger) {
		// Reset positioning
		$submenu.style.left = '';
		$submenu.style.right = '';
		$submenu.style.top = '';
		$submenu.style.bottom = '';

		const position = () => {
			if (!$submenu.classList.contains("show"))
				return;

			const submenuRect = $submenu.getBoundingClientRect();
			const triggerRect = $trigger.getBoundingClientRect();

			const vw = window.innerWidth;
			const vh = window.innerHeight;

			const spaceRight = vw - triggerRect.right;
			const spaceLeft = triggerRect.left;
			if (spaceRight < submenuRect.width + 20 && spaceLeft > spaceRight) {
				$submenu.style.left = 'auto';
				$submenu.style.right = 'calc(100% + 4px)';
			}

			const spaceBelow = vh - triggerRect.bottom;
			const spaceAbove = triggerRect.top;
			if (submenuRect.bottom > vh && spaceAbove > spaceBelow) {
				$submenu.style.top = 'auto';
				$submenu.style.bottom = '0';
			}

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
	}

	positionLevelsMenu($button, $menu) {
		// Reset previous positioning
		$menu.style.left = '';
		$menu.style.right = '';
		$menu.style.top = '';
		$menu.style.bottom = '';

		const position = () => {
			if (!$menu.classList.contains("show"))
				return;

			const menuRect = $menu.getBoundingClientRect();
			const buttonRect = $button.getBoundingClientRect();

			const vw = window.innerWidth;
			const vh = window.innerHeight;

			const spaceRight = vw - buttonRect.right;
			const spaceLeft = buttonRect.left;
			const fitsRight = spaceRight >= menuRect.width + 8;
			const fitsLeft = spaceLeft >= menuRect.width + 8;

			if (fitsRight) {
				$menu.style.left = `${buttonRect.right + 8}px`;
				$menu.style.right = 'auto';
			} else if (fitsLeft) {
				$menu.style.right = `${vw - buttonRect.left + 8}px`;
				$menu.style.left = 'auto';
			} else {
				if (spaceRight > spaceLeft) {
					$menu.style.left = `${buttonRect.right + 8}px`;
					$menu.style.right = 'auto';
				} else {
					$menu.style.right = `${vw - buttonRect.left + 8}px`;
					$menu.style.left = 'auto';
				}
			}

			const top = Math.max(Math.min(buttonRect.top + (buttonRect.height - menuRect.height) / 2, vh - menuRect.height - 8), 8);
			$menu.style.top = `${top}px`;
			$menu.style.bottom = 'auto';

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
	}

	positionWarningSubmenu($submenu, $trigger) {
		// Reset previous positioning
		$submenu.style.left = '';
		$submenu.style.right = '';
		$submenu.style.top = '';
		$submenu.style.bottom = '';

		const position = () => {
			if (!$submenu.classList.contains("show"))
				return;

			const submenuRect = $submenu.getBoundingClientRect();
			const triggerRect = $trigger.getBoundingClientRect();

			const vw = window.innerWidth;
			const vh = window.innerHeight;

			const spaceRight = vw - triggerRect.right;
			const spaceLeft = triggerRect.left;
			const fitsRight = spaceRight >= submenuRect.width + 8;
			const fitsLeft = spaceLeft >= submenuRect.width + 8;

			if (fitsRight) {
				$submenu.style.left = `${triggerRect.right + 8}px`;
				$submenu.style.right = 'auto';
			} else if (fitsLeft) {
				$submenu.style.right = `${vw - triggerRect.left + 8}px`;
				$submenu.style.left = 'auto';
			} else {
				if (spaceRight > spaceLeft) {
					$submenu.style.left = `${triggerRect.right + 8}px`;
					$submenu.style.right = 'auto';
				} else {
					$submenu.style.right = `${vw - triggerRect.left + 8}px`;
					$submenu.style.left = 'auto';
				}
			}

			const top = Math.max(Math.min(triggerRect.top + (triggerRect.height - submenuRect.height) / 2, vh - submenuRect.height - 8), 8);
			$submenu.style.top = `${top}px`;
			$submenu.style.bottom = 'auto';

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
	}

	createWarningItem(warning, executeWithWarn, executeNoWarn, key, isFavorite = false) {
		const favorites = this.ws.store.favorite[key];

		const $item = document.createElement("div");
		$item.classList.add("warning-menu-item");
		if (isFavorite) {
			$item.draggable = true;
			$item.classList.add("favorite-item");
		} else
			$item.classList.add("submenu-option");

		$item.dataset.warning = warning.title;

		const $star = document.createElement("span");
		$star.classList.add("favorite-star");
		if (favorites.includes(warning.title)) {
			$star.classList.add("favorited");
			$star.innerHTML = "<i class='fas fa-star'></i>";
		} else
			$star.innerHTML = "<i class='fa-regular fa-star'></i>";

		$item.appendChild($star);
		$star.addEventListener("click", (e) => {
			e.stopPropagation();

			const i = favorites.indexOf(warning.title);
			const $menu = key === "reverts" ?
				document.querySelector("#revert-menu > .warning-menu") :
				document.querySelector("#warn-menu > .warning-menu");

			if (i === -1) {
				favorites.push(warning.title);
				$star.classList.add("favorited", "spin");
				$star.innerHTML = "<i class='fas fa-star'></i>";

				let $favorites = $menu.querySelector(".favorites-section");
				if (!$favorites) {
					$favorites = document.createElement("div");
					$favorites.className = "favorites-section";

					const $header = document.createElement("div");
					$header.className = "favorites-header";
					$header.innerHTML = '<span class="icon fas fa-star"></span><span>Favorites</span>';
					$favorites.appendChild($header);

					const $container = document.createElement("div");
					$container.className = "favorites-container";
					$favorites.appendChild($container);

					$menu.insertBefore($favorites, $menu.firstChild);

					const $separator = document.createElement("div");
					$separator.className = "favorites-separator";
					$menu.insertBefore($separator, $favorites.nextSibling);
				}

				const executeCallbacks = $menu.__executeCallbacks__;
				if (executeCallbacks)
					$favorites.querySelector(".favorites-container").appendChild(this.createWarningItem(
						warning,
						executeCallbacks.executeWithWarn,
						executeCallbacks.executeNoWarn,
						key,
						true
					));
			} else {
				favorites.splice(i, 1);

				$star.classList.remove("favorited");
				$star.classList.add("spin");
				$star.innerHTML = "<i class='fa-regular fa-star'></i>";
				if (isFavorite) {
					$item.remove();

					const $favorites = $menu.querySelector(".favorites-section");
					if ($favorites?.querySelector(".favorites-container").children.length === 0) {
						$favorites.remove();
						$menu.querySelector(".favorites-separator")?.remove();
					}

					const $subitem = document.body.querySelector(`.warning-menu-item:not(.favorite-item)[data-warning="${warning.title}"]`);
					if ($subitem) {
						const $star = $subitem.querySelector(".favorite-star");
						$star.classList.remove("favorited");
						$star.innerHTML = "<i class='fa-regular fa-star'></i>";
						$star.classList.add("spin");

						window.setTimeout(() => $star.classList.remove("spin"), 500);
					}
				} else {
					const $favorites = $menu.querySelector(".favorites-section");
					if ($favorites) {
						const $favorite = $favorites.querySelector(`[data-warning="${warning.title}"]`);
						if ($favorite) {
							$favorite.remove();
							if ($favorites.querySelector(".favorites-container").children.length === 0) {
								$favorites.remove();
								$menu.querySelector(".favorites-separator")?.remove();
							}
						}
					}
				}
			}

			window.setTimeout(() => $star.classList.remove("spin"), 500);
		});

		const $icon = document.createElement("span");
		$icon.className = `icon ${warning.icon}`;
		$item.appendChild($icon);

		const $label = document.createElement("span");
		$label.className = "warning-menu-title";
		$label.textContent = warning.title;
		$item.appendChild($label);

		const $helpIcon = document.createElement("span");
		$helpIcon.className = "fas fa-circle-question";
		$helpIcon.dataset.tooltip = warning.description;
		$item.appendChild($helpIcon);
		this.addTooltipListener($helpIcon);

		if (!isFavorite) {
			const $button = document.createElement("div");
			$button.classList.add("warning-menu-buttons");

			if (key === "reverts") {
				const $noWarn = document.createElement("span");
				$noWarn.className = "warning-menu-button warning-menu-no-warn-button";
				$noWarn.textContent = "no warn";
				$button.appendChild($noWarn);

				$noWarn.addEventListener("click", async (e) => {
					e.stopPropagation();
					await executeNoWarn(warning.title);
				});
			}

			const $levelsButton = document.createElement("span");
			$levelsButton.className = "warning-menu-button warning-menu-levels-button";
			$levelsButton.textContent = "advanced";
			$button.appendChild($levelsButton);
			$item.appendChild($button);

			const $levelsMenu = document.createElement("div");
			$levelsMenu.className = "levels-menu";

			for (const template of warning.templates) {
				if (template.generic)
					continue;

				const $levelButton = document.createElement("span");
				$levelButton.className = `levels-menu-item colorize-level colorize-level-${template.name}`;
				$levelButton.textContent = template.name;
				$levelsMenu.appendChild($levelButton);

				$levelButton.addEventListener("click", async () => await executeWithWarn(warning.title, template.name));
			}

			document.body.querySelector("#app").appendChild($levelsMenu);

			$levelsButton.addEventListener("click", e => {
				e.stopPropagation();

				const wasShown = $levelsMenu.classList.contains("show");
				document.body.querySelectorAll(".levels-menu.show").forEach(menu => menu.classList.remove("show"));

				if (!wasShown) {
					$levelsMenu.classList.add("show");
					this.positionLevelsMenu($levelsButton, $levelsMenu);
				}
			});
		}

		$item.addEventListener("click", async e => {
			if (e.target.closest(".warning-menu-button") || e.target.closest(".favorite-star"))
				return;

			await executeWithWarn(warning.title, "auto");
		});

		if (isFavorite) {
			$item.addEventListener("dragstart", (e) => {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", warning.title);
				$item.classList.add("dragging");
			});

			$item.addEventListener("dragend", () => {
				$item.classList.remove("dragging");
			});

			$item.addEventListener("dragover", (e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";

				const draggingItem = document.querySelector(".dragging");
				if (draggingItem && draggingItem !== $item) {
					const rect = $item.getBoundingClientRect();
					const midpoint = rect.top + rect.height / 2;
					if (e.clientY < midpoint) {
						$item.parentNode.insertBefore(draggingItem, $item);
					} else {
						$item.parentNode.insertBefore(draggingItem, $item.nextSibling);
					}
				}
			});

			$item.addEventListener("drop", (e) => {
				e.preventDefault();

				const favoriteItems = Array.from($item.closest(".favorites-section").querySelectorAll(".favorite-item"));
				this.ws.store.favorite[key] = favoriteItems.map(el => el.dataset.warning);
			});
		}

		return $item;
	}

	createRevertMenu(type, $container, item) {
		document.querySelectorAll(".levels-menu").forEach($menu => $menu.remove());
		document.querySelectorAll(".warning-submenu").forEach($submenu => $submenu.remove());

		const $menu = document.createElement("div");
		$menu.className = "warning-menu";
		$container.appendChild($menu);

		$menu.addEventListener("click", (e) => {
			if (!e.target.closest(".warning-submenu"))
				document.body.querySelectorAll(".warning-submenu.show").forEach($submenu => $submenu.classList.remove("show"));
			if (!e.target.closest(".levels-menu"))
				document.body.querySelectorAll(".levels-menu.show").forEach($menu => $menu.classList.remove("show"));
		});

		const executeWithWarn = async (warningTitle, level) => {
			const warning = getWarningFromLookup(warningTitle);
			const reportObject = {
				name: "if",
				condition: "atFinalWarning",
				actions: [
					{
						name: "report-user-to-aiv",
						params: {
							reportMessage: "Vandalism past final warning"
						}
					}
				]
			};

			const autoReporting = this.ws.store.settings.auto_report;
			await this.ws.execute({
				actions: [
					{
						name: "next-item",
						params: {}
					},
					((type === "reverts") ? ({
						name: "rollback-edit",
						params: {
							summary: warning.summary
						}
					}) : ({ })),
					{
						name: "warn-user",
						params: {
							warning: warningTitle,
							level,
						}
					},
					{
						name: "highlight-user",
						params: {}
					},
				].concat(autoReporting.enabled && warning.reportable && autoReporting.for.has(warningTitle) ? [ reportObject ] : [])
			});
		};

		const executeNoWarn = async warningTitle => {
			const warning = getWarningFromLookup(warningTitle);
			await this.ws.execute({
				actions: [
					{
						name: "next-item",
						params: {}
					},
					{
						name: "rollback-edit",
						params: {
							summary: warning.summary
						}
					},
				]
			});
		};

		const group = Queue.groups[this.ws.queue.current.item?.type ?? this.ws.queue.current.type];
		$menu.__executeCallbacks__ = { executeWithWarn, executeNoWarn };

		if (this.ws.store.favorite.reverts.length > 0) {
			const $favorites = document.createElement("div");
			$favorites.className = "favorites-section";

			const $header = document.createElement("div");
			$header.className = "favorites-header";
			$header.innerHTML = '<span class="icon fas fa-star"></span><span>Favorites</span>';
			$favorites.appendChild($header);

			const $container = document.createElement("div");
			$container.className = "favorites-container";
			$favorites.appendChild($container);

			const allWarnings = Object.values(warningsLookup).filter(w => w.queueType.includes(group) && (typeof w.show !== "function" || w.show(item)));
			for (const favorite of this.ws.store.favorite[type]) {
				const warning = allWarnings.find(w => w.title === favorite);
				if (warning) {
					const item = this.createWarningItem(warning, executeWithWarn, executeNoWarn, type, true);
					$container.appendChild(item);
				}
			}

			$menu.appendChild($favorites);

			const $separator = document.createElement("div");
			$separator.className = "favorites-separator";
			$menu.appendChild($separator);
		}

		let allMade = 0;
		for (const [ , category ] of Object.entries(warnings)) {
			let categoryMade = 0;
			const categoryWarnings = [];

			for (const warning of category.warnings) {
				if (typeof warning.show === "function" && !warning.show(item))
					continue;
				if (!warning.queueType.includes(group))
					continue;

				categoryWarnings.push(warning);
				categoryMade++;
				allMade++;
			}

			if (categoryMade === 0)
				continue;

			const $option = document.createElement("div");
			$option.className = "menu-option submenu-trigger";

			const $icon = document.createElement("span");
			$icon.className = `icon ${category.icon}`;
			$option.appendChild($icon);

			const $label = document.createElement("span");
			$label.textContent = category.title;
			$option.appendChild($label);

			const $arrowIcon = document.createElement("span");
			$arrowIcon.className = "submenu-arrow fas fa-chevron-right";
			$option.appendChild($arrowIcon);

			$menu.appendChild($option);

			const $submenu = document.createElement("div");
			$submenu.className = "warning-submenu submenu";
			document.body.querySelector("#app").appendChild($submenu);

			for (const warning of categoryWarnings) {
				const $item = this.createWarningItem(warning, executeWithWarn, executeNoWarn, type, false);
				$submenu.appendChild($item);
			}

			$option.addEventListener("click", (e) => {
				e.stopPropagation();

				const wasShown = $submenu.classList.contains("show");
				document.body.querySelectorAll(".warning-submenu.show").forEach($menu => {
					if ($menu !== $submenu) {
						$menu.classList.remove("show");
						document.body.querySelectorAll(".levels-menu.show").forEach($menu => $menu.classList.remove("show"));
					}
				});

				if (!wasShown) {
					$submenu.classList.add("show");
					this.positionWarningSubmenu($submenu, $option);
				} else {
					$submenu.classList.remove("show");
					document.body.querySelectorAll(".levels-menu.show").forEach($menu => $menu.classList.remove("show"));
				}
			});
		}

		if (allMade === 0) {
			const $noWarnings = document.createElement("div");
			$noWarnings.className = "warning-menu-no-items";
			$noWarnings.textContent = "No warnings available for this edit.";
			$menu.appendChild($noWarnings);
		}
	}

	closeMenus() {
		document.querySelectorAll(".bottom-tool-menu").forEach($menu => $menu.classList.remove("show"));
		document.querySelectorAll(".bottom-tool-trigger").forEach($trigger => $trigger.classList.remove("active"));

		document.querySelectorAll(".submenu").forEach($submenu => $submenu.classList.remove("show"));
		document.querySelectorAll(".levels-menu").forEach($menu => $menu.classList.remove("show"));
	}
}