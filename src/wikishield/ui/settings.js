const { AI } = require("../ai/class.js");
const { conditions } = require("../config/conditions.js");
const { buildShortcut, controls, validateShortcut } = require("../config/control-keys.js");
const { events } = require("../config/events.js");
const { Queue } = require("../core/queue.js");
const { WikiShield } = require("../core/wikishield.js");
const { namespaces } = require("../data/namespaces.js");
const { StorageManager } = require("../data/storage/manager.js");
const { warningsLookup } = require("../data/warnings.js");
const { sortDependencies } = require("../utilities/scripts.js");
const { Text } = require("../utilities/text.js");
const { GUI } = require("./gui.js");

import { AI } from "../ai/class.js";
import { conditions } from "../config/conditions.js";
import { buildShortcut, controls, validateShortcut } from "../config/control-keys.js";
import { events } from "../config/events.js";
import { Queue } from "../core/queue.js";
import { WikiShield } from "../core/wikishield.js";
import { namespaces } from "../data/namespaces.js";
import { StorageManager } from "../data/storage/manager.js";
import { warningsLookup } from "../data/warnings.js";
import { sortDependencies } from "../utilities/scripts.js";
import { Text } from "../utilities/text.js";
import { GUI } from "./gui.js";

// TODO make watching, whitelisting, and highlighting require times as a param

const formatTime = ms => {
	const seconds = Math.floor(ms / 1000);

	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const mins = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	let str = "";
	if (days > 0) str += `${days}d `;
	if (hours > 0) str += `${hours}h `;
	if (mins > 0) str += `${mins}m `;
	str += `${secs}s`;

	return str.trim();
};

