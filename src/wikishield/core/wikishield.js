import { VERSION } from "../data/version.js";

import { Utility } from "../utilities/helpers.js";
import { AudioManager } from "../audio/manager.js";

import { API } from "../wikipedia/api.js";
import { Notifications } from "../ui/notifications.js";
import { ProgressBar } from "../ui/progress-bar.js";

import { Queue } from "./queue.js";
import { GUI } from "../ui/gui.js";

import { AI } from "../ai/class.js";
import { StorageManager } from "../data/storage/manager.js";
import { buildShortcut } from "../config/control-keys.js";

export class WikiShield {
	static config = {
		version: VERSION,

		changelog: {
			version: "6",
			HTML: fetch("https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/data/CHANGELOG.html")
				.then(res => res.text())
				.catch(() => "<em>Could not fetch changelog.</em>")
		},

		pages: {
			AIV: "Wikipedia:Administrator intervention against vandalism",
			UAA: "Wikipedia:Usernames for administrator attention",
			RFPP: "Wikipedia:Requests for page protection/Increase",
			SRG: "Steward requests/Global"
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

	constructor(mobile, server, username, pendingChangesServers, dev) {
		this.mobile = mobile;

		this.__DEV__ = dev;

		this.started = false;

		this.server = server;

		this.storage = new StorageManager();

		this.defaultStorage = new StorageManager();
		this.defaultStorage.load();

		this.util = new Utility(this);

		this.api = new API(this, server, username, pendingChangesServers);
		this.notifications = new Notifications(this);

		this.rights = { };
		this.groups = { };

		this.api.account().then(async info => {
			this.rights = info.rights.reduce((acc, right) => ({ ...acc, [right]: true }), { });
			this.groups = info.groups.reduce((acc, group) => ({ ...acc, [group]: true }), { });

			{ // pending changes
				const allowed = this.rights.review && this.api.hasPendingChanges;
				document.querySelector("#queue-tab-pending").classList.toggle("hidden", !allowed);
				if (!allowed && this.queue.current.type === "pending")
					this.queue.switch("recent");
			}

			await this.#import();

			this.cleanup();
			setInterval(() => this.cleanup(), 10 * 1000);

			this.#emit("ready");
		});

		this.gui = new GUI(this);
		this.queue = new Queue(this);
		this.audio = new AudioManager(this);

		this.time = {
			load: null,
			save: null,
		};
	}

	get store() {
		return this.storage.data;
	}

	disable(title, message) {
		electron.disable(title, message);
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
		this.gui.build();

		await this.audio.init();

		return await this.#import(override);
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
			// document.body.querySelector("#middle-top").style.right = `calc(${width} + 1vmin)`;
		}

		this.gui.settings.update();

		return logs;
	}

	async start() {
		this.gui.start();
		this.update();

		this.queue.fetch();

		this.started = true;
	}

	async update() {
		const start = performance.now();
		const target = 2500;

		try {
			await this.api.account().then(info => {
				this.rights = info.rights.reduce((acc, right) => ({ ...acc, [right]: true }), { });
				this.groups = info.groups.reduce((acc, group) => ({ ...acc, [group]: true }), { });
			});

			await this.api.getGlobalUserInfo(this.api.username).then(info => {
				this.rights.rollback ||= info.rights.includes("rollback");
			});

			if (!this.rights.rollback && this.api.username !== "LuniZunie")
				this.disable("Rollback required", "Your account no longer has rollback rights, which are required to use WikiShield.");

			{ // pending changes
				const allowed = this.rights.review && this.api.hasPendingChanges;
				document.querySelector("#queue-tab-pending").classList.toggle("hidden", !allowed);
				if (!allowed && this.queue.current.type === "pending")
					this.queue.switch("recent");
			}

			{ // backup
				this.backup();
			}
		} catch (error) {
			console.error("Update error:", error);
		}

		setTimeout(() => this.update(), Math.max(0, target - (performance.now() - start))); // Aim for 1 second intervals, but don't pile up calls
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
		if (!this.started)
			return;

		if (this.gui.dialog.dialogs.active)
			return this.gui.dialog.controller(event);
		else if (this.gui.settings.active)
			return this.gui.settings.controller(event);

		if (event.target?.tagName === "INPUT" || event.target?.tagName === "TEXTAREA" || event.target?.isContentEditable)
			return;

		// keydown bc we want speedy response
		if (event.type === "keydown") {
			if (event.repeat && !this.store.settings.repeat_control_scripts)
				return;

			const shortcut = buildShortcut(event);
			for (const script of this.store.control_scripts)
				if (script.keys.every(key => key === shortcut)) {
					event.preventDefault();
					this.execute(script);
				}
		}
	}

	async execute(script, continuity = true, updateProgress = null, item = null) {
		const base = updateProgress === null;
		const checker = (action, item) => {
			if (!action.name)
				return true;
			else if (action.name === "if")
				return this.gui.events.conditions[action.condition.name].check(this, item, action.condition.params);
			else if (action.name === "if not")
				return !this.gui.events.conditions[action.condition.name].check(this, item, action.condition.params);
			return false;
		};

		if (base) {
			item ??= this.queue.current.item || 1;

			const allScripts = [ script ];
			let totalActions = 0;

			while (allScripts.length > 0) {
				const current = allScripts[0];

				if (checker(current, item)) {
					if (!current.actions) {
						allScripts.splice(0, 1);
						continue;
					}

					allScripts.push(...current.actions);
				}

				if (current.name && !(current.name === "if" || current.name === "if not")
					&& this.gui.events.events[current.name].progress)
					totalActions++;

				allScripts.splice(0, 1);
			}

			if (totalActions > 0) {
				let actionsCompleted = 0;
				const progressBar = new ProgressBar();

				updateProgress = (text, error) => {
					const portion = text === "Done" ? 1 : actionsCompleted / totalActions;
					progressBar.set(text, portion, error);
					actionsCompleted++;
				};
			} else
				updateProgress = (_) => { };
		}

		if (checker(script, item)) {
			for (const action of script.actions) {
				if (!("name" in action))
					continue;

				// Create a copy of params to avoid mutating the original action object
				const params = { ...action.params };
				for (const param of this.gui.events.events[action.name]?.parameters?.(this, item) || [])
					if (param.id && !(param.id in params) && "default" in param)
						params[param.id] = param.default;

				if (action.name === "if" || action.name === "if not")
					continuity = await this.execute(action, continuity, updateProgress, item);
				else {
					const event = this.gui.events.events[action.name];

					const fail = () => {
						continuity = false;
						this.audio.playSound([ "action", "failed" ]);
						if (event.progress)
							updateProgress(event.progress, true);
					};
					try {
						if (continuity || !event.continuity) {
							const validity = event.valid?.(this, item, params) ?? { valid: true };
							if (validity.valid) {
								if (event.progress) {
									updateProgress(event.progress, false);
									this.audio.playSound([ "action", "default" ]);
								}

								this.store.statistics.actions_executed.total++;
								const result = await event.script(this, item, params);
								if (result.valid === false) {
									fail();
									if ("reason" in result)
										this.gui.dialog.toast("Action failed", result.reason, "error");
								} else {
									this.store.statistics.actions_executed.successful++;
									event.successful?.(this, item, params);
								}
							} else {
								fail();
								if ("reason" in validity)
									this.gui.dialog.toast("Action skipped", validity.reason, "error");
							}
						}
					} catch (error) {
						fail();
						this.gui.dialog.toast("Please report to developer", `An error occurred while executing action "${action.name}". Check the console for details.`, "error");
						console.error(`Error executing action "${action.name}":`, error.message || String(error));
					}
				}
			}
		}

		if (!script.name)
			updateProgress("Done", !continuity);

		return continuity;
	}

	async getDEFCON() {
		const page = "User:EnterpriseyBot/defcon";
		const content = (await this.api.getPagesContent([ page ]))[page];

		const level = content.match(/level\s*=\s*(\d+)/);
		const info = content.match(/info\s*=\s*([\d.]+)/);

		return {
			level: level ? Number(level[1]).toLocaleString() : null,
			info: info ? Number(info[1]).toLocaleString() : null,
		};
	}

	export() {
		this.time.save = performance.now();
		this.store.statistics.session_time += this.time.save - this.time.load;

		const { string, logs } = this.storage.encode();
		StorageManager.output(logs);

		return string;
	}

	backup() {
		this.time.save = performance.now();
		this.store.statistics.session_time += this.time.save - this.time.load;
		this.time.load = this.time.save;

		const { string } = this.storage.encode();
		electron.localStorage.set(`WikiShield:BackupStorage-${this.api.username}`, `${Date.now()};${string}`);
		return true;
	}

	async save() {
		this.backup();

		const data = `${Date.now()};${this.export()}`, username = this.api.username;
		if (window.isFinite)
			electron.saveAccount(username, data);
		else {
			try {
				const result = await this.api.postWithToken({ action: "options", optionname: "userjs-wikishield-storage", optionvalue: data });
				if (result?.options === "success")
					console.debug(`[WikiShield] Successfully saved account data for ${username}.`);
				else
					console.error(`[WikiShield] Failed to save account data for ${username}:`, result);
			} catch (err) { console.error(`[WikiShield] Failed to save account data for ${username}:`, err); }
		}
	}

	async load() {
		try {
			const save = [
				electron.localStorage.get(`WikiShield:BackupStorage-${this.api.username}`),
				(await this.api.post({ action: "query", meta: "userinfo", uiprop: "options", format: "json" })).query.userinfo.options[`userjs-wikishield-storage`]
			].reduce((latest, current) => {
				current ??= "0;e30=";
				let timestamp = 0, data = current;
				if (current.includes(";")) {
					[ timestamp, data ] = current.split(";", 2);
					timestamp = parseInt(timestamp, 10);
				}

				if (timestamp > 0 && timestamp > (latest?.timestamp ?? 0))
					return { timestamp, data };
				return latest;
			}, null)?.data ?? "e30=";

			return save;
		} catch (err) { return void(console.error("Failed to load storage from wiki:", err)) ?? "e30="; }
	}

	page(title, php, encode = true) {
		return `https://${this.server}/${php ? `w/index.php${title}` : `wiki/${encode ? encodeURIComponent(title) : title}`}`;
	}

	open(href, external) {
		if (external === "force")
			external = false;
		else
			external ||= !this.store.settings.wikipedia_popups.enabled;

		if (external)
			electron.openExternal(href);
		else {
			electron.openInBrowser(href).then(popupId => {
				if (popupId)
					requestAnimationFrame(() => {
						this.gui.dialog.popups.push(popupId);
						if (!document.getElementById("popup-blocker")) {
							const $popupBlock = document.createElement("div");
							$popupBlock.id = "popup-blocker";
							$popupBlock.innerText = "Please close the popup or click anywhere on this page to continue using WikiShield.";
							document.body.appendChild($popupBlock);

							this.gui.dialog.check();
						}
					});
			});
		}
	}
}