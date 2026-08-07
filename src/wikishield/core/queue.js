import { Memory } from "../../../global/memory/script.esm.js";
import { Stack } from "../../../global/stack/script.esm.js";
import { profanity } from "../data/profanity.js";

export class Queue {
	static refresh = 1000;
	static types = [ "recent", "pending", "watchlist", "abuselog", "users" ];
	static groups = {
		void: "void",

		recent: "edit",
		pending: "edit",
		watchlist: "edit",
		edit: "edit",

		abuselog: "abuselog",

		users: "logevent"
	};

	static areSameGroup(a, b) {
		return this.groups[a] === this.groups[b];
	}

	constructor(ws) {
		this.ws = ws;

		this.queues = Object.fromEntries([ "void", ...Queue.types ].map(type => {
			return [
				type,
				{
					type,

					item: null,
					previous: null,

					queue: [ ],

					hold: [ ],
					repeats: { },

					history: new Stack(100),

					memory: new Memory({ size: 1000 }),

					last: {
						timestamp: ws.util.utcString(new Date()),
						id: 0,
					}
				}
			]
		}));

		this.cache = {
			simple: new Memory({ size: 1000 }),
			full: new Memory({ size: 250 })
		};

		this.current = this.queues[Queue.types[0]];

		this.pending = new Map();
		this.watchlist = new Memory({ size: 1000 });
		this.talks = new Memory({ size: 500 });
		this.warnings = new Memory({ size: 1000, timeout: 24 * 60 * 60 * 1000 }); // 1 day
		this.noWelcome = new Memory({ timeout: 60 * 60 * 1000 }); // 1 hour
		this.histories = new Memory({ size: 1000 });
		this.contributions = new Memory({ size: 1000 });
		this.blocks = new Memory({ size: 1000 });
		this.blocked = new Memory({ size: 10000 });

		this.playedSound = {
			mention: new Memory({ timeout: 60 * 1000 })
		};

		this.bypass = new Memory({ timeout: 60 * 60 * 1000, size: 10000 }); // 1 hour

		this.backoff = 2000;
	}

	switch(type) {
		if (this.current.type === type)
			return;
		else if (this.current.type === "pending")
			this.queues.pending.queue = this.queues.pending.queue.filter(item => this.pending.has(item.id));

		document.querySelector("#clear-queue").classList.toggle("hidden", type === "pending");

		this.current = this.queues[type];
		if (!this.current.queue.some(item => item.id === this.current.item?.id))
			this.current.item = this.current.queue[0] || null;

		this.ws.gui.renderQueue();
		this.ws.gui.newCurrentItem(this.current.item);

		document.querySelectorAll("#queue-tabs > .queue-tab.selected").forEach($el => $el.classList.remove("selected"));
		document.querySelector(`#queue-tab-${type}`)?.classList.add("selected");
	}