module.exports.Settings = class Settings {
	#keypressListener;

	#promiseResolve;
	#promise;
	constructor(ws) {
		this.ws = ws;

		this.ws.api.getTags().then(tags => {
			this.wikipediaTags = tags;
		});
	}

	get active() {
		return document.querySelector("#settings-container > .settings > .settings-right > div:not(.hidden)");
	}

	controller(event) {
		const key = event.key.toLowerCase();
		if (!this.#keypressListener) {
			if (key === "escape" && event.type === "keydown")
				this.close();

			return;
		} else if (key === "escape")
			return this.#keypressListener("escape", true);

		if (key === "control" || key === "shift" || key === "alt" || controls.has(key)) {
			event.preventDefault();
			switch (event.type) {
				case "keydown": {
					this.#keypressListener(buildShortcut(event), false);
				} break;
				case "keyup": {
					this.#keypressListener(buildShortcut(event), true);
				} break;
			}
		}
	}

	collapsible($container, titleCallback, desc, collapsed = true) {
		const $collapse = document.createElement("div");
		$collapse.className = "settings-section collapsible";
		$container.appendChild($collapse);

		const $header = document.createElement("div");
		$header.className = "settings-section-header collapse-title";
		$header.textContent = titleCallback(collapsed);
		$collapse.appendChild($header);

		const $content = document.createElement("div");
		$content.className = "collapse-content collapsible";
		$collapse.appendChild($content);

		const $desc = document.createElement("div");
		$desc.className = "settings-section-desc";
		$desc.textContent = desc;
		$content.appendChild($desc);

		if (collapsed) {
			$content.style.height = "0px";
			$content.style.opacity = 0;
			$content.style.overflow = "hidden";
			$collapse.classList.add("collapsed");
		} else {
			$content.style.height = "auto";
			$content.style.opacity = 1;
			$content.style.overflow = "visible";
			$collapse.classList.remove("collapsed");
		}

		let isAnimating = false, animationFrame;
		let startTime, startHeight, startOpacity, targetHeight, targetOpacity;

		const duration = 300;
		const ease = t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		const animate = timestamp => {
			if (!startTime)
				startTime = timestamp;

			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = ease(progress);

			const height = startHeight + (targetHeight - startHeight) * eased;
			const opacity = startOpacity + (targetOpacity - startOpacity) * eased;

			$content.style.height = `${height}px`;
			$content.style.opacity = opacity;

			if (progress < 1)
				animationFrame = requestAnimationFrame(animate);
			else {
				if (!collapsed) {
					$content.style.height = "auto";
					$content.style.overflow = "visible";
				} else
					$content.style.overflow = "hidden";

				isAnimating = false;
				animationFrame = null;
				startTime = null;
			}
		};

		const toggle = () => {
			if (isAnimating) {
				cancelAnimationFrame(animationFrame);

				const computedHeight = $content.getBoundingClientRect().height;
				startHeight = computedHeight;
				startOpacity = parseFloat(getComputedStyle($content).opacity);
			} else {
				startHeight = collapsed ? 0 : $content.scrollHeight;
				startOpacity = collapsed ? 0 : 1;
			}

			collapsed = !collapsed;

			$header.textContent = titleCallback(collapsed);
			$collapse.classList.toggle("collapsed", collapsed);

			$content.style.overflow = "hidden";
			if (collapsed) {
				targetHeight = 0;
				targetOpacity = 0;
			} else {
				targetHeight = $content.scrollHeight;
				targetOpacity = 1;
			}

			isAnimating = true;
			startTime = null;
			animationFrame = requestAnimationFrame(animate);
		};

		$header.addEventListener("click", toggle);

		return $content;
	}

	start() {
		electron.onOpenChangelog(() => void(this.open()) ?? this.changelog());

		let cockBlock = 0;
		document.querySelector("#settings-container").addEventListener("click", e => {
			if (e.target.id === "settings-container" && !(cockBlock = Math.max(0, cockBlock)))
				this.close();
		});

		document.querySelector("#settings-general-button").addEventListener("click", this.general.bind(this));
		document.querySelector("#settings-audio-button").addEventListener("click", this.audio.bind(this));
		document.querySelector("#settings-controls-button").addEventListener("click", this.controls.bind(this));
		document.querySelector("#settings-zen-button").addEventListener("click", this.zen.bind(this));

		document.querySelector("#settings-app-button").addEventListener("click", this.app.bind(this));
		document.querySelector("#settings-queue-button").addEventListener("click", this.queue.bind(this));
		document.querySelector("#settings-accessibility-button").addEventListener("click", this.accessibility.bind(this));

		document.querySelector("#settings-AI-button").addEventListener("click", this.AI.bind(this));
		document.querySelector("#settings-auto-reporting-button").addEventListener("click", this.autoReporting.bind(this));
		document.querySelector("#settings-gadgets-button").addEventListener("click", this.gadgets.bind(this));

		document.querySelector("#settings-whitelist-users-button").addEventListener("click", this.whitelist.bind(this, "user"));
		document.querySelector("#settings-whitelist-pages-button").addEventListener("click", this.whitelist.bind(this, "page"));
		document.querySelector("#settings-whitelist-tags-button").addEventListener("click", this.whitelist.bind(this, "tag"));

		document.querySelector("#settings-highlight-users-button").addEventListener("click", this.highlight.bind(this, "user"));
		document.querySelector("#settings-highlight-pages-button").addEventListener("click", this.highlight.bind(this, "page"));
		document.querySelector("#settings-highlight-tags-button").addEventListener("click", this.highlight.bind(this, "tag"));

		document.querySelector("#settings-statistics-button").addEventListener("click", this.statistics.bind(this));
		document.querySelector("#settings-save-button").addEventListener("click", this.save.bind(this));

		document.querySelector("#settings-changelog-button").addEventListener("click", this.changelog.bind(this));
		document.querySelector("#settings-about-button").addEventListener("click", this.about.bind(this));

		{
			const $slider = document.querySelector("#settings-ores-bias");

			const $track = $slider.querySelector(".settings-slider-track");
			const $thumb = $slider.querySelector(".settings-slider-thumb");

			const $leftLabel = $slider.querySelector(".settings-slider-label-left");
			const $leftPercent = $leftLabel.querySelector(".percent");

			const $rightLabel = $slider.querySelector(".settings-slider-label-right");
			const $rightPercent = $rightLabel.querySelector(".percent");

			const updateValue = value => {
				this.ws.store.settings.queue.ores_bias = +value.toFixed(2);
				value = Math.max(0, Math.min(100, Math.round(value * 100)));

				$thumb.style.left = `${value}%`;
				$track.style.setProperty("--fill", `${value}%`);

				const left = 100 - value;
				$leftPercent.textContent = `${left}%`;
				$leftLabel.classList.toggle("active", left > 0);

				const right = value;
				$rightPercent.textContent = `${right}%`;
				$rightLabel.classList.toggle("active", right > 0);
			};

			const getValue = e => {
				const rect = $track.getBoundingClientRect();
				return ((e.clientX - rect.left) / rect.width);
			};

			$track.addEventListener("click", e => updateValue(getValue(e)));

			let dragging = false;
			$thumb.addEventListener("mousedown", e => {
				e.preventDefault();
				dragging = true;
				cockBlock++;
				$thumb.classList.add("dragging");
			});

			window.addEventListener("mousemove", e => {
				if (!dragging)
					return;
				updateValue(getValue(e));
			});

			window.addEventListener("mouseup", () => {
				if (!dragging)
					return;
				dragging = false;
				cockBlock--;
				$thumb.classList.remove("dragging");
			});

			updateValue(this.ws.store.settings.queue.ores_bias);
		}

		{
			const $edits = document.querySelector("#settings-maximum-edit-count");
			$edits.value = this.ws.store.settings.queue.max_edits;
			$edits.addEventListener("change", e => {
				const max = +e.target.value;
				this.ws.store.settings.queue.max_edits = max;

				for (const [ user, count ] of this.ws.queue.bypass.entries())
					if (count <= max)
						this.ws.queue.bypass.delete(user);
			});

			const $size = document.querySelector("#settings-maximum-queue-size");
			$size.value = this.ws.store.settings.queue.max_size;
			$size.addEventListener("change", e => this.ws.store.settings.queue.max_size = +e.target.value);

			const $ores = document.querySelector("#settings-minimum-ores-score");
			$ores.value = this.ws.store.settings.queue.min_ores;
			$ores.addEventListener("change", e => this.ws.store.settings.queue.min_ores = +e.target.value);

			const $watchlist = document.querySelector("#settings-watchlist-expiry");
			$watchlist.value = this.ws.store.settings.expiry.watchlist;
			$watchlist.addEventListener("change", e => this.ws.store.settings.expiry.watchlist = e.target.value);

			const $ns = document.querySelector("#settings-namespaces-container");
			$ns.innerHTML = "";
			namespaces.forEach(ns => {
				const $item = document.createElement("div");
				$item.className = "namespace-item";
				$item.dataset.namespaceId = ns.id;

				$item.innerHTML = `
					<label class="checkbox-box">
						<input type="checkbox" autoComplete="off">
						<div class="checkmark"></div>
					</label>
					<span class="namespace-name">${ns.name}</span>
				`;

				const $checkbox = $item.querySelector("input[type=checkbox]")
				$checkbox.checked = this.ws.store.settings.namespaces.includes(ns.id);
				$checkbox.addEventListener("change", e => {
					if (e.target.checked) {
						if (!this.ws.store.settings.namespaces.includes(ns.id))
							this.ws.store.settings.namespaces.push(ns.id);
					} else {
						const index = this.ws.store.settings.namespaces.indexOf(ns.id);
						if (index !== -1)
							this.ws.store.settings.namespaces.splice(index, 1);
					}
				});

				$ns.appendChild($item);
			});
		}

		{
			const $ores = document.querySelector("#settings-ORES-alert-toggle");
			$ores.value = this.ws.store.settings.audio.ores_alert.enabled;
			$ores.addEventListener("change", e => {
				this.ws.store.settings.audio.ores_alert.enabled = $ores.value;
			});

			const $threshold = document.querySelector("#settings-ORES-alert-threshold");
			$threshold.value = this.ws.store.settings.audio.ores_alert.threshold;
			$threshold.addEventListener("change", e => {
				this.ws.store.settings.audio.ores_alert.threshold = +$threshold.value;
			});

			const $master = document.querySelector("#settings-master-volume");
			$master.value = this.ws.store.settings.audio.volume.master;
			$master.addEventListener("change", e => {
				this.ws.store.settings.audio.volume.master = +$master.value;
			});

			const build = {
				sound: ($el, path, title, desc, preview) => {
					const key = [ "master", ...path ].join(".");

					const $volume = document.createElement("volume-control");
					$volume.setAttribute("title", title);
					$volume.setAttribute("description", desc);
					if (preview)
						$volume.setPreview(this.ws.audio, path);
					$volume.value = this.ws.store.settings.audio.volume[key];
					$volume.addEventListener("change", () => {
						const current = this.ws.store.settings.audio.volume[key];
						this.ws.store.settings.audio.volume[key] = $volume.value;
						if (current !== $volume.value)
							this.ws.audio.onvolumechanged();
					});
					$el.appendChild($volume);
				},
				category: ($el, path, title, desc) => {
					const key = [ "master", ...path ].join(".");

					const $section = this.collapsible($el, collapsed => title, desc, true);
					const $volume = document.createElement("volume-control");
					$volume.setAttribute("title", "Category Volume");
					$volume.value = this.ws.store.settings.audio.volume[key];
					$volume.addEventListener("change", () => {
						const current = this.ws.store.settings.audio.volume[key];
						this.ws.store.settings.audio.volume[key] = $volume.value;
						if (current !== $volume.value)
							this.ws.audio.onvolumechanged();
					});
					$section.appendChild($volume);

					const $content = document.createElement("div");
					$content.className = "settings-content";
					$section.appendChild($content);

					return $content;
				},
			};

			const loop = (obj, path, $el) => {
				for (const [ key, value ] of Object.entries(obj)) {
					switch (value.type) {
						case "sound": {
							build.sound($el, [ ...path, key ], value.title, value.description, value.preview ?? true);
						} break;
						case "category": {
							loop(value.properties, [ ...path, key ], build.category($el, [ ...path, key ], value.title, value.description));
						} break;
					}
				}
			};

			loop(this.ws.audio.audio, [ ], document.querySelector("#settings-sounds-container"));
		}

		{
			const $repeatScripts = document.querySelector("#repeat-control-scripts-toggle");
			$repeatScripts.value = this.ws.store.settings.repeat_control_scripts;
			$repeatScripts.addEventListener("change", e => this.ws.store.settings.repeat_control_scripts = $repeatScripts.value);

			document.querySelector("#settings-new-control-script").addEventListener("click", async () => {
				this.ws.store.control_scripts.unshift({
					keys: [],
					actions: [],
				});
				this.controls();
			});
		}

		{
			const $zen = document.querySelector("#settings-zen-mode");
			$zen.value = this.ws.store.settings.zen_mode.enabled;
			$zen.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.enabled = $zen.value;
				this.ws.gui.updateZenMode();
			});

			const $sound = document.querySelector("#settings-zen-mode-sound");
			$sound.value = this.ws.store.settings.zen_mode.sound.enabled;
			$sound.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.sound.enabled = $sound.value;
				this.ws.gui.updateZenMode();
			});

			const $music = document.querySelector("#settings-zen-mode-music");
			$music.value = this.ws.store.settings.zen_mode.music.enabled;
			$music.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.music.enabled = $music.value;
				this.ws.gui.updateZenMode();
			});

			const $alerts = document.querySelector("#settings-zen-mode-alerts");
			$alerts.value = this.ws.store.settings.zen_mode.alerts.enabled;
			$alerts.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.alerts.enabled = $alerts.value;
				this.ws.gui.updateZenMode();
			});

			const $messages = document.querySelector("#settings-zen-mode-messages");
			$messages.value = this.ws.store.settings.zen_mode.messages.enabled;
			$messages.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.messages.enabled = $messages.value;
				this.ws.gui.updateZenMode();
			});

			const $toasts = document.querySelector("#settings-zen-mode-toasts");
			$toasts.value = this.ws.store.settings.zen_mode.toasts.enabled;
			$toasts.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.toasts.enabled = $toasts.value;
				this.ws.gui.updateZenMode();
			});

			const $badges = document.querySelector("#settings-zen-mode-badges");
			$badges.value = this.ws.store.settings.zen_mode.badges.enabled;
			$badges.addEventListener("change", e => {
				this.ws.store.settings.zen_mode.badges.enabled = $badges.value;
				this.ws.gui.updateZenMode();
			});
		}

		{
			if (false) {
				const $theme = document.querySelector("#settings-app-theme");

				document.querySelectorAll("#settings-app-theme .selected").forEach($el => $el.classList.remove("selected"));
				document.querySelector(`#settings-app-theme [data-value=${this.ws.store.UI.theme.app}]`).classList.add("selected");

				const $light = $theme.querySelector("[data-value=light]");
				$light.addEventListener("click", () => {
					$theme.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$light.classList.add("selected");
					this.ws.store.UI.theme.app = "light";
					document.documentElement.style.colorScheme = "only light";
				});

				const $auto = $theme.querySelector("[data-value=auto]");
				$auto.addEventListener("click", () => {
					$theme.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$auto.classList.add("selected");
					this.ws.store.UI.theme.app = "auto";
					document.documentElement.style.colorScheme = "light dark";
				});

				const $dark = $theme.querySelector("[data-value=dark]");
				$dark.addEventListener("click", () => {
					$theme.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$dark.classList.add("selected");
					this.ws.store.UI.theme.app = "dark";
					document.documentElement.style.colorScheme = "only dark";
				});
			}

			if (!window.isElectron) {
				const $launch = document.querySelector("#settings-launch-behavior");

				document.querySelectorAll("#settings-launch-behavior .selected").forEach($el => $el.classList.remove("selected"));
				document.querySelector(`#settings-launch-behavior [data-value=${electron.localStorage.get("WikiShield:OpenExternally") ? "new_tab" : "current_tab"}]`).classList.add("selected");

				const $current = $launch.querySelector("[data-value=current_tab]");
				$current.addEventListener("click", () => {
					$launch.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$current.classList.add("selected");
					electron.localStorage.set("WikiShield:OpenExternally", false);
				});

				const $new = $launch.querySelector("[data-value=new_tab]");
				$new.addEventListener("click", () => {
					$launch.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$new.classList.add("selected");
					electron.localStorage.set("WikiShield:OpenExternally", true);
				});
			}

			{
				const $performance = document.querySelector("#settings-startup-performance");

				document.querySelectorAll("#settings-startup-performance .selected").forEach($el => $el.classList.remove("selected"));
				document.querySelector(`#settings-startup-performance [data-value=${this.ws.store.settings.performance.startup}]`).classList.add("selected");

				const $off = $performance.querySelector("[data-value=always_off]");
				$off.addEventListener("click", () => {
					$performance.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$off.classList.add("selected");
					this.ws.store.settings.performance.startup = "always_off";
				});

				const $adaptive = $performance.querySelector("[data-value=adaptive]");
				$adaptive.addEventListener("click", () => {
					$performance.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$adaptive.classList.add("selected");
					this.ws.store.settings.performance.startup = "adaptive";
				});

				const $on = $performance.querySelector("[data-value=always_on]");
				$on.addEventListener("click", () => {
					$performance.querySelectorAll(".selected").forEach($el => $el.classList.remove("selected"));
					$on.classList.add("selected");
					this.ws.store.settings.performance.startup = "always_on";
				});
			}
		}

		{
			const $queue = document.querySelector("#settings-queues");
			Queue.types
				.map(type => ({ type, data: this.ws.store.settings.queue[type] }))
				.sort((a, b) => a.data.order - b.data.order)
				.forEach(queue => {
					const $item = document.createElement("draggable-order-item");
					$item.setAttribute("key", queue.type);
					$item.setAttribute("name", ({
						recent: "Recent changes",
						pending: "Pending changes",
						users: "User creations",
						watchlist: "Watchlist",
						abuselog: "Abuse log"
					})[queue.type] ?? queue.type);
					$item.enabled = queue.data.enabled;

					$queue.addItem($item, queue.type);
				});

			$queue.addEventListener("toggle", e => {
				const queueType = e.target.closest('draggable-order-item')?.getAttribute('key');
				if (queueType) {
					this.ws.store.settings.queue[queueType].enabled = e.detail.enabled;
					this.ws.gui.reorderQueues();
				}
			});

			$queue.addEventListener("reorder", e => {
				e.detail.keys.forEach((key, index) => {
					this.ws.store.settings.queue[key].order = index;
					this.ws.gui.reorderQueues();
				});
			});

			const $palettes = document.querySelector("#settings-palette-selector");
			Object.entries(GUI.palettes).forEach(([key, palette]) => {
				const $palette = document.createElement("div");
				$palette.className = "palette-option";
				$palette.classList.toggle("selected", this.ws.store.UI.theme.palette === key);
				$palette.dataset.palette = key;
				$palette.addEventListener("click", () => {
					document.querySelectorAll(".palette-option.selected").forEach($el => $el.classList.remove("selected"));
					$palette.classList.add("selected");
					this.ws.store.UI.theme.palette = key;
					this.ws.gui.updatePalette();
				});
				$palettes.appendChild($palette);

				const $name = document.createElement("div");
				$name.className = "palette-name";
				$name.textContent = new Text(key).case(Text.Case.Title).get();
				$palette.appendChild($name);

				const $preview = document.createElement("div");
				$preview.className = "palette-preview";
				$palette.appendChild($preview);

				const len = palette.length;
				const paper = document.createElement("canvas");
				paper.width = len;
				paper.height = 1;
				const pen = paper.getContext("2d");
				const imgData = pen.createImageData(len, 1);
				palette.forEach((color, i) => {
					const rgb = color.match(/\d+/g).map(v => parseInt(v, 10));
					const offset = i * 4;
					imgData.data[offset] = rgb[0];
					imgData.data[offset + 1] = rgb[1];
					imgData.data[offset + 2] = rgb[2];
					imgData.data[offset + 3] = 255;
				});
				pen.putImageData(imgData, 0, 0);
				$preview.appendChild(paper);
			});
		}

		{
			/* const $colorblind = document.querySelector("#settings-colorblind-mode");
			$colorblind.value = this.ws.store.settings.accessibility.colorblind;
			$colorblind.addEventListener("change", e => {
				this.ws.store.settings.accessibility.colorblind = $colorblind.value;
				this.ws.gui.updateAccessibility();
			}); */

			const $dyslexia = document.querySelector("#settings-dyslexia-font");
			$dyslexia.value = this.ws.store.settings.accessibility.dyslexia;
			$dyslexia.addEventListener("change", e => {
				this.ws.store.settings.accessibility.dyslexia = $dyslexia.value;
				this.ws.gui.updateAccessibility();
			});

			/* const $contrast = document.querySelector("#settings-high-contrast-mode");
			$contrast.value = this.ws.store.settings.accessibility.high_contrast;
			$contrast.addEventListener("change", e => {
				this.ws.store.settings.accessibility.high_contrast = $contrast.value;
				this.ws.gui.updateAccessibility();
			}); */

			const $motion = document.querySelector("#settings-reduce-motion");
			$motion.value = this.ws.store.settings.accessibility.reduce_motion;
			$motion.addEventListener("change", e => {
				this.ws.store.settings.accessibility.reduce_motion = $motion.value;
				this.ws.gui.updateAccessibility();
			});
		}

		{
			const $AI = document.querySelector("#settings-AI-toggle");
			$AI.value = this.ws.store.settings.AI.enabled;
			$AI.addEventListener("change", e => {
				this.ws.AI?.cancel.all(true);

				this.ws.store.settings.AI.enabled = $AI.value;
				if (this.ws.store.settings.AI.enabled)
					switch (this.ws.store.settings.AI.provider) {
						case "Ollama": {
							this.ws.AI = new AI.providers.Ollama(this.ws, this.ws.store.settings.AI.Ollama);
						} break;
						default: {
							this.ws.AI = null;
						} break;
					}
				else
					this.ws.AI = null;
			});

			const $editAnalysis = document.querySelector("#settings-AI-edit-analysis-toggle");
			$editAnalysis.value = this.ws.store.settings.AI.edit_analysis.enabled;
			$editAnalysis.addEventListener("change", e => this.ws.store.settings.AI.edit_analysis.enabled = e.target.value);

			const $usernameAnalysis = document.querySelector("#settings-AI-username-analysis-toggle");
			$usernameAnalysis.value = this.ws.store.settings.AI.username_analysis.enabled;
			$usernameAnalysis.addEventListener("change", e => this.ws.store.settings.AI.username_analysis.enabled = e.target.value);

			const $url = document.querySelector("#ollama-url-input");
			$url.value = this.ws.store.settings.AI.Ollama.server;
			$url.addEventListener("change", e => {
				this.ws.store.settings.AI.Ollama.server = $url.value.trim();
				if (this.ws.store.settings.AI.provider === "Ollama" && this.ws.AI)
					this.ws.AI.cancel.all(true);
			});

			const $test = document.querySelector("#settings-ollama-test-connection");
			$test.addEventListener("click", async () => {
				if ($test.disabled) return;
				$test.disabled = true;

				const $status = document.querySelector("#settings-ollama-connection-status");
				const $container = $status.parentElement;

				$container.classList.add("testing");
				$container.classList.remove("connected", "failed");

				$status.classList.add("animate-loading-dots");
				$status.textContent = "Testing connection";

				let temp;
				switch (this.ws.store.settings.AI.provider) {
					case "Ollama": {
						temp = new AI.providers.Ollama(this.ws, this.ws.store.settings.AI.Ollama);
					} break;
				}

				this.ws.AI?.cancel.all(true);
				if (temp instanceof AI && await temp.test()) {
					$container.classList.add("connected");
					$container.classList.remove("testing", "failed");

					$status.innerHTML = "<span class='fa fa-check-circle'></span> Connected!";
				} else {
					$container.classList.add("failed");
					$container.classList.remove("testing", "connected");

					$status.innerHTML = "<span class='fa fa-times-circle'></span> Failed to connect.<br><small>Make sure you have followed the setup instructions (see below)</small>";
				}

				$status.classList.remove("animate-loading-dots");
				$test.disabled = false;
			});

			const $refresh = document.querySelector("#settings-ollama-refresh-models");
			$refresh.addEventListener("click", async () => {
				if ($refresh.disabled) return;
				$refresh.disabled = true;

				const $models = document.querySelector("#settings-ollama-models");

				const $status = document.querySelector("#settings-ollama-models-status");
				const $container = $status.parentElement;

				$status.textContent = "Searching";
				$container.classList.add("searching", "animate-loading-dots");
				$container.classList.remove("none", "error");

				this.ws.AI?.cancel.all(true);

				try {
					let temp;
					switch (this.ws.store.settings.AI.provider) {
						case "Ollama": {
							temp = new AI.providers.Ollama(this.ws, this.ws.store.settings.AI.Ollama);
						} break;
					}

					const models = (temp instanceof AI && await temp.models()) || [ ];
					if (models.length > 0) {
						$container.classList.remove("searching", "none", "error", "animate-loading-dots");
						$status.innerHTML = `<span class="fa fa-check-circle"></span> Found ${models.length} ${new Text("model").get(models.length)}.`;

						$models.innerHTML = "";
						models.forEach(model => {
							const isSelected = model.name === this.ws.store.settings.AI.Ollama.model;

							const $model = document.createElement("div");
							$model.className = "model";
							$model.classList.toggle("selected", isSelected);
							$model.dataset.model = model.name;
							$models.appendChild($model);

							const $top = document.createElement("div");
							$top.className = "model-top";
							$model.appendChild($top);

							const $button = document.createElement("span");
							$button.className = "indicator fa";
							$button.classList.add(isSelected ? "fa-check-circle" : "fa-circle");
							$top.appendChild($button);

							const $name = document.createElement("span");
							$name.className = "model-name";
							$name.textContent = model.name;
							$top.appendChild($name);

							/*
								LOL i just found this comment in the old code, and i still can't be bothered to fix it
								here's the comment if anyone is actually reading this:
								// i don't feel like figuring out the css to truly center the model name, so just add an invisible element to take up space
							*/
							const $psuedo = document.createElement("span");
							$psuedo.className = "psuedo-indicator fa fa-circle";
							$top.appendChild($psuedo);

							const $bottom = document.createElement("div");
							$bottom.className = "model-bottom";
							$model.appendChild($bottom);

							const $size = document.createElement("span");
							$size.className = "model-size";
							$size.textContent = this.ws.util.formatBytes(model.size);
							$bottom.appendChild($size);

							const $modified = document.createElement("span");
							$modified.className = "model-modified";
							$modified.textContent = new Date(model.modified_at).toLocaleDateString();
							$bottom.appendChild($modified);

							$model.addEventListener("click", () => {
								this.ws.AI?.cancel.all(true);

								switch (this.ws.store.settings.AI.provider) {
									case "Ollama": {
										this.ws.store.settings.AI.Ollama.model = model.name;
									} break;
								}

								$models.querySelectorAll(".model.selected").forEach($el => {
									$el.classList.remove("selected");

									const $indicator = $el.querySelector(".indicator");
									$indicator.classList.remove("fa-circle");
									$indicator.classList.add("fa-check-circle");
								});

								$model.classList.add("selected");

								const $indicator = $model.querySelector(".indicator");
								$indicator.classList.remove("fa-circle");
								$indicator.classList.add("fa-check-circle");
							});
						});
					} else {
						$container.classList.add("none");
						$container.classList.remove("searching", "error", "animate-loading-dots");

						$status.textContent = "No models found.";
					}
				} catch (error) {
					$container.classList.add("error");
					$container.classList.remove("searching", "none", "animate-loading-dots");

					$status.innerHTML = "<span class='fa fa-times-circle'></span> Error fetching models.";
				}

				$refresh.disabled = false;
			});
		}

		{
			const $reporting = document.querySelector("#settings-auto-reporting-toggle");
			$reporting.value = this.ws.store.settings.auto_report.enabled;
			$reporting.addEventListener("change", e => {
				this.ws.store.settings.auto_report.enabled = $reporting.value;
			});

			const $warnings = document.querySelector("#settings-auto-reporting-warnings-container");
			Object.entries(warningsLookup)
				.filter(([key, warning]) => warning.reportable)
				.sort((a, b) => a[1].title.localeCompare(b[1].title))
				.forEach(([key, warning]) => {
					const $item = document.createElement("div");
					$item.className = "auto-reportable-warning-item";
					$item.innerHTML = `
						<label class="checkbox-box" data-warning-key="${key}">
							<input type="checkbox" autoComplete="off" ${this.ws.store.settings.auto_report.for.has(key) ? "checked" : ""}>
							<div class="checkmark"></div>
						</label>
						<span class="checkbox-name">${warning.title}</span>
					`;
					$item.querySelector("input[type=checkbox]").addEventListener("change", e => {
						if (e.target.checked) {
							if (!this.ws.store.settings.auto_report.for.has(key))
								this.ws.store.settings.auto_report.for.add(key);
						} else
							this.ws.store.settings.auto_report.for.delete(key);
					});
					$warnings.appendChild($item);
				});
		}

		{
			const $welcome = document.querySelector("#settings-auto-welcome-toggle");
			$welcome.value = this.ws.store.settings.auto_welcome.enabled;
			$welcome.addEventListener("change", e => {
				this.ws.store.settings.auto_welcome.enabled = $welcome.value;
			});

			const $popups = document.querySelector("#settings-wikipedia-popups-toggle");
			$popups.value = this.ws.store.settings.wikipedia_popups.enabled;
			$popups.addEventListener("change", e => {
				this.ws.store.settings.wikipedia_popups.enabled = $popups.value;
			});

			const $talkPageThanksForTemporaryUsersToggle = document.querySelector("#talk-page-thanks-for-temporary-users-toggle");
			$talkPageThanksForTemporaryUsersToggle.value = this.ws.store.settings.talk_page_thanks_for_temporary_users.enabled;
			$talkPageThanksForTemporaryUsersToggle.addEventListener("change", e => {
				this.ws.store.settings.talk_page_thanks_for_temporary_users.enabled = $talkPageThanksForTemporaryUsersToggle.value;
			});

			const $highlight = document.querySelector("#settings-username-highlighting-toggle");
			$highlight.value = this.ws.store.settings.username_highlighting.enabled;
			$highlight.addEventListener("change", e => {
				this.ws.store.settings.username_highlighting.enabled = $highlight.value;
			});

			const $fuzzy = document.querySelector("#settings-username-highlighting-fuzzy-toggle");
			$fuzzy.value = this.ws.store.settings.username_highlighting.fuzzy;
			$fuzzy.addEventListener("change", e => {
				this.ws.store.settings.username_highlighting.fuzzy = $fuzzy.value;
			});
		}

		{
			const $status = document.querySelector("#settings-save-status");

			const $export = document.querySelector("#settings-export-button");
			$export.addEventListener("click", async e => {
				try {
					const b64 = this.ws.export();
					electron.copyToClipboard(b64);

					$status.classList.remove("hidden", "error", "info");
					$status.classList.add("success");
					$status.innerHTML = `
						<div class="status-content">
							<i class="fa fa-check-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Settings exported successfully!</div>
								<div class="status-desc">The base64 string has been copied to your clipboard.</div>
							</div>
						</div>
					`;
				} catch (error) {
					$status.classList.remove("hidden", "success", "info");
					$status.classList.add("error");
					$status.innerHTML = `
						<div class="status-content">
							<i class="fa fa-times-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Export failed!</div>
								<div class="status-desc">${error.message}</div>
							</div>
						</div>
					`;
				}
			});

			const $import = document.querySelector("#settings-import-button");
			$import.addEventListener("click", async e => {
				try {
					const b64 = await this.ws.gui.dialog.input("Import Settings", "Please paste the base64 string of your exported settings below:");
					if (!b64) throw new Error("No input provided.");

					const logs = await this.ws.noinit(b64);
					const [ expected, unexpected ] = logs.reduce((acc, log) => {
						if (log.expected)
							acc[0].push(log);
						else
							acc[1].push(log);
						return acc;
					}, [ [], [] ]);

					$status.classList.remove("hidden", "error", "info");
					$status.classList.add("success");
					$status.innerHTML = `
						<div class="status-content">
							<i class="fa fa-check-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Settings imported successfully!</div>
								<div class="status-desc">
									${unexpected.length > 0 ? `<br><br><strong>Encountered ${new Text("%n issue").get(unexpected.length)}:</strong><br>${unexpected.map(log => `- ${log.message}`).join("<br>")}` : ""}
								</div>
							</div>
						</div>
					`;
				} catch (error) {
					$status.classList.remove("hidden", "success", "info");
					$status.classList.add("error");
					$status.innerHTML = `
						<div class="status-content">
							<i class="fa fa-times-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Import failed!</div>
								<div class="status-desc">${error.message}</div>
							</div>
						</div>
					`;
				}
			});

			const $reset = document.querySelector("#settings-reset-button");
			$reset.addEventListener("click", async e => {
				const confirm = await this.ws.gui.dialog.confirm("Reset Settings", "Are you sure you want to reset all settings to their default values? This action cannot be undone.", "Reset Settings", true);
				if (!confirm) return;

				this.ws.noinit("e30="); // "{}" in base64

				$status.classList.remove("hidden", "error", "success");
				$status.classList.add("info");
				$status.innerHTML = `
					<div class="status-content">
						<i class="fa fa-info-circle status-icon"></i>
						<div class="status-text">
							<div class="status-title">Settings reset successfully.</div>
							<div class="status-desc">All settings have been restored to their default values.</div>
						</div>
					</div>
				`;
			});
		}

		{
			document.querySelectorAll("#settings-container > .settings > .settings-right > .about [data-link]").forEach($el => {
				$el.addEventListener("click", event => this.ws.open($el.dataset.link, event.altKey));
			});
		}
	}

	// update all values
	update() {
		{
			document.querySelector("#settings-maximum-edit-count").value = this.ws.store.settings.queue.max_edits;
			document.querySelector("#settings-maximum-queue-size").value = this.ws.store.settings.queue.max_size;
			document.querySelector("#settings-minimum-ores-score").value = this.ws.store.settings.queue.min_ores;

			document.querySelector("#settings-watchlist-expiry").value = this.ws.store.settings.expiry.watchlist;

			document.querySelectorAll("#settings-namespaces-container .namespace-item").forEach($item => {
				const ns = parseInt($item.dataset.namespaceId, 10);
				$item.querySelector("input[type=checkbox]").checked = this.ws.store.settings.namespaces.includes(ns);
			});
		}

		{
			document.querySelector("#settings-zen-mode").value = this.ws.store.settings.zen_mode.enabled;
			document.querySelector("#settings-zen-mode-sound").value = this.ws.store.settings.zen_mode.sound.enabled;
			document.querySelector("#settings-zen-mode-music").value = this.ws.store.settings.zen_mode.music.enabled;
			document.querySelector("#settings-zen-mode-alerts").value = this.ws.store.settings.zen_mode.alerts.enabled;
			document.querySelector("#settings-zen-mode-messages").value = this.ws.store.settings.zen_mode.messages.enabled;
			document.querySelector("#settings-zen-mode-toasts").value = this.ws.store.settings.zen_mode.toasts.enabled;
			document.querySelector("#settings-zen-mode-badges").value = this.ws.store.settings.zen_mode.badges.enabled;
		}

		{
			document.querySelectorAll("#settings-startup-performance .selected").forEach($el => $el.classList.remove("selected"));
			document.querySelector(`#settings-startup-performance [data-value=${this.ws.store.settings.performance.startup}]`).classList.add("selected");
		}

		{
			const $queue = document.querySelector("#settings-queues");
			$queue.clearItems();
			Queue.types
				.map(type => ({ type, data: this.ws.store.settings.queue[type] }))
				.sort((a, b) => a.data.order - b.data.order)
				.forEach(queue => {
					const $item = document.createElement("draggable-order-item");
					$item.setAttribute("key", queue.type);
					$item.setAttribute("name", ({
						recent: "Recent changes",
						pending: "Pending changes",
						users: "User creations",
						watchlist: "Watchlist"
					})[queue.type] ?? queue.type);
					$item.enabled = queue.data.enabled;

					$queue.addItem($item, queue.type);
				});

			document.querySelectorAll(".palette-option").forEach($el => {
				$el.classList.toggle("selected", $el.dataset.palette === this.ws.store.UI.theme.palette);
			});
		}

		{
			document.querySelector("#settings-AI-toggle").value = this.ws.store.settings.AI.enabled;
			document.querySelector("#settings-AI-edit-analysis-toggle").value = this.ws.store.settings.AI.edit_analysis.enabled;
			document.querySelector("#settings-AI-username-analysis-toggle").value = this.ws.store.settings.AI.username_analysis.enabled;

			document.querySelector("#ollama-url-input").value = this.ws.store.settings.AI.Ollama.server;

			{
				const $status = document.querySelector("#settings-ollama-connection-status");
				const $container = $status.parentElement;

				$status.innerHTML = "";
				$container.classList.remove("testing", "connected", "failed");
			}

			{
				const $models = document.querySelector("#settings-ollama-models");
				$models.querySelectorAll(".model").forEach($el => $el.remove());

				const $status = document.querySelector("#settings-ollama-models-status");
				const $container = $status.parentElement;

				$status.innerHTML = "";
				$container.classList.remove("searching", "none", "error");
			}
		}

		{
			document.querySelector("#settings-auto-reporting-toggle").value = this.ws.store.settings.auto_report.enabled;

			document.querySelectorAll("#settings-auto-reporting-warnings-container .auto-reportable-warning-item").forEach($item => {
				const key = $item.querySelector("label").dataset.warningKey;
				$item.querySelector("input[type=checkbox]").checked = this.ws.store.settings.auto_report.for.has(key);
			});
		}

		{
			document.querySelector("#settings-auto-welcome-toggle").value = this.ws.store.settings.auto_welcome.enabled;

			document.querySelector("#settings-wikipedia-popups-toggle").value = this.ws.store.settings.wikipedia_popups.enabled;

			document.querySelector("#settings-username-highlighting-toggle").value = this.ws.store.settings.username_highlighting.enabled;
			document.querySelector("#settings-username-highlighting-fuzzy-toggle").value = this.ws.store.settings.username_highlighting.fuzzy;
		}
	}

	open() {
		document.querySelector("#settings-container").classList.add("show");
		this.general();

		this.#promise = new Promise(resolve => {
			this.#promiseResolve = resolve;
		});
	}
	close() {
		this.deselect();
		this.ws.audio.stopPreviews();

		document.querySelector("#settings-container").classList.remove("show");
		if (this.#promiseResolve) {
			this.#promiseResolve();
			this.#promiseResolve = null;
		}
	}

	waitForClose() {
		return this.#promise;
	}

	deselect() {
		document.querySelectorAll("#settings-container > .settings > .settings-left .settings-left-menu-item.selected").forEach($item => $item.classList.remove("selected"));
		document.querySelectorAll("#settings-container > .settings > .settings-right > :not(.hidden)").forEach($section => $section.classList.add("hidden"));
	}

	general() {
		this.deselect();

		document.querySelector("#settings-general-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .general").classList.remove("hidden");
	}
	performance() {
		this.deselect();

		document.querySelector("#settings-performance-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .performance").classList.remove("hidden");
	}
	audio() {
		this.deselect();

		document.querySelector("#settings-audio-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .audio").classList.remove("hidden");
	}
	controls() {
		this.deselect();

		document.querySelector("#settings-controls-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .controls").classList.remove("hidden");

		{
			const findParentAction = (action, parent) => {
				if (parent.actions.includes(action))
					return parent;

				for (const act of parent.actions)
					if (act.name === "if" || act.name === "if not") {
						const found = findParentAction(action, act);
						if (found)
							return found;
					}

				return null;
			};

			const createActionItem = ($action, action, script, callback) => {
				const $item = document.createElement("div");
				$item.className = "control-action";
				$action.appendChild($item);

				if (action.name === "if" || action.name === "if not") {
					$item.innerHTML = `
						<div class="control-action-title">
							<div class="control-action-title-left">
								<span class="fas fa-circle-question"></span>
								${action.name === "if" ? "If" : "If not"} <select></select> <span class="params"></span> then:
							</div>
							<div class="control-action-title-right">
								<span class="fas fa-chevron-up move-action-up"></span>
								<span class="fas fa-chevron-down move-action-down"></span>
								<span class="fas fa-trash-can delete-action"></span>
							</div>
						</div>
					`;

					const $select = $item.querySelector("select");
					Object.entries(conditions).forEach(([ key, condition ]) => {
						if ("title" in condition)
							$select.innerHTML += `<option value="${key}">${condition.title}</option>`;
						else
							$select.innerHTML += `<option value="${key}">${key}</option>`;
					});

					const condition = action.condition ?? { name: Object.keys(conditions)[0], params: { } };
					condition.name ??= Object.keys(conditions)[0];
					condition.params ??= { };

					$select.value = condition.name;

					$select.addEventListener("change", e => {
						condition.name = $select.value;
						callback();
					});

					const dependencyMap = new Map();
					for (const param of sortDependencies(conditions[condition.name].parameters?.() || [])) {
						const $param = document.createElement("div");
						$param.className = "condition-parameter";
						$item.querySelector(".params").appendChild($param);

						const dependencies = { };
						for (const dependent of param.dependencies ?? [])
							dependencies[dependent] = condition.params[dependent];

						const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;

						let callback = null;
						switch (param.type) {
							case "choice": {
								const $select = document.createElement("select");
								$select.dataset.paramid = param.id;
								$param.appendChild($select);

								const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
								for (const option of options ?? []) {
									const $option = document.createElement("option");
									$option.value = option;
									$option.textContent = option;
									$select.appendChild($option);
								}

								if (condition.params[param.id] !== undefined) {
									$select.value = condition.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$select.value = _default;
									condition.params[param.id] = _default;
								}

								callback = () => {
									const dependencies = { };
									for (const dependent of param.dependencies ?? [])
										dependencies[dependent] = condition.params[dependent];

									const value = $select.value;

									const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
									$select.innerHTML = "";
									for (const option of options ?? []) {
										const $option = document.createElement("option");
										$option.value = option;
										$option.textContent = option;
										$select.appendChild($option);
									}

									if (options.includes(value))
										$select.value = value;
									else {
										const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;
										$select.value = _default;
										condition.params[param.id] = _default;
									}
								};

								$select.addEventListener("change", () => {
									condition.params[param.id] = $select.value;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "text": {
								const $input = document.createElement("input");
								$input.type = "text";
								$input.dataset.paramid = param.id;
								$param.appendChild($input);

								if (condition.params[param.id] !== undefined) {
									$input.value = condition.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.value = _default;
									condition.params[param.id] = _default;
								}

								$input.addEventListener("change", () => {
									condition.params[param.id] = $input.value;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "boolean": {
								const $input = document.createElement("input");
								$input.type = "checkbox";
								$input.dataset.paramid = param.id;
								$param.appendChild($input);

								if (condition.params[param.id] !== undefined) {
									$input.checked = condition.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.checked = _default;
									condition.params[param.id] = _default;
								}

								$input.addEventListener("change", () => {
									condition.params[param.id] = $input.checked;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "number": {
								const $input = document.createElement("input");
								$input.type = "number";
								$input.dataset.paramid = param.id;
								if ("min" in param) $input.min = param.min;
								if ("max" in param) $input.max = param.max;
								$param.appendChild($input);

								if (condition.params[param.id] !== undefined) {
									$input.value = condition.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.value = _default;
									condition.params[param.id] = _default;
								}
								$input.addEventListener("change", () => {
									condition.params[param.id] = parseFloat($input.value);
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
						}

						if (typeof callback === "function")
							for (const dependent of param.dependencies ?? []) {
								if (!dependencyMap.has(dependent))
									dependencyMap.set(dependent, [ ]);
								dependencyMap.get(dependent).push(callback);
							}
					}

					for (const subaction of action.actions)
						createActionItem($item, subaction, script, callback);
				} else {
					const event = events[action.name];
					$item.innerHTML = `
						<div class="control-action-title">
							<div class="control-action-title-left">
								<span class="${"icon" in event ? event.icon : "fas fa-bolt"}"></span>
								${"title" in event ? event.title : action.name}
							</div>
							<div class="control-action-title-right">
								<span class="fas fa-chevron-up move-action-up"></span>
								<span class="fas fa-chevron-down move-action-down"></span>
								<span class="fas fa-trash-can delete-action"></span>
							</div>
						</div>
					`;

					const dependencyMap = new Map();
					for (const param of sortDependencies(event.parameters?.() || [])) {
						const $param = document.createElement("div");
						$param.className = "action-parameter";
						$param.innerHTML = `<div class="parameter-title">${param.title}</div>`;
						$item.appendChild($param);

						const dependencies = { };
						for (const dependent of param.dependencies ?? [])
							dependencies[dependent] = action.params[dependent];

						const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;

						let callback = null;
						switch (param.type) {
							case "choice": {
								const $select = document.createElement("select");
								$select.dataset.paramid = param.id;
								$param.appendChild($select);

								const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
								for (const option of options ?? []) {
									const $option = document.createElement("option");
									$option.value = option;
									$option.textContent = option;
									$select.appendChild($option);
								}

								if (action.params[param.id] !== undefined) {
									$select.value = action.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$select.value = _default;
									action.params[param.id] = _default;
								}

								callback = () => {
									const dependencies = { };
									for (const dependent of param.dependencies ?? [])
										dependencies[dependent] = action.params[dependent];

									const value = $select.value;

									const options = typeof param.options === "function" ? param.options(dependencies) : param.options;
									$select.innerHTML = "";
									for (const option of options ?? []) {
										const $option = document.createElement("option");
										$option.value = option;
										$option.textContent = option;
										$select.appendChild($option);
									}

									if (options.includes(value))
										$select.value = value;
									else {
										const _default = typeof param.default === "function" ? param.default(dependencies) : param.default;
										$select.value = _default;
										action.params[param.id] = _default;
									}
								};

								$select.addEventListener("change", () => {
									action.params[param.id] = $select.value;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "text": {
								const $input = document.createElement("input");
								$input.type = "text";
								$input.dataset.paramid = param.id;
								$param.appendChild($input);

								if (action.params[param.id] !== undefined) {
									$input.value = action.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.value = _default;
									action.params[param.id] = _default;
								}

								$input.addEventListener("change", () => {
									action.params[param.id] = $input.value;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "boolean": {
								const $input = document.createElement("input");
								$input.type = "checkbox";
								$input.dataset.paramid = param.id;
								$param.appendChild($input);

								if (action.params[param.id] !== undefined) {
									$input.checked = action.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.checked = _default;
									action.params[param.id] = _default;
								}

								$input.addEventListener("change", () => {
									action.params[param.id] = $input.checked;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
							case "duration": {
								const $input = document.createElement("duration-input");
								$input.dataset.paramid = param.id;
								$param.appendChild($input);

								if (action.params[param.id] !== undefined) {
									$input.value = action.params[param.id];
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								} else if ("default" in param) {
									$input.value = _default;
									action.params[param.id] = _default;
								}

								$input.addEventListener("change", () => {
									action.params[param.id] = $input.value;
									for (const cb of dependencyMap.get(param.id) || [])
										cb();
								});
							} break;
						}

						if (typeof callback === "function")
							for (const dependent of param.dependencies ?? []) {
								if (!dependencyMap.has(dependent))
									dependencyMap.set(dependent, [ ]);
								dependencyMap.get(dependent).push(callback);
							}
					}
				}

				$item.querySelector(".move-action-up").addEventListener("click", () => {
					this.ws.audio.playSound([ "ui", "click" ]);

					const parent = findParentAction(action, script);
					const index = parent.actions.indexOf(action);
					if (parent.actions.indexOf(action) === 0) {
						if (parent.name !== "if" && parent.name !== "if not") return;

						const grandparent = findParentAction(parent, script);
						grandparent.actions.splice(grandparent.actions.indexOf(parent), 0, action);
						parent.actions.splice(index, 1);
					} else {
						const temp = parent.actions[index - 1];
						if (temp.name === "if" || temp.name === "if not") {
							temp.actions.push(action);
							parent.actions.splice(index, 1);
						} else {
							parent.actions.splice(index, 1);
							parent.actions.splice(index - 1, 0, action);
						}
					}

					callback();
				});

				$item.querySelector(".move-action-down").addEventListener("click", () => {
					this.ws.audio.playSound([ "ui", "click" ]);

					const parent = findParentAction(action, script);
					const index = parent.actions.indexOf(action);
					if (parent.actions.indexOf(action) === parent.actions.length - 1) {
						if (parent.name !== "if" && parent.name !== "if not") return;

						const grandparent = findParentAction(parent, script);
						grandparent.actions.splice(grandparent.actions.indexOf(parent) + 1, 0, action);
						parent.actions.splice(index, 1);
					} else {
						const temp = parent.actions[index + 1];
						if (temp.name === "if" || temp.name === "if not") {
							temp.actions.unshift(action);
							parent.actions.splice(index, 1);
						} else {
							parent.actions.splice(index, 1);
							parent.actions.splice(index + 1, 0, action);
						}
					}

					callback();
				});

				$item.querySelector(".delete-action").addEventListener("click", async e => {
					this.ws.audio.playSound([ "ui", "click" ]);
					if (e.shiftKey || await this.ws.gui.dialog.confirm(
						"Delete Action",
						"Are you sure you want to delete this action?<br><small>Tip: Hold <code>&lt;Shift&gt;</code> while clicking to skip this confirmation.</small>",
						null,
						true
					)) {
						const parent = findParentAction(action, script);
						parent.actions.splice(parent.actions.indexOf(action), 1);
						callback();
					}
				});
			};

			const duplicates = () => {
				const keys = new Set();
				const overflow = new Set();
				this.ws.store.control_scripts.forEach(script => {
					script.keys.forEach(key => {
						if (keys.has(key))
							overflow.add(key);
						else
							keys.add(key);
					});
				});

				document.querySelectorAll(".control-keys div[data-key]").forEach($key => {
					$key.classList.toggle("duplicate", overflow.has($key.dataset.key));
				});
			};

			const buildScriptInterface = ($script, script) => {
				$script.innerHTML = `
					<div class="control-container">
						<div class="control-container-title">When these keys are pressed</div>
						<div class="control-keys"></div>
						<div class="control-container-title margin-top">Complete these actions</div>
						<div class="control-actions"></div>
					</div>
				`;

				const $keys = $script.querySelector(".control-keys");
				for (const key of script.keys) {
					const $key = document.createElement("div");
					$key.dataset.key = key;
					$key.innerHTML = `
						<span class="key-elem-title">${key === " " ? "space" : key}</span>
						<span class="fas fa-trash-can remove"></span>
					`;
					$keys.appendChild($key);

					$key.querySelector(".remove").addEventListener("click", () => {
						this.ws.audio.playSound([ "ui", "click" ]);
						script.keys.splice(script.keys.indexOf(key), 1);
						buildScriptInterface($script, script);
						duplicates();
					});
				}

				const $addKey = document.createElement("div");
				$addKey.className = "add";
				$addKey.innerHTML = `<span class="fas fa-plus"></span>`;
				$keys.appendChild($addKey);

				$addKey.addEventListener("click", () => {
					this.ws.audio.playSound([ "ui", "click" ]);
					document.querySelectorAll(".key-select").forEach($el => $el.remove());

					const $keySelect = document.createElement("div");
					$keySelect.className = "key-select animate-loading-dots";
					$keySelect.textContent = "Press a key";
					$keys.insertBefore($keySelect, $addKey);

					const remove = () => {
						$keySelect.remove();
						this.#keypressListener = null;
					};

					$keySelect.addEventListener("click", () => {
						this.ws.audio.playSound([ "ui", "click" ]);
						remove();
					});
					this.#keypressListener = (key, final, event) => {
						if (key === "escape")
							remove();
						else if (final) {
							if (!validateShortcut(key)) {
								remove();
								this.ws.gui.dialog.toast("Invalid Key", "The key you pressed is not a valid shortcut key.", "error");
								return;
							}

							if (!script.keys.includes(key))
								script.keys.push(key);

							remove();
							buildScriptInterface($script, script);
							duplicates();
						} else
							$keySelect.textContent = key || "Press a key";
					};
				});

				const $actions = $script.querySelector(".control-actions");
				for (const action of script.actions)
					createActionItem($actions, action, script, () => { this.controls(); });

				const $bottom = document.createElement("div");
				$bottom.className = "control-bottom-container";
				$bottom.innerHTML = `
					<div class="add-action-button"></div>
					<div>
						<button class="add-action-button control-delete" style="--background: 211, 51, 51;">Delete</button>
					</div>
				`;
				$actions.appendChild($bottom);

				$bottom.querySelector(".control-delete").addEventListener("click", async e => {
					this.ws.audio.playSound([ "ui", "click" ]);
					if (e.shiftKey || await this.ws.gui.dialog.confirm(
						"Delete Control Script",
						"Are you sure you want to delete this control script? This action cannot be undone?<br><small>Tip: Hold <code>&lt;Shift&gt;</code> while clicking to skip this confirmation.</small>",
						null,
						true
					)) {
						this.ws.store.control_scripts.splice(this.ws.store.control_scripts.indexOf(script), 1);
						this.controls();
					}
				});

				const resetAddAction = () => {
					const $addAction = $bottom.querySelector(".add-action-button");
					$addAction.innerHTML = `<button class="add-action-button new-button"><span class="fa fa-plus"></span> Add Action</button>`;

					$addAction.querySelector(".new-button").addEventListener("click", () => {
						this.ws.audio.playSound([ "ui", "click" ]);
						$addAction.innerHTML = `
							<select style="height: 35px;"></select>
							<button class="add-action-button cancel-button" style="margin-left: 10px;">Cancel</button>
							<button class="add-action-button create-button" style="margin-left: 10px;">Create</button>
						`;

						const $select = $addAction.querySelector("select");
						$select.innerHTML += `<option value="if">If Condition</option>`;
						$select.innerHTML += `<option value="if not">If Not Condition</option>`;
						Object.entries(events).forEach(([ key, event ]) => {
							if ("title" in event)
								$select.innerHTML += `<option value="${key}">${event.title}</option>`;
							else
								$select.innerHTML += `<option value="${key}">${key}</option>`;
						});

						$addAction.querySelector(".cancel-button").addEventListener("click", () => {
							this.ws.audio.playSound([ "ui", "click" ]);
							resetAddAction();
						});
						$addAction.querySelector(".create-button").addEventListener("click", () => {
							this.ws.audio.playSound([ "ui", "click" ]);
							if ($select.value === "if" || $select.value === "if not" || $select.value in events) {
								const action = { name: $select.value, params: { } };
								if ($select.value === "if" || $select.value === "if not") {
									action.condition = { name: Object.keys(conditions)[0] };
									action.actions = [];
								}

								script.actions.push(action);
								buildScriptInterface($script, script);
							}
						});
					});
				};
				resetAddAction();
			};

			const $content = document.querySelector("#settings-container > .settings > .settings-right > .controls");
			$content.querySelectorAll(".control-script-item").forEach(script => script.remove());
			for (const script of this.ws.store.control_scripts) {
				const $script = document.createElement("div");
				$script.className = "settings-section control-script-item";
				$content.appendChild($script);

				buildScriptInterface($script, script);
			}

			duplicates();
		}
	}
	zen() {
		this.deselect();

		document.querySelector("#settings-zen-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .zen").classList.remove("hidden");
	}

	app() {
		this.deselect();

		document.querySelector("#settings-app-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .app").classList.remove("hidden");
	}
	queue() {
		this.deselect();

		document.querySelector("#settings-queue-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .queue").classList.remove("hidden");
	}
	accessibility() {
		this.deselect();

		document.querySelector("#settings-accessibility-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .accessibility").classList.remove("hidden");
	}

	AI() {
		this.deselect();

		document.querySelector("#settings-AI-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .AI").classList.remove("hidden");
	}
	autoReporting() {
		this.deselect();

		document.querySelector("#settings-auto-reporting-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .auto-reporting").classList.remove("hidden");
	}
	gadgets() {
		this.deselect();

		document.querySelector("#settings-gadgets-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .gadgets").classList.remove("hidden");
	}

	whitelist(type) {
		this.deselect();

		document.querySelector(`#settings-whitelist-${type}s-button`).classList.add("selected");
		document.querySelector(`#settings-container > .settings > .settings-right > .whitelist.${type}s`).classList.remove("hidden");

		{
			const $whitelist = document.querySelector(`#settings-whitelist-${type}s-expiry`);
			$whitelist.value = this.ws.store.settings.expiry.whitelist[`${type}s`];
			$whitelist.addEventListener("change", e => this.ws.store.settings.expiry.whitelist[`${type}s`] = e.target.value);

			const $input = document.querySelector(`#settings-whitelist-${type}s-input`);
			const add = () => {
				const value = $input.value.trim();
				if (value) {
					$input.value = "";
					this.ws.store.whitelist[`${type}s`].set(value, [ Date.now(), this.ws.util.expiryToDate(this.ws.store.settings.expiry.whitelist[`${type}s`]).valueOf() ]);
					this.ws.store.statistics.items_whitelisted.total++;
            		this.ws.store.statistics.items_whitelisted[`${type}s`]++;
					this.ws.gui.renderQueue();

					this.whitelist(type);
				}
			};
			if (type === "tag")
				if (this.wikipediaTags) {
					const tags = this.wikipediaTags.map(tag => tag.name).sort();
					for (const tag of tags) {
						const $option = document.createElement("option");
						$option.value = tag;
						$option.textContent = tag;
						$input.appendChild($option);
					}
					$input.setAttribute("list", $input.id + "-datalist");
					const $datalist = document.createElement("datalist");
					$datalist.id = $input.id + "-datalist";
					$input.parentElement.appendChild($datalist);
					for (const tag of tags) {
						const $option = document.createElement("option");
						$option.value = tag;
						$datalist.appendChild($option);
					}
				}

			document.querySelector(`#settings-whitelist-${type}s-add-button`).addEventListener("click", add);
			$input.addEventListener("keydown", e => {
				if (e.key === "Enter") {
					add();
					e.preventDefault();
				}
			});
		}

		{
			const $container = document.querySelector(`#settings-whitelist-${type}s-list`);
			$container.innerHTML = "";

			const link = value => {
				switch (type) {
					case "user": return this.ws.page(`Special:Contributions/${value}`);
					case "page": return this.ws.page(value);
					case "tag": return this.ws.page(`Special:Tags/${value}`);
				}
			};

			const sorted = [ ...this.ws.store.whitelist[`${type}s`] ].sort((a, b) => b[1][1] - a[1][1]);
			for (const [ value, time ] of sorted) {
				const $item = document.createElement("div");

				const date = new Date(time[0]);
				const expires = time[1] === Infinity ? "Never" : `${new Date(time[1]).toLocaleDateString()} ${new Date(time[1]).toLocaleTimeString()}`;

				$item.innerHTML = `
					<div>
						<a href="${link(value)}">${value}</a>
						<span>Added: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
						<span class="${Date.now() > time[1] ? "expired" : ""}">
							${Date.now() > time[1] ? "Expired" : "Expires"}: ${expires}
						</span>
					</div>
					<button class="add-action-button remove-button" title="Remove from whitelisted list"><span class="fa fa-trash"></span></button>
				`;
				$item.querySelector(".remove-button").addEventListener("click", () => {
					this.ws.store.whitelist[`${type}s`].delete(value);
					this.ws.gui.renderQueue();

					this.whitelist(type);
				});

				$container.appendChild($item);
			}

			if (sorted.length === 0)
				$container.innerHTML = `<div class="empty">No whitelisted ${type}s.</div>`;
		}
	}
	highlight(type) {
		this.deselect();

		document.querySelector(`#settings-highlight-${type}s-button`).classList.add("selected");
		document.querySelector(`#settings-container > .settings > .settings-right > .highlight.${type}s`).classList.remove("hidden");

		{
			const $whitelist = document.querySelector(`#settings-highlight-${type}s-expiry`);
			$whitelist.value = this.ws.store.settings.expiry.highlight[`${type}s`];
			$whitelist.addEventListener("change", e => this.ws.store.settings.expiry.highlight[`${type}s`] = e.target.value);

			const $input = document.querySelector(`#settings-highlight-${type}s-input`);
			const add = () => {
				const value = $input.value.trim();
				if (value) {
					$input.value = "";
					this.ws.store.highlight[`${type}s`].set(value, [ Date.now(), this.ws.util.expiryToDate(this.ws.store.settings.expiry.highlight[`${type}s`]).valueOf() ]);
					this.ws.store.statistics.items_highlighted.total++;
            		this.ws.store.statistics.items_highlighted[`${type}s`]++;
					this.ws.gui.renderQueue();

					this.highlight(type);
				}
			};
			if (type === "tag")
				if (this.wikipediaTags) {
					const tags = this.wikipediaTags.map(tag => tag.name).sort();
					for (const tag of tags) {
						const $option = document.createElement("option");
						$option.value = tag;
						$option.textContent = tag;
						$input.appendChild($option);
					}
					$input.setAttribute("list", $input.id + "-datalist");
					const $datalist = document.createElement("datalist");
					$datalist.id = $input.id + "-datalist";
					$input.parentElement.appendChild($datalist);
					for (const tag of tags) {
						const $option = document.createElement("option");
						$option.value = tag;
						$datalist.appendChild($option);
					}
				}

			document.querySelector(`#settings-highlight-${type}s-add-button`).addEventListener("click", add);
			$input.addEventListener("keydown", e => {
				if (e.key === "Enter") {
					add();
					e.preventDefault();
				}
			});
		}

		{
			const $container = document.querySelector(`#settings-highlight-${type}s-list`);
			$container.innerHTML = "";

			const link = value => {
				switch (type) {
					case "user": return this.ws.page(`Special:Contributions/${value}`);
					case "page": return this.ws.page(value);
					case "tag": return this.ws.page(`Special:Tags/${value}`);
				}
			};

			const sorted = [ ...this.ws.store.highlight[`${type}s`] ].sort((a, b) => b[1][1] - a[1][1]);

			for (const [ value, time ] of sorted) {
				const $item = document.createElement("div");

				const date = new Date(time[0]);
				const expires = time[1] === Infinity ? "Never" : `${new Date(time[1]).toLocaleDateString()} ${new Date(time[1]).toLocaleTimeString()}`;

				$item.innerHTML = `
					<div>
						<a href="${link(value)}">${value}</a>
						<span>Added: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
						<span class="${Date.now() > time[1] ? "expired" : ""}">
							${Date.now() > time[1] ? "Expired" : "Expires"}: ${expires}
						</span>
					</div>
					<button class="add-action-button remove-button" title="Remove from highlighted list"><span class="fa fa-trash"></span></button>
				`;
				$item.querySelector(".remove-button").addEventListener("click", () => {
					this.ws.store.highlight[`${type}s`].delete(value);
					this.ws.gui.renderQueue();

					this.highlight(type);
				});

				$container.appendChild($item);
			}

			if (sorted.length === 0)
				$container.innerHTML = `<div class="empty">No highlighted ${type}s.</div>`;
		}
	}

	statistics() {
		this.deselect();

		document.querySelector("#settings-statistics-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .statistics").classList.remove("hidden");

		{
			const $reset = document.querySelector("#reset-statistics-button");
			$reset.addEventListener("click", async () => {
				if (await this.ws.gui.dialog.confirm("Reset statistics", "Are you sure you want to reset all statistics? This action cannot be undone.", undefined, true)) {
					this.ws.store.statistics = { };
					this.ws.storage.load(this.ws.store);
					this.ws.time.load = performance.now();

					this.statistics();
				}
			});
		}

		const stats = this.ws.store.statistics;
		{
			const $edits = document.querySelector("#stats-total-reviewed");
			$edits.textContent = (stats.edits_reviewed.total || 0).toLocaleString();

			const $thanks = document.querySelector("#stats-thanks-percentage");
			$thanks.textContent = (stats.edits_reviewed.thanked / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $recent = document.querySelector("#stats-recent-changes-reviewed");
			$recent.textContent = (stats.recent_changes_reviewed.total || 0).toLocaleString();

			const $percentage = document.querySelector("#stats-recent-changes-percentage");
			$percentage.textContent = (stats.recent_changes_reviewed.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $pending = document.querySelector("#stats-pending-changes-reviewed");
			$pending.textContent = (stats.pending_changes_reviewed.total || 0).toLocaleString();

			const $accepted = document.querySelector("#stats-pending-changes-accepted");
			$accepted.textContent = (stats.pending_changes_reviewed.accepted || 0).toLocaleString();
			const $acceptedPercentage = document.querySelector("#stats-pending-changes-accepted-percentage");
			$acceptedPercentage.textContent = (stats.pending_changes_reviewed.accepted / stats.pending_changes_reviewed.total * 100 || 0).toFixed(2);

			const $rejected = document.querySelector("#stats-pending-changes-rejected");
			$rejected.textContent = (stats.pending_changes_reviewed.rejected || 0).toLocaleString();
			const $rejectedPercentage = document.querySelector("#stats-pending-changes-rejected-percentage");
			$rejectedPercentage.textContent = (stats.pending_changes_reviewed.rejected / stats.pending_changes_reviewed.total * 100 || 0).toFixed(2);

			const $percentage = document.querySelector("#stats-pending-changes-percentage");
			$percentage.textContent = (stats.pending_changes_reviewed.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $users = document.querySelector("#stats-user-creations-reviewed");
			$users.textContent = (stats.users_reviewed.total || 0).toLocaleString();

			const $percentage = document.querySelector("#stats-user-creations-percentage");
			$percentage.textContent = (stats.users_reviewed.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $watchlist = document.querySelector("#stats-watchlist-changes-reviewed");
			$watchlist.textContent = (stats.watchlist_changes_reviewed.total || 0).toLocaleString();

			const $percentage = document.querySelector("#stats-watchlist-changes-percentage");
			$percentage.textContent = (stats.watchlist_changes_reviewed.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $abuselog = document.querySelector("#stats-abuselog-changes-reviewed");
			$abuselog.textContent = (stats.abuselogs_reviewed.total || 0).toLocaleString();

			const $percentage = document.querySelector("#stats-abuselog-changes-percentage");
			$percentage.textContent = (stats.abuselogs_reviewed.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);
		}

		{
			const $reverts = document.querySelector("#stats-reverts-made");
			$reverts.textContent = (stats.reverts_made.total || 0).toLocaleString();

			const $percentage = document.querySelector("#stats-reverts-percentage");
			$percentage.textContent = (stats.reverts_made.total / stats.edits_reviewed.total * 100 || 0).toFixed(2);

			const $goodfaith = document.querySelector("#stats-goodfaith-reverts-percentage");
			$goodfaith.textContent = (stats.reverts_made.good_faith / stats.reverts_made.total * 100 || 0).toFixed(2);

			const $recent = document.querySelector("#stats-recent-reverts-percentage");
			$recent.textContent = (stats.reverts_made.from_recent_changes / stats.reverts_made.total * 100 || 0).toFixed(2);

			const $pending = document.querySelector("#stats-pending-reverts-percentage");
			$pending.textContent = (stats.reverts_made.from_pending_changes / stats.reverts_made.total * 100 || 0).toFixed(2);

			const $watchlist = document.querySelector("#stats-watchlist-reverts-percentage");
			$watchlist.textContent = (stats.reverts_made.from_watchlist / stats.reverts_made.total * 100 || 0).toFixed(2);

			const $abuselog = document.querySelector("#stats-abuselog-reverts-percentage");
			$abuselog.textContent = (stats.reverts_made.from_abuselogs / stats.reverts_made.total * 100 || 0).toFixed(2);

			const $other = document.querySelector("#stats-other-reverts-percentage");
			$other.textContent = (stats.reverts_made.from_loaded_edits / stats.reverts_made.total * 100 || 0).toFixed(2);
		}

		{
			const $welcomed = document.querySelector("#stats-users-welcomed");
			$welcomed.textContent = (stats.users_welcomed.total || 0).toLocaleString();

			const $message = document.querySelector("#stats-users-welcomed-message");
			if (stats.edits_reviewed.total === stats.users_welcomed.total)
				$message.textContent = `You welcome every user whose edit you review! (${stats.users_welcomed.total.toLocaleString()})`;
			else {
				if (stats.users_welcomed.total === 0)
					$message.innerHTML = `For every Infinity edits you review, you still won&rsquo;t welcome a new user.`;
				else
					$message.textContent = `For every ${(stats.edits_reviewed.total / stats.users_welcomed.total || 0).toFixed(3)} edits you review, you welcome a new user.`;
			}
		}

		{
			const $warnings = document.querySelector("#stats-warnings");
			$warnings.textContent = (stats.warnings_issued.total || 0).toLocaleString();

			const $level1 = document.querySelector("#stats-warning-1-percentage");
			$level1.textContent = (stats.warnings_issued.level_1 / stats.warnings_issued.total * 100 || 0).toFixed(2);

			const $level2 = document.querySelector("#stats-warning-2-percentage");
			$level2.textContent = (stats.warnings_issued.level_2 / stats.warnings_issued.total * 100 || 0).toFixed(2);

			const $level3 = document.querySelector("#stats-warning-3-percentage");
			$level3.textContent = (stats.warnings_issued.level_3 / stats.warnings_issued.total * 100 || 0).toFixed(2);

			const $level4 = document.querySelector("#stats-warning-4-percentage");
			$level4.textContent = (stats.warnings_issued.level_4 / stats.warnings_issued.total * 100 || 0).toFixed(2);

			const $level4im = document.querySelector("#stats-warning-4im-percentage");
			$level4im.textContent = (stats.warnings_issued.level_4im / stats.warnings_issued.total * 100 || 0).toFixed(2);
		}

		{
			const $reports = document.querySelector("#stats-reports");
			$reports.textContent = (stats.reports_filed.total || 0).toLocaleString();

			const $AIV = document.querySelector("#stats-AIV-reports-percentage");
			$AIV.textContent = (stats.reports_filed.AIV / stats.reports_filed.total * 100 || 0).toFixed(2);

			const $UAA = document.querySelector("#stats-UAA-reports-percentage");
			$UAA.textContent = (stats.reports_filed.UAA / stats.reports_filed.total * 100 || 0).toFixed(2);

			const $block = document.querySelector("#stats-global-block-reports-percentage");
			$block.textContent = (stats.reports_filed.global_block / stats.reports_filed.total * 100 || 0).toFixed(2);

			const $lock = document.querySelector("#stats-global-lock-reports-percentage");
			$lock.textContent = (stats.reports_filed.global_lock / stats.reports_filed.total * 100 || 0).toFixed(2);

			const $RFPP = document.querySelector("#stats-RFPP-reports-percentage");
			$RFPP.textContent = (stats.reports_filed.RFPP / stats.reports_filed.total * 100 || 0).toFixed(2);
		}

		{
			const $watched = document.querySelector("#stats-pages-watched");
			$watched.textContent = (stats.watchlist.watched || 0).toLocaleString();

			const $unwatched = document.querySelector("#stats-pages-unwatched");
			$unwatched.textContent = (stats.watchlist.unwatched || 0).toLocaleString();
		}

		{
			const $whitelisted = document.querySelector("#stats-items-whitelisted");
			$whitelisted.textContent = (stats.items_whitelisted.total || 0).toLocaleString();

			const $users = document.querySelector("#stats-users-whitelisted");
			$users.textContent = (stats.items_whitelisted.users || 0).toLocaleString();
			const $usersPercentage = document.querySelector("#stats-users-whitelisted-percentage");
			$usersPercentage.textContent = (stats.items_whitelisted.users / stats.items_whitelisted.total * 100 || 0).toFixed(2);

			const $pages = document.querySelector("#stats-pages-whitelisted");
			$pages.textContent = (stats.items_whitelisted.pages || 0).toLocaleString();
			const $pagesPercentage = document.querySelector("#stats-pages-whitelisted-percentage");
			$pagesPercentage.textContent = (stats.items_whitelisted.pages / stats.items_whitelisted.total * 100 || 0).toFixed(2);

			const $tags = document.querySelector("#stats-tags-whitelisted");
			$tags.textContent = (stats.items_whitelisted.tags || 0).toLocaleString();
			const $tagsPercentage = document.querySelector("#stats-tags-whitelisted-percentage");
			$tagsPercentage.textContent = (stats.items_whitelisted.tags / stats.items_whitelisted.total * 100 || 0).toFixed(2);
		}

		{
			const $highlighted = document.querySelector("#stats-items-highlighted");
			$highlighted.textContent = (stats.items_highlighted.total || 0).toLocaleString();

			const $users = document.querySelector("#stats-users-highlighted");
			$users.textContent = (stats.items_highlighted.users || 0).toLocaleString();
			const $usersPercentage = document.querySelector("#stats-users-highlighted-percentage");
			$usersPercentage.textContent = (stats.items_highlighted.users / stats.items_highlighted.total * 100 || 0).toFixed(2);

			const $pages = document.querySelector("#stats-pages-highlighted");
			$pages.textContent = (stats.items_highlighted.pages || 0).toLocaleString();
			const $pagesPercentage = document.querySelector("#stats-pages-highlighted-percentage");
			$pagesPercentage.textContent = (stats.items_highlighted.pages / stats.items_highlighted.total * 100 || 0).toFixed(2);

			const $tags = document.querySelector("#stats-tags-highlighted");
			$tags.textContent = (stats.items_highlighted.tags || 0).toLocaleString();
			const $tagsPercentage = document.querySelector("#stats-tags-highlighted-percentage");
			$tagsPercentage.textContent = (stats.items_highlighted.tags / stats.items_highlighted.total * 100 || 0).toFixed(2);
		}

		{
			const time = stats.session_time + (performance.now() - this.ws.time.load);
			const $time = document.querySelector("#stats-session-time");
			$time.textContent = formatTime(time);

			const $reports = document.querySelector("#stats-reports-per-day");
			$reports.textContent = (stats.reports_filed.total / (time / 8.64e+7 || 1) || 0).toFixed(2);

			const $reverts = document.querySelector("#stats-reverts-per-hour");
			$reverts.textContent = (stats.reverts_made.total / (time / 3.6e+6 || 1) || 0).toFixed(2);

			const $reviews = document.querySelector("#stats-reviews-per-minute");
			$reviews.textContent = (stats.edits_reviewed.total / (time / 6e+4 || 1) || 0).toFixed(2);
		}
	}

	save() {
		this.deselect();

		document.querySelector("#settings-save-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .save").classList.remove("hidden");

		document.querySelector("#settings-save-status").classList.add("hidden");
	}

	changelog() {
		this.deselect();

		document.querySelector("#settings-changelog-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .changelog").classList.remove("hidden");

		const $changelog = document.querySelector("#settings-container > .settings > .settings-right > .changelog > div > .changelog-content");
		$changelog.innerHTML = "<em class='animate-loading-dots'>Loading changelog</em>";
		WikiShield.config.changelog.HTML.then(html => $changelog.innerHTML = html);
	}

	about() {
		this.deselect();

		document.querySelector("#settings-about-button").classList.add("selected");
		document.querySelector("#settings-container > .settings > .settings-right > .about").classList.remove("hidden");

		document.querySelector("#settings-about-version").textContent = WikiShield.config.version;

		document.querySelectorAll("#settings-container > .settings > .settings-right > .about > .randomize").forEach($el => {
			for (let i = $el.children.length; i >= 0; i--)
				$el.appendChild($el.children[Math.random() * i | 0]);
		});
	}
}