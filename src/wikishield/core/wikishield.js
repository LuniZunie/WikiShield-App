import { Utility } from "../utils/helpers.js";
import { AudioManager } from "../audio/manager.js";

import { API } from "../wikipedia/api.js";
import { Notifications } from "../ui/notifications.js";
import { ProgressBar } from "../ui/progress-bar.js";

import { Queue } from "./queue.js";
import { GUI } from "../ui/gui.js";

import { AI } from "../ai/class.js";
import { StorageManager } from "../data/storage.js";
import { buildShortcut } from "../config/control-keys.js";

export class WikiShield {
	static config = {
		version: "2.0.0",

		changelog: {
			version: "6",
			get HTML() {
				return ""; // TODO
			}
		},

		pages: {
			AIV: "Wikipedia:Administrator intervention against vandalism",
			UAA: "Wikipedia:Usernames for administrator attention",
			RFPP: "Wikipedia:Requests for page protection/Increase"
		},

		config: {
			refresh: {
				recent: 2000,
				pending: 2000,
				watchlist: 2000,
				users: 2000,
			},
			historyCount: 10,
		},
	};

	#events = {
		"ready": [ ],
	};

	constructor(server = "en.wikipedia.org") {
		this.server = server;

		this.storage = new StorageManager();

		this.defaultStorage = new StorageManager();
		this.defaultStorage.load();

		this.util = new Utility(this);

		this.api = new API(this, server);
		this.notifications = new Notifications(this);

		this.rights = { };

		this.api.login().then(() => {
			this.api.account().then(async info => {
				this.rights = info.rights.reduce((acc, right) => ({ ...acc, [right]: true }), { });

				this.queue = new Queue(this);
				this.gui = new GUI(this);

				await this.#import();

				this.cleanup();
				window.setInterval(() => this.cleanup(), 10 * 1000);

				this.#emit("ready");
			});
		});

		this.audio = new AudioManager(this);

		this.time = {
			load: null,
			save: null,
		};
	}

	get store() {
		return this.storage.data;
	}

	on(event, callback, options = { }) {
        if (this.#events[event])
            this.#events[event].push({ callback, options });

        return this;
    }

    #emit(event) {
        if (this.#events[event])
            for (const listener of this.#events[event])
                try {
                    listener.callback();
                } catch { } finally {
                    if (listener.options?.once === true) {
                        this.#events[event] = this.#events[event].filter(l => l !== listener);
                    }
                }

        return this;
    }

	async #import(override = null) {
		const logs = this.storage.decode(override ?? await this.load()).logs;
		this.time.load = performance.now();

		if (this.store.settings.AI.enabled) {
			switch (this.store.settings.AI.provider) {
				case "Ollama": {
					if (typeof AI.providers?.Ollama === "function")
						this.AI = new AI.providers.Ollama(
							this,
							this.store.settings.AI.Ollama
						);
					else {
						console.error("AI.providers.Ollama is not available. Falling back to null.");
						this.AI = null;
					}
				} break;
				default: {
					this.AI?.cancel.all();
					this.AI = null;
				} break;
			}
		} else {
			this.AI?.cancel.all();
			this.AI = null;
		}

		return logs;
	}

	async init(override = null) {
		const logs = await this.#import(override);
		this.gui.build();

		return logs;
	}
	async noinit(override = null) {
		const logs = await this.#import(override);

		this.AI?.cancel.all();
		if (this.store.settings.AI.enabled)
			switch (this.store.settings.AI.provider) {
				case "Ollama": {
					this.AI = new AI.providers.Ollama(this, this.store.settings.AI.Ollama);
				} break;
				default: {
					this.AI = null;
				} break;
			}
		else
			this.AI = null;

		{ // queue
			const width = this.store.UI.queue.width;
			document.body.querySelector("#queue").style.width = width;
			document.body.querySelector("#right-container").style.width = `calc(100% - ${width})`;
		}

		{ // details
			const width = this.store.UI.details.width;
			document.body.querySelector("#right-details").style.width = width;
			document.body.querySelector("#right-top").style.width = width;
			document.body.querySelector("#main-container").style.width = `calc(100% - ${width})`;
			document.body.querySelector("#middle-top").style.width = `calc(100% - ${width})`;
		}

		this.gui.settings.update();

		return logs;
	}

	start() {
		this.gui.start();

		Queue.types.forEach(type => this.queue.fetch(type));

		this.update();
	}

	async update() {
		const start = performance.now();
		const target = 1000;

		try {
			await this.api.account().then(info => {
				this.rights = info.rights.reduce((acc, right) => ({ ...acc, [right]: true }), { });
			});

			if (!this.rights.rollback)
				this.disable("Rollback required", "Your account no longer has rollback rights, which are required to use WikiShield.");

			{ // pending changes
				const allowed = this.rights.review && this.api.hasPendingChanges;
				document.querySelector("#queue-tab-pending").classList.toggle("hidden", !allowed);
				if (!allowed && this.queue.current.type === "pending")
					this.queue.switch("recent");
			}
		} catch (error) {
			console.error("Update error:", error);
		}

		window.setTimeout(() => this.update(), Math.max(0, target - (performance.now() - start))); // Aim for 1 second intervals, but don't pile up calls
	}

	cleanup() {
		const now = Date.now();

		let changed = false;
		for (const [ , value ] of Object.entries(this.store.highlight))
			for (const [ name, time ] of value.entries())
				if (now >= time[1]) {
					value.delete(name);
					changed = true;
				}

		for (const [ , value ] of Object.entries(this.store.whitelist))
			for (const [ name, time ] of value.entries())
				if (now >= time[1]) {
					value.delete(name);
					changed = true;
				}

		if (changed)
			if (this.queue.current.item && this.gui)
				this.gui.renderQueue(this.queue.current.queue, this.queue.current.item);
	}

	controller(event) {
		if (this.gui.dialog.dialogs.active)
			return this.gui.dialog.controller(event);
		else if (this.gui.settings.active)
			return this.gui.settings.controller(event);

		if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA" || document.activeElement?.isContentEditable)
			return;

		// keydown bc we want speedy response
		if (event.type === "keydown") {
			const shortcut = buildShortcut(event);
			for (const script of this.store.control_scripts)
				if (script.keys.some(key => key === shortcut)) {
					event.preventDefault();
					this.execute(script);
				}
		}
	}

	async execute(script, continuity = true, updateProgress = null, item = null) {
		const base = updateProgress === null;

		if (base) {
			item ??= this.queue.current.item || 1;

			const allScripts = [ script ];
			let totalActions = 0;

			while (allScripts.length > 0) {
				const current = allScripts[0];

				const willBeRun = (current.name && current.name === "if" && this.gui.events.conditions[current.condition].check(this, item)) || !current.name;

				if (willBeRun) {
					if (!current.actions) {
						allScripts.splice(0, 1);
						continue;
					}

					allScripts.push(...current.actions);
				}

				if (current.name && current.name !== "if"
					&& this.gui.events.events[current.name].progress)
					totalActions++;

				allScripts.splice(0, 1);
			}

			if (totalActions > 0) {
				let actionsCompleted = 0;
				const progressBar = new ProgressBar();

				updateProgress = (text, color = "rgba(96, 165, 250, .8)") => {
					const portion = text === "Done" ? 1 : actionsCompleted / totalActions;
					progressBar.set(text, portion, color);
					actionsCompleted++;
				};
			} else
				updateProgress = (_) => { };
		}

		const ifAndTrue = script.name && script.name === "if" && this.gui.events.conditions[script.condition].check(this, item);
		if (ifAndTrue || !script.name) {
			for (const action of script.actions) {
				if (!("name" in action))
					continue;

				for (const param of this.gui.events.events[action.name]?.parameters?.(this, item) || [])
					if (param.id && !(param.id in action.params) && "default" in param)
						action.params[param.id] = param.default;

				if (action.name === "if")
					continuity = await this.execute(action, continuity, updateProgress, item);
				else {
					const event = this.gui.events.events[action.name];

					const fail = () => {
						continuity = false;
						this.audio.playSound([ "action", "failed" ]);
						if (event.progress)
							updateProgress(event.progress, "rgba(239, 68, 68, .8)");
					};
					try {
						if (continuity || !event.continuity) {
							const validity = event.valid?.(this, item, action.params) ?? { valid: true };
							if (validity.valid) {
								if (event.progress) {
									updateProgress(event.progress);
									this.audio.playSound([ "action", "default" ]);
								}

								this.store.statistics.actions_executed.total++;
								const result = await event.script(this, item, action.params);
								if (result.valid === false) {
									fail();
									if ("reason" in result)
										this.gui.dialog.toast("Action failed", result.reason, "error");
								} else {
									this.store.statistics.actions_executed.successful++;
									event.successful?.(this, item, action.params);
								}
							} else {
								fail();
								if ("reason" in validity)
									this.gui.dialog.toast("Action skipped", validity.reason, "error");
							}
						}
					} catch (error) {
						fail();
						console.error(`Error executing action "${action.name}":`, error);
						this.gui.dialog.toast("Please report to developer", `An error occurred while executing action "${action.name}". Check the console for details.`, "error");
					}
				}
			}
		}

		if (!script.name)
			updateProgress("Done");

		return continuity;
	}

	export() {
		this.time.save = performance.now();
		this.store.statistics.session_time += this.time.save - this.time.load;

		const { string, logs } = this.storage.encode();
		StorageManager.output(logs);

		return string;
	}

	async save() {
		const data = this.export();
		window.electronAPI.saveAccount(this.api.bot, data);
	}

	async load() {
		try {
			const response = await this.api.post({
				action: "query",
				meta: "userinfo",
				uiprop: "options",
				format: "json"
			});

			return response.query.userinfo.options[`userjs-wikishield-storage`] ?? "e30=";
		} catch (error) {
			console.error("Failed to load storage from wiki:", error);
			return "e30=";
		}
	}

	page(title, php, encode = true) {
		return `https://${this.server}/${php ? `w/index.php${title}` : `wiki/${encode ? encodeURIComponent(title) : title}`}`;
	}

	open(href, external) {
		external ??= !this.store.settings.wikipedia_popups.enabled;
		if (external)
			window.electronAPI.openExternal(href);
		else {
			const width = window.screen.availWidth * 0.8;
			const height = window.screen.availHeight * 0.8;
			const left = window.screenX + (window.outerWidth - width) / 2;
			const top = window.screenY + (window.outerHeight - height) / 2;

			const popup = window.open(
				href,
				"_blank",
				`width=${width},height=${height},top=${top},left=${left},resizable=false,scrollbars=true,toolbar=false,status=false`
			);
			popup.focus();

			requestAnimationFrame(() => {
				this.gui.dialog.popups.push(popup);
				if (!document.getElementById("popup-blocker")) {
					const $popupBlock = document.createElement("div");
					$popupBlock.id = "popup-blocker";
					$popupBlock.innerText = "Please close the popup or click anywhere on this page to continue using WikiShield.";
					document.querySelector("#app").appendChild($popupBlock);

					this.gui.dialog.check();
				}
			});

			return popup;
		}
	}
}