	async fetch() {
		try {
			const queues = this.ws.store.settings.queue;
			if (queues.pending.enabled && this.ws.rights.review) {
				const pending = (await this.ws.api.feeds(null, { ns: "*", full: true })).pending;

				this.pending.clear();
				Object.values(pending).forEach(item => this.pending.set(item.revid, item));

				await this.outdated("pending");
			}

			const feeds = await this.ws.api.feeds(
				queues.recent.enabled ? { ns: this.ws.store.settings.namespaces.join("|"), since: this.queues.recent.last.timestamp } : null,
				queues.pending.enabled && this.ws.rights.review ? { ns: "*", full: false } : null,
				queues.users.enabled ? { ns: "*", since: this.queues.users.last.timestamp } : null,
				queues.watchlist.enabled ? { ns: "*", since: this.queues.watchlist.last.timestamp } : null,
				queues.abuselog.enabled ? { ns: this.ws.store.settings.namespaces.join("|"), since: this.queues.abuselog.last.timestamp } : null
			);

			const whitelist = this.ws.store.whitelist;
			for (const type of Queue.types) {
				const lastId = this.queues[type].last.id;

				let q = feeds[type] ?? [ ];
				const maxTimestamp = q.reduce((max, item) => Math.max(max, item.timestamp), 0);
				if (maxTimestamp)
					this.queues[type].last.timestamp = this.ws.util.utcString(new Date(maxTimestamp));

				switch (Queue.groups[type]) {
					case "edit": {
						const fn = item => item.revid > lastId;
						if (type === "recent")
							q = q.filter(item => fn(item) && !whitelist.pages.has(item.title));
						else
							q = q.filter(fn);
					} break;
					case "abuselog": {
						q = q.filter(item => item.id > lastId);
					} break;
					case "logevent": {
						q = q.filter(item => item.logid > lastId);
					} break;
				}

				q = q.concat(this.queues[type].hold);
				if (q.length > 25)
					this.queues[type].hold = q.splice(25).reverse();
				else
					this.queues[type].hold = [ ];

				let changed = false;
				switch (type) {
					case "recent": {
						const remove = new Set();
						for (const a of q)
							for (const b of this.queues[type].queue) {
								if (remove.has(b))
									continue;
								else if (b.id === this.current.item?.id)
									continue;

								if (a.title === b.page.title && b.id < a.revid)
									remove.add(b);
							}

						for (const item of remove) {
							const i = this.queues[type].queue.indexOf(item);
							if (i > -1) {
								this.queues[type].queue.splice(i, 1);
								this.ws.gui.removeQueueItem(type, item.id);
							}
						}

						changed = remove.size > 0;
					} break;
					case "pending": {
						for (const item of this.queues[type].queue)
							if (this.current.item?.id !== item.id && !this.pending.has(item.id)) {
								const i = this.queues[type].queue.indexOf(item);
								if (i > -1) {
									this.queues[type].queue.splice(i, 1);
									this.ws.gui.removeQueueItem(type, item.id);

									changed = true;
								}
							}
					} break;
					case "users": {
						q = q.filter(item => !item.temp); // remove temp accounts
					} break;
					case "watchlist": {
						const remove = new Set();
						for (const a of q)
							for (const b of this.queues[type].queue) {
								if (remove.has(b))
									continue;
								else if (b.id === this.current.item?.id)
									continue;

								if (a.title === b.page.title && b.id < a.revid)
									remove.add(b);
								else if (!b.page.watched)
									remove.add(b);
							}

						if (q.length === 0)
							for (const item of this.queues[type].queue)
								if (!item.page.watched)
									remove.add(item);

						for (const item of remove) {
							const i = this.queues[type].queue.indexOf(item);
							if (i > -1) {
								this.queues[type].queue.splice(i, 1);
								this.ws.gui.removeQueueItem(type, item.id);
							}
						}

						changed = remove.size > 0;
					} break;
				}

				if (q.length === 0) {
					if (changed)
						this.ws.gui.renderQueue(this.queues[type].queue, this.current.edit, type);
					continue;
				}

				switch (Queue.groups[type]) {
					case "edit": {
						this.queues[type].last.id = q.reduce((max, item) => Math.max(max, item.revid), 0);

						const highlight = this.ws.store.highlight;
						const hasHighlight = item => highlight.users.has(item.user) ||
													 highlight.pages.has(item.title) ||
													 item.tags?.some(tag => highlight.tags.has(tag));

						q = q.filter(item => !whitelist.users.has(item.user) && !item.tags?.some(tag => whitelist.tags.has(tag)) && (!this.bypass.has(item.user) || hasHighlight(item)));

						// parallel
						const oresCache = { };
						let [
							editCounts,
							ores
						] = await Promise.allSettled([
							type === "recent" ? this.ws.api.getEditCounts(q.map(item => item.user).filter(user => !this.bypass.has(user))) : Promise.resolve([ ]),
							this.ws.api.getORES(q.filter(item => {
								if (item.oresscores?.length)
									return void(oresCache[item.revid] = item.oresscores);
								return true;
							}, this.ws.store.settings.queue.ores_bias).map(item => item.revid))
						]);

						if (editCounts.status === "rejected")
							console.error("Edit counts failed:", editCounts.reason);
						if (editCounts.status === "fulfilled")
							editCounts = editCounts.value;
						else
							editCounts = { };

						if (ores.status === "rejected")
							console.error("ORES failed:", ores.reason);
						if (ores.status === "fulfilled")
							ores = ores.value;
						else
							ores = { };

						for (const [ revid, score ] of Object.entries(await this.ws.api.extractORES(oresCache, this.ws.store.settings.queue.ores_bias)))
							ores[revid] = score;

						const repeats = this.queues[type].repeats;
						const filtered = [ ];
						if (type === "recent") {
							const minORES = this.ws.store.settings.queue.min_ores;
							const max = this.ws.store.settings.queue.max_edits;
							q.forEach(item => {
								if (isNaN(ores[item.revid]) && (repeats[item.revid] || 0) < 3) {
									repeats[item.revid] = (repeats[item.revid] || 0) + 1;
									return this.queues[type].hold.push(item);
								}

								delete repeats[item.revid];

								if (this.ws.__DEV__ && this.ws.server === "test2.wikipedia.org")
									return filtered.push(item);

								const edits = editCounts[item.user] ?? this.bypass.get(item.user) ?? 0;
								if (edits > max) {
									this.bypass.set(item.user, edits);
									if (hasHighlight(item))
										filtered.push(item);
								} else if ((ores[item.revid] || 0) >= minORES || hasHighlight(item))
									filtered.push(item);
							});
						} else
							q.forEach(item => {
								if (isNaN(ores[item.revid]) && (repeats[item.revid] || 0) < 3) {
									repeats[item.revid] = (repeats[item.revid] || 0) + 1;
									return this.queues[type].hold.push(item);
								}

								delete repeats[item.revid];

								filtered.push(item);
							});

						await this.add(type, filtered);
					} break;
					case "logevent": {
						let max = 0;
						const set = new Set();
						const filtered = [ ];
						q.forEach(item => {
							if (set.has(item.logid))
								return;
							set.add(item.logid);

							if (item.logid > max)
								max = item.logid;
							filtered.push(item);
						});

						this.queues[type].last.id = max;

						await this.add(type, filtered);
					} break;
					case "abuselog": {
						const noEditCounts = q.filter(item => item.editcount === null);

						let editCounts = { };
						if (noEditCounts.length > 0)
							editCounts = await this.ws.api.getEditCounts(noEditCounts.map(item => item.user));

						const maxEdits = this.ws.store.settings.queue.max_edits;

						let max = 0;
						const filtered = [ ];
						q.forEach(item => {
							if (((item.editcount ?? editCounts[item.user]) || 0) > maxEdits)
								return;

							if (item.id > max)
								max = item.id;
							filtered.push(item);
						});

						this.queues[type].last.id = max;

						await this.add(type, filtered);
					} break;
				}
			}

			await this.outdated();

			this.backoff = Queue.refresh;
		} catch (error) {
			console.error(error);
			this.backoff = Math.min(this.backoff * 2, 120000);
		}

		setTimeout(() => this.fetch(), this.backoff);
	}
	async outdated() {
		{ // pending
			const remove = [ ];
			for (const item of this.queues.pending.queue) {
				if (item === this.current.item)
					continue;

				if (!this.pending.has(item.id))
					remove.push(item);
			}

			if (remove.length > 0)
				for (const item of remove) {
					const i = this.queues.pending.queue.indexOf(item);
					if (i > -1) {
						this.queues.pending.queue.splice(i, 1);
						this.ws.gui.removeQueueItem("pending", item.id);
					}
				}
		}

		const pages = new Set();
		const queues = [ "recent", "watchlist", "abuselog" ];
		for (const type of queues)
			this.queues[type].queue.forEach(item => {
				if (type === "abuselog" && !item.revid)
					return;
				pages.add(item.page.title);
			});

		const latests = await this.ws.api.getLatestIds([ ...pages ]);
		for (const type of queues) {
			const remove = [ ];
			for (const item of this.queues[type].queue) {
				let revid = item.id;
				if (type === "abuselog") {
					if (item.revid)
						revid = item.revid;
					else
						continue;
				}

				const latest = latests[item.page.title];
				if (latest && latest > revid)
					remove.push([ item.id, revid ]);
			}

			if (remove.length > 0)
				for (const [ id, revid ] of remove) {
					const prop = type === "abuselog" ? "revid" : "id";
					if (revid === this.queues[type].item?.[prop])
						continue;

					const i = this.queues[type].queue.findIndex(qItem => qItem[prop] === revid);
					if (i > -1) {
						this.queues[type].queue.splice(i, 1);
						this.ws.gui.removeQueueItem(type, id);
					}
				}
		}

		this.ws.gui.renderQueue();
	}

	async add(type, items) {
		const prop = { "edit": "revid", "logevent": "logid", "abuselog": "id" }[Queue.groups[type]];
		items = items.filter(item => !this.queues[type].memory.has(item[prop]));
		items.forEach(item => this.queues[type].memory.add(item[prop]));

		let len = items.length;
		if (len === 0)
			return;

		const play = { ores: false, mention: false };
		const parsed = await this.generate(type, items, false);
		switch (Queue.groups[type]) {
			case "edit": {
				const threshold = this.ws.store.settings.audio.ores_alert.threshold;
				for (let i = 0; i < len; i++) {
					const item = items[i], data = parsed[i];
					if (this.ws.mobile && !data.consecutive?.diff)
						continue;

					this.queues[type].queue.push(data);

					if (type === "recent" && data.ores >= threshold)
						play.ores = true;

					if (data.mentions.has && !this.playedSound.mention.has(data.id)) {
						this.playedSound.mention.add(data.id);
						play.mention = true;
					}
				}
			} break;
			case "logevent": {
				for (let i = 0; i < len; i++) {
					const item = items[i], data = parsed[i];

					this.queues[type].queue.push(data);

					if (data.mentions.has && !this.playedSound.mention.has(data.id)) {
						this.playedSound.mention.add(data.id);
						play.mention = true;
					}
				}
			} break;
			case "abuselog": {
				for (let i = 0; i < len; i++) {
					const item = items[i], data = parsed[i];

					this.queues[type].queue.push(data);

					if (data.mentions.has && !this.playedSound.mention.has(data.id)) {
						this.playedSound.mention.add(data.id);
						play.mention = true;
					}
				}
			} break;
		}

		this.sort(type);

		if (!this.ws.mobile) {
			if (play.ores && this.ws.store.settings.audio.ores_alert.enabled)
				this.ws.audio.playSound([ "queue", "ores" ]);
			if (play.mention && this.ws.store.settings.username_highlighting.enabled)
				this.ws.audio.playSound([ "queue", "mention" ]);
		}

		this.ws.gui.renderQueue(this.queues[type].queue, this.queues[type].item, type);
	}
	sort(type) {
		let i = -1;
		if (this.queues[type].item)
			i = this.queues[type].queue.findIndex(item => item === this.queues[type].item);

		let sorted = this.queues[type].queue;
		if (i >= 0)
			sorted = sorted.slice(0, i).concat(sorted.slice(i + 1));

		const highlight = this.ws.store.highlight;
		const mentions = this.ws.store.settings.username_highlighting.enabled;
		switch (Queue.groups[type]) {
			case "edit": {
				sorted = sorted.sort((a, b) => {
					if (a.history && b.history)
						return a.history - b.history;
					else if (a.history)
						return -1;
					else if (b.history)
						return 1;

					let aScore = a.ores;
					if (mentions && a.mentions.has)
						aScore += 200;
					if (highlight.users.has(a.user.name))
						aScore += 100;
					if (highlight.pages.has(a.page.title))
						aScore += 75;
					aScore += a.tags.filter(tag => highlight.tags.has(tag)).length * 50;

					let bScore = b.ores;
					if (mentions && b.mentions.has)
						bScore += 200;
					if (highlight.users.has(b.user.name))
						bScore += 100;
					if (highlight.pages.has(b.page.title))
						bScore += 75;
					bScore += b.tags.filter(tag => highlight.tags.has(tag)).length * 50;

					if (aScore === bScore)
						return b.id - a.id;
					return bScore - aScore;
				});
			} break;
			case "logevent": {
				sorted = sorted.sort((a, b) => {
					if (a.history && b.history)
						return a.history - b.history;
					else if (a.history)
						return 1;
					else if (b.history)
						return -1;

					let aScore = (a.user.profanity.clamped || 0) * 100;
					if (mentions && a.mentions.has)
						aScore += 200;

					let bScore = (b.user.profanity.clamped || 0) * 100;
					if (mentions && b.mentions.has)
						bScore += 200;

					if (aScore === bScore)
						return b.id - a.id;
					return bScore - aScore;
				});
			} break;
			case "abuselog": {
				sorted = sorted.sort((a, b) => {
					if (a.history && b.history)
						return a.history - b.history;
					else if (a.history)
						return 1;
					else if (b.history)
						return -1;

					let aScore = 0;
					if (highlight.users.has(a.user.name))
						aScore += 100;
					if (highlight.pages.has(a.page.title))
						aScore += 75;

					if (mentions && a.mentions.has)
						aScore += 200;

					let bScore = 0;
					if (highlight.users.has(b.user.name))
						bScore += 100;
					if (highlight.pages.has(b.page.title))
						bScore += 75;

					if (mentions && b.mentions.has)
						bScore += 200;

					if (aScore === bScore)
						return b.id - a.id;
					return bScore - aScore;
				});
			} break;
		}

		// it's doubling up somewhere and idk why but this should fix it
		const existing = new Set(this.queues[type].item?.id ? [ this.queues[type].item.id ] : [ ]);
		sorted = sorted.filter(item => {
			if (existing.has(item.id))
				return false;
			existing.add(item.id);
			return true;
		});

		if (i >= 0)
			sorted.splice(i, 0, this.queues[type].item);

		this.queues[type].queue = [ ...sorted.slice(0, this.ws.store.settings.queue.max_size) ];
		if (!this.queues[type].item)
			this.queues[type].item = this.queues[type].queue[0];
	}
	async generate(type, items, simple, options = { }) {
		if (items.length === 0)
			return [ ];

		const bypass = options?.bypass ?? false;

		const ws = this.ws;
		const username = ws.api.username;

		const result = [ ];
		switch (Queue.groups[type]) {
			case "edit": {
				items = items.filter(item => {
					const cached = ((revid) => {
						if (simple) {
							if (this.cache.simple.has(revid))
								return this.cache.simple.get(revid);
							else if (this.cache.full.has(revid))
								return this.cache.full.get(revid);
						} else if (this.cache.full.has(revid))
							return this.cache.full.get(revid);
						return null;
					})(item.revid);

					if (cached) {
						if (item.pending && !cached.pending)
							cached.pending = item.pending;
						return void(result.push(cached)) ?? false;
					}
					return true;
				});

				items = items.map(item => {
					let prior = null;
					if (item.pending)
						prior = this.pending.get(item.revid)?.prior;
					prior ??= item.old_revid || item.parentid;

					return { item, prior };
				});

				const parsed = await ws.api.parseEdits(items, simple, this.ws.store.settings.queue.ores_bias, bypass);
				for (const temp of parsed) {
					const { item, prior, data } = temp;
					const mentions = { comment: false, diff: false };
					if (username)
						if (data.edit.diff) {
							const $temp = document.createElement("div");
							$temp.innerHTML = data.edit.diff;
							if ($temp.textContent)
								mentions.diff = ws.util.match(username, $temp.textContent);
						}

					this.watchlist.set(item.title, data.page.watched);

					this.histories.set(item.title, data.page.history);
					this.contributions.set(item.user, data.user.contributions);

					this.blocks.set(item.user, data.user.blocks);
					this.blocked.set(item.user, data.user.blocked);

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, warning);

					const object = {
						page: {
							namespace: item.ns,
							title: item.title,

							get history() {
								return ws.queue.histories.get(item.title) ?? data.page.history;
							},
							get watched() {
								return ws.queue.watchlist.get(item.title) ?? data.page.watched;
							},

							metadata: data.page.metadata,
							categories: data.page.categories,
							protection: data.page.protection,
						},
						user: {
							name: item.user,
							ip: ws.util.isIPAddress(item.user),
							temp: ws.util.isTempAccount(item.user),
							anon: ws.util.isIPAddress(item.user) || ws.util.isTempAccount(item.user),

							edits: Math.max(data.user.edits, data.user.contributions?.length || 0),
							get contributions() {
								return ws.queue.contributions.get(item.user) ?? data.user.contributions;
							},

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							get blocked() {
								return ws.queue.blocked.get(item.user) ?? data.user.blocked;
							},
							get blocks() {
								return ws.queue.blocks.get(item.user) ?? data.user.blocks;
							},

							get talk() {
								return ws.queue.talks.get(item.user) ?? data.user.talk;
							}
						},
						mentions,
						AI: { // will be populated asynchronously
							edit: null,
							username: null
						},

						id: item.revid,
						prior: prior,

						timestamp: item.timestamp,
						comment: item.parsedcomment,
						minor: item.minor || false,

						diff: data.edit.diff,
						sizediff: ("sizediff" in item ? item.sizediff : item.newlen - item.oldlen) || 0,

						ores: data.edit.ores,
						tags: item.tags || [ ],

						reverts: data.page.reverts,
						consecutive: data.page.consecutive,

						propagating: false,
						reviewed: false,
						history: false,

						pending: item.pending || false,

						group: Queue.groups[type],
						type: type,

						simple: simple,
						origin: item,
					};
					if (!this.ws.mobile && !simple && ws.AI) {
						if (ws.store.settings.AI.edit_analysis.enabled)
							ws.AI.analyze.edit(object)
								.then(analysis => object.AI.edit = analysis)
								.catch(error => object.AI.edit = { error: error.message })
								.finally(() => {
									if (object.id === this.current.item?.id)
										ws.gui.updateAIAnalysisDisplay(object.AI.edit);
								});

						if (!object.user.anon && !ws.store.whitelist.users.has(object.user.name) && ws.store.settings.AI.username_analysis.enabled)
							ws.AI.analyze.username(object)
								.then(analysis => {
									object.AI.username = analysis;
									if (analysis.flag)
										this.promptUAA(object, analysis);
								})
								.catch(error => object.AI.username = { error: error.message });
					}

					result.push(object);
					if (simple)
						this.cache.simple.set(item.revid, object);
					else {
						this.cache.full.set(item.revid, object);
						if (this.cache.simple.has(item.revid))
							this.cache.simple.delete(item.revid);
					}
				}
			} break;
			case "logevent": {
				const parsed = await ws.api.parseUsers(items.map(item => item.title.replace(/^(User|User talk):/, "")), simple, bypass);
				const performers = await ws.api.parseUsers(items.map(item => item.user), simple, bypass);

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					const data = parsed[i];
					const performer = performers[i];

					const user = item.title.replace(/^(User|User talk):/, "");

					const mentions = { username: false, comment: false };
					if (username)
						if (user)
							mentions.username = ws.util.match(username, user);

					this.contributions.set(user, data.user.contributions);
					this.contributions.set(item.user, performer.user.contributions);

					this.blocks.set(user, data.user.blocks);
					this.blocks.set(item.user, performer.user.blocks);
					this.blocked.set(user, data.user.blocked);
					this.blocked.set(item.user, performer.user.blocked);

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(user) || "0"))
                    	this.warnings.set(user, warning);

					const performerWarning = this.getWarningLevel(performer.user.talk || "");
                	if (levels.indexOf(performerWarning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, performerWarning);

					const userProfanity = profanity.evaluate(user);
					const object = {
						page: {
							namespace: item.ns,
							title: item.title,

							history: [ ],
							get watched() {
								return false;
							},

							metadata: [ ],
							categories: [ ],
							protection: { },
						},
						user: {
							name: user,
							ip: ws.util.isIPAddress(user),
							temp: ws.util.isTempAccount(user),
							anon: ws.util.isIPAddress(user) || ws.util.isTempAccount(user),

							edits: Math.max(data.user.edits, data.user.contributions?.length || 0),
							get contributions() {
								return ws.queue.contributions.get(user) ?? data.user.contributions;
							},

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							get blocked() {
								return ws.queue.blocked.get(user) ?? data.user.blocked;
							},
							get blocks() {
								return ws.queue.blocks.get(user) ?? data.user.blocks;
							},

							get talk() {
								return ws.queue.talks.get(user) ?? data.user.talk;
							},

							profanity: userProfanity
						},
						performer: {
							name: item.user,
							ip: ws.util.isIPAddress(item.user),
							temp: ws.util.isTempAccount(item.user),
							anon: ws.util.isIPAddress(item.user) || ws.util.isTempAccount(item.user),

							edits: Math.max(performer.user.edits, performer.user.contributions?.length || 0),
							get contributions() {
								return ws.queue.contributions.get(item.user) ?? performer.user.contributions;
							},

							warning: this.getWarningLevel(performer.user.talk || ""),
							warnings: this.getWarningHistory(performer.user.talk || ""),

							get blocked() {
								return ws.queue.blocked.get(item.user) ?? performer.user.blocked;
							},
							get blocks() {
								return ws.queue.blocks.get(item.user) ?? performer.user.blocks;
							},

							get talk() {
								return ws.queue.talks.get(item.user) ?? performer.user.talk;
							}
						},
						mentions,
						AI: { // will be populated asynchronously
							username: null
						},

						id: item.logid,

						timestamp: item.timestamp,
						comment: item.parsedcomment,

						ores: userProfanity.clamped || 0,
						filters: userProfanity.matches.map(match => ({ filter: match.name, id: match.match })),

						propagating: false,
						reviewed: false,
						history: false,

						group: Queue.groups[type],
						type: type,

						simple: simple,
						origin: item,
					};
					if (!this.ws.mobile && !simple && ws.AI) {
						if (!object.user.anon && !ws.store.whitelist.users.has(object.user.name) && ws.store.settings.AI.username_analysis.enabled)
							ws.AI.analyze.username(object)
								.then(analysis => {
									object.AI.username = analysis;
									if (analysis.flag)
										this.promptUAA(object, analysis);
								})
								.catch(error => object.AI.username = { error: error.message });
					}

					result.push(object);
				}
			} break;
			case "abuselog": {
				const parsed = await ws.api.parseAbuselogs(items, simple, bypass);
				for (const temp of parsed) {
					const { item, data } = temp;

					const mentions = { comment: false, diff: false };
					if (username)
						if (data.edit.diff) {
							const $temp = document.createElement("div");
							$temp.innerHTML = data.edit.diff;
							if ($temp.textContent)
								mentions.diff = ws.util.match(username, $temp.textContent);
						}

					this.watchlist.set(item.title, data.page.watched);

					this.histories.set(item.title, data.page.history);
					this.contributions.set(item.user, data.user.contributions);

					this.blocks.set(item.user, data.user.blocks);
					this.blocked.set(item.user, data.user.blocked);

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, warning);

					const results = [ "disallow", "warn", "showcaptcha", "tag", "none" ];
					const len = results.length;
					let action = len - 1;
					for (let i = 0; i < len; i++)
						if (item.result.has(results[i])) {
							action = i;
							break;
						}

					const object = {
						page: {
							namespace: item.ns,
							title: item.title,

							get history() {
								return ws.queue.histories.get(item.title) ?? data.page.history;
							},
							get watched() {
								return ws.queue.watchlist.get(item.title) ?? data.page.watched;
							},

							metadata: data.page.metadata,
							categories: data.page.categories,
							protection: data.page.protection,
						},
						user: {
							name: item.user,
							ip: ws.util.isIPAddress(item.user),
							temp: ws.util.isTempAccount(item.user),
							anon: ws.util.isIPAddress(item.user) || ws.util.isTempAccount(item.user),

							edits: Math.max(data.user.edits, data.user.contributions?.length || 0),
							get contributions() {
								return ws.queue.contributions.get(item.user) ?? data.user.contributions;
							},

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							get blocked() {
								return ws.queue.blocked.get(item.user) ?? data.user.blocked;
							},
							get blocks() {
								return ws.queue.blocks.get(item.user) ?? data.user.blocks;
							},

							get talk() {
								return ws.queue.talks.get(item.user) ?? data.user.talk;
							}
						},
						mentions,
						AI: { // will be populated asynchronously
							edit: null,
							username: null
						},

						id: item.id,
						revid: item.revid,

						timestamp: item.timestamp,
						comment: data.parsedcomment,
						minor: false,

						diff: data.edit.diff,
						sizediff: item.diff?.size,

						ores: +(1 - action / (len - 1)).toFixed(2),
						filters: item.entries.map(entry => ({ id: entry?.filter_id || "-1", filter: entry?.filter })) || [ ],

						reverts: data.page.reverts,

						propagating: false,
						reviewed: false,
						history: false,

						group: Queue.groups[type],
						type: type,

						simple: simple,
						origin: item,
					};
					if (!this.ws.mobile && !simple && ws.AI) {
						if (ws.store.settings.AI.edit_analysis.enabled && data.edit.diff) // only analyze if diff exists
							ws.AI.analyze.edit(object)
								.then(analysis => object.AI.edit = analysis)
								.catch(error => object.AI.edit = { error: error.message })
								.finally(() => {
									if (object.id === this.current.item?.id)
										ws.gui.updateAIAnalysisDisplay(object.AI.edit);
								});

						if (!object.user.anon && !ws.store.whitelist.users.has(object.user.name) && ws.store.settings.AI.username_analysis.enabled)
							ws.AI.analyze.username(object)
								.then(analysis => {
									object.AI.username = analysis;
									if (analysis.flag)
										this.promptUAA(object, analysis);
								})
								.catch(error => object.AI.username = { error: error.message });
					}

					result.push(object);
				}
			} break;
		}

		result.forEach(item => {
			if (item.comment) {
				const parser = new DOMParser();
				const doc = parser.parseFromString(item.comment, "text/html");
				const $preview = doc.body;
				$preview.querySelectorAll("[href]").forEach($link => {
					const href = $link.getAttribute("href");
					$link.setAttribute("href", new URL(href, `https://${this.ws.server}`).href);
				});
				$preview.querySelectorAll("[src]").forEach($img => {
					const src = $img.getAttribute("src");
					$img.setAttribute("src", new URL(src, `https://${this.ws.server}`).href);
				});
				$preview.querySelectorAll("[srcset]").forEach($img => {
					const srcset = $img.getAttribute("srcset");
					const newSrcset = srcset.split(",").map(part => {
						const [ url, descriptor ] = part.trim().split(/\s+/, 2);
						const newUrl = new URL(url, `https://${this.ws.server}`).href;
						return descriptor ? `${newUrl} ${descriptor}` : newUrl;
					}).join(", ");
					$img.setAttribute("srcset", newSrcset);
				});

				item.comment = $preview.innerHTML;

				const textContent = ($preview.textContent || "").trim();
				item.has_comment = Boolean(textContent);
				if (item.mentions.comment === false)
					item.mentions.comment = ws.util.match(username, textContent);

				if (item.mentions)
					item.mentions.has = Object.values(item.mentions).some(v => v);
			} else
				item.has_comment = false;
		});

		return result;
	}

	previous() {
		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (this.current.type === "pending") {
			this.current.item = this.current.queue[Math.max(i - 1, 0)];
			return this.ws.gui.renderQueue(null, null, null, "previous");
		}

		if (i <= 0) {
			if (this.current.history.length === 0)
				return;

			this.current.queue.unshift(this.current.history.pop());
			this.current.item = this.current.queue[0];

			return this.ws.gui.renderQueue(null, null, null, "previous");
		}

		this.current.item = this.current.queue[i - 1];

		this.ws.gui.renderQueue(null, null, null, "previous");
	}

	next() {
		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (i === -1) {
			this.current.item = this.current.queue[0];
			return this.ws.gui.renderQueue(null, null, null, "next");
		}

		if (this.current.type === "pending") {
			this.current.item = this.current.queue[Math.min(i + 1, this.current.queue.length - 1)];
			return this.ws.gui.renderQueue(null, null, null, "next");
		}

		const leaving = this.current.item;
		const group = Queue.groups[leaving.type];
		if (!leaving.reviewed && (group === "edit" || (group === "abuselog" && leaving.revid))) {
			if (leaving.type === "watchlist")
				this.ws.api.markWatchlistSeen(leaving.page.title, leaving.id);

			const id = leaving.type === "abuselog" ? leaving.revid : leaving.id;
			[ "recent", "watchlist", "abuselog" ].filter(t => t !== leaving.type).forEach(t => { // FIX not working on watchlist
				if (t === "abuselog")
					this.queues[t].queue = this.queues[t].queue.filter(item => {
						if (item.revid === id) {
							this.queues[t].history.push({ ...item, history: performance.now() });
							return false;
						}
						return true;
					});
				else
					this.queues[t].queue = this.queues[t].queue.filter(item => {
						if (item.id === id) {
							this.queues[t].history.push({ ...item, history: performance.now() });
							if (t === "watchlist")
								this.ws.api.markWatchlistSeen(item.page.title, item.id);

							return false;
						}
						return true;
					});
			});

			if (group !== "abuselog") {
				let toRemove = this.queues.abuselog.queue.filter(item => {
					return leaving.user.name === item.user.name &&
						   leaving.page.title === item.page.title &&
						   Math.abs(new Date(leaving.timestamp).getTime() - new Date(item.timestamp).getTime()) < 3 * 1000 // 3 seconds
				});

				if (toRemove.length > 0) {
					Promise.allSettled(toRemove.map(async item => {
						let revid = item.revid;
						if (!revid)
							revid = await this.ws.api.getAbuseLogRevid(item.id);

						if (revid) {
							item.revid = revid;
							return { id: item.id, revid };
						}
						return null;
					})).then(result => {
						const remove = result.map(r => r.status === "fulfilled" ? r.value : null).filter(v => v);
						this.queues.abuselog.queue = this.queues.abuselog.queue.filter(item => !remove.some(r => r.revid === item.revid));

						if (this.current.type === "abuselog") {
							remove.forEach(r => this.ws.gui.removeQueueItem("abuselog", r.id));
							this.ws.gui.renderQueue(this.queues.abuselog.queue, this.queues.abuselog.item, "abuselog");
						}
					}).catch(() => { });
				}
			}
		}

		leaving.reviewed = true;
		if (leaving && this.ws.AI)
			this.ws.AI.cancel.edit(leaving.id);

		this.current.queue.splice(i, 1);
		this.ws.gui.removeQueueItem(this.current.type, leaving.id);

		if (this.current.queue.length === 0)
			this.current.item = null;
		else {
			if (i < this.current.queue.length)
				this.current.item = this.current.queue[i];
			else
				this.current.item = this.current.queue[this.current.queue.length - 1];
		}

		if (leaving && Queue.groups[this.current.type] === "edit")
			this.promptWelcome(leaving);

		this.current.history.push({ ...leaving, history: performance.now() });
		this.ws.gui.renderQueue(null, null, null, "next");
	}

	canGoPrevious() {
		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (i === -1)
			return this.current.history.length > 0;

		if (this.current.type === "pending")
			return i > 0;
		else if (i === 0)
			return this.current.history.length > 0;
		else
			return true;
	}
	canGoNext() {
		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (i === -1)
			return Boolean(this.current.queue[0]);

		if (this.current.type === "pending")
			return i < this.current.queue.length - 1;
		else
			return true;
	}

	clear(type) {
		if (type === "pending")
			return;

		this.queues[type].item = null;
		this.queues[type].queue = [ ];

		if (this.current.type === type) {
			this.ws.gui.newCurrentItem(null);
			this.ws.gui.clearQueueItems();
		}
	}

	async promptWelcome(item) {
		if (this.ws.store.settings.auto_welcome.enabled)
			return;
		else if (!item.user?.anon)
			return;
		else if ((item.user?.edits || 0) === 0) // don't welcome users with 0 edits
			return;
		else if (item.user?.talk === undefined)
			return;
		else if (this.noWelcome.has(item.user?.name))
			return;

		try {
			const title = `User talk:${item.user.name}`;
			const exists = await this.ws.api.pagesExist([ title ]);
			if (exists[title] !== undefined)
				return void(this.talks.set(item.user.name, exists[title])) ?? exists[title];

			await this.ws.gui.settings.waitForClose();
			const confirmed = await this.ws.gui.dialog.confirm(
				"Auto-Welcome User",
				`Would you like to welcome <span class="confirmation-modal-username">${this.ws.util.escape(item.user.name)}</span>?<br><br>
					<span style="font-size: .9em; color: #888;">Editing: <strong>${this.ws.util.escape(item.page.title)}</strong></span>`,
				{ username: item.user.name, hideUAA: false }
			);

			this.noWelcome.add(item.user.name);
			if (confirmed)
				this.ws.execute({
					actions: [
						{
							name: "welcome-user",
							params: {
								template: "Auto"
							}
						}
					]
				}, void 0, void 0, item);
		} catch (error) { console.error("Error during auto-welcome check:", error); }
	}
	#uaaQueue = Promise.resolve();
	promptUAA(item, analysis) {
		this.#uaaQueue = this.#uaaQueue.then(() => this.#promptUAAInternal(item, analysis)).catch(() => { });
		return this.#uaaQueue;
	}
	async #promptUAAInternal(item, analysis) {
		if (item.user.anon)
			return;
		else if (this.ws.store.whitelist.users.has(item.user.name))
			return;
		else if (!analysis.issues || analysis.issues.length === 0) // if u don't have any issue, why tf would u report 😭
			return;
		else if (!analysis.explanation) // once again, if u don't have reasoning, why report
			return;

		const violation = analysis.issues.map(issue => `${issue.severity} ${issue.policy} violation`).join(", ");
		const confidence = Math.round(analysis.confidence * 100);
		const username = item.user.name;

		await this.ws.gui.settings.waitForClose();
		const confirmed = await this.ws.gui.dialog.confirm(
			"Report Username to UAA",
			`
				The username <span class="confirmation-modal-username">${this.ws.util.escape(username)}</span> for ${violation}.<br><br>
				<strong>AI Confidence:</strong> ${confidence}%<br>
				<strong>Reasoning:</strong> ${analysis.explanation}<br>
			`,
			username,
		);

		if (confirmed) {
			await this.ws.gui.settings.waitForClose();
			const reason = await this.ws.gui.dialog.UAA(item.user.name);
			if (reason)
				this.ws.execute({
					actions: [
						{
							name: "report-user-to-uaa",
							params: {
								reason: reason
							}
						}
					]
				}, void 0, void 0, item);
		}
	}

	async propagate(item, bypass) {
		if (item.propagating)
			return await item.propagating;

		if (item.simple) {
			let resolve;
			item.propagating = new Promise(res => resolve = res);

			const [ loaded ] = await this.generate(item.type, [ item.origin ], false, { bypass });
			loaded.history = item.history;
			Object.assign(item, loaded);

			resolve();
			item.propagating = false;
		} else
			this.generate(item.type, [ item.origin ], false, { bypass }).then(([ loaded ]) => {
				const revid = item.revid;
				loaded.history = item.history;
				Object.assign(item, loaded);
				item.revid = revid;
			});
	}

	loadFromItem(item) {
		const type = this.current.type;
		if (Queue.areSameGroup(type, "edit") && !(type === "pending" && item.type === "edit")) {
			this.queues[type].queue = this.queues[type].queue.filter(i => i.id !== item.id);

			const i = this.queues[type].queue.findIndex(i => i.id === this.current.item?.id);
			if (i > -1)
				this.queues[type].queue[i] = item;
		}

		this.queues[type].item = this.queues[type].queue.find(i => i.id === item.id) || item;
		this.ws.gui.renderQueue();
	}
	async loadFromRevision(title, revid) {
		try {
			this.ws.gui.updateDiffDisplay("loading");

			let item;
			if (this.cache.full.has(revid))
				item = this.cache.full.get(revid);
			else {
				let object;
				if (this.cache.simple.has(revid)) {
					const simple = this.cache.simple.get(revid);
					object = {
						revid: simple.id,
						parentid: simple.prior,

						ns: simple.page.namespace,
						title: simple.page.title,
						user: simple.user.name,

						timestamp: simple.timestamp,
						parsedcomment: simple.comment,
						tags: simple.origin.tags,

						sizediff: simple.sizediff,

						minor: simple.minor,
					};
				} else {
					const rev = await this.ws.api.getRevision(title, revid, true);
					if (!rev)
						throw new Error("Revision not found");

					object = {
						revid: rev.revid,
						parentid: rev.parentid,

						ns: rev.ns,
						title: title,
						user: rev.user,

						timestamp: rev.timestamp,
						parsedcomment: rev.parsedcomment,
						tags: rev.tags,

						size: rev.size,
						oldlen: rev.oldlen || 0,
						newlen: rev.size,

						minor: rev.minor,
					};
				}

				[ item ] = await this.generate("edit", [ object ], false, { bypass: true });
			}

			const type = this.current.type;
			if (Queue.areSameGroup(type, "edit") && type !== "pending" && type !== "abuselog") {
				this.queues[type].queue = this.queues[type].queue.filter(i => i.id !== item.id);

				const i = this.queues[type].queue.findIndex(i => i.id === this.current.item?.id);
				if (i > -1)
					this.queues[type].queue[i] = item;
			}

			this.queues[type].item = item;
			this.ws.gui.renderQueue();
		} catch (error) {
			console.error("Error loading from revision:", error);
			document.querySelector("#diff-container").innerHTML = `<div class="error">Failed to load revision: ${this.ws.util.escape(error.message)}</div>`;
		}
	}

	getWarningLevel(text) {
		const levels = [ "0", "1", "2", "3", "4", "4im" ];
		let highestLevel = "0";

		const month = this.ws.util.monthSectionName();
		const sections = this.ws.util.getPageSections(text);
		for (const section of sections)
			if (section.title === month) {
				const templates = section.content.match(/<!-- Template:[\w-]+?(\d(?:i?m)?) -->/g);
				if (templates === null)
					break;

				const filtered = [ ...templates.map(t => {
					const match = t.match(/<!-- Template:[\w-]+?(\d(?:i?m)?) -->/);
					return match ? match[1].toString() : "0";
				}), highestLevel ].map(level => [ level, levels.indexOf(level) ]);

				highestLevel = filtered.sort((a, b) => b[1] - a[1])[0][0];
			}

		return highestLevel;
	}

	getWarningHistory(text) {
		const warnings = [ ];

		const month = this.ws.util.monthSectionName();
		const sections = this.ws.util.getPageSections(text);
		for (const section of sections)
			if (section.title === month) {
				const templateMatches = section.content.matchAll(/<!-- Template:([\w-]+?)(\d(?:i?m)?) -->(.+?)(?=<!-- Template:|$)/gs);
				for (let match of templateMatches) {
					const templateName = match[1];
					const level = match[2];
					const content = match[3];

					const timestampMatch = content.match(/(\d{2}:\d{2}.*?\d{4} \(UTC\))/);
					let timestamp = timestampMatch ? timestampMatch[1] : null;
					if (timestamp)
						timestamp = timestamp.replace(/<[^>]*>/g, '');

					if (timestamp) {
						const [ , time, day, monthName, year ] = timestamp.match(/(\d{2}:\d{2}), (\d{1,2}) ([A-Za-z]+) (\d{4})/);

						const i = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ].indexOf(monthName);
						timestamp = new Date(Date.UTC(year, i, day, ...time.split(":"))).toUTCString();
					} else
						timestamp = null;

					let username = null;
					const userLinkMatch = content.match(/\[\[User(?:[ _]talk)?:([^\]|]+)/i);
					if (userLinkMatch)
						username = userLinkMatch[1].trim();

					const articleMatch = content.match(/\[\[([^\]]+?)\]\]/);
					const article = articleMatch ? articleMatch[1] : null;

					warnings.push({
						template: templateName,
						level: level,
						timestamp: timestamp,
						username: username,
						article: article,
						section: section.title,
					});
				}
			}

		return warnings;
	}
}