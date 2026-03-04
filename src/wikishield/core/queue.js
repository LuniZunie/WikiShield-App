import { Memory, Stack } from "../../../global/memory/script.esm.js";
import { profanity } from "../data/profanity.js";

export class Queue {
	static refresh = 1000;
	static types = [ "recent", "pending", "watchlist", "abuselog", "users" ];
	static groups = {
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

		this.queues = Object.fromEntries(Queue.types.map(type => {
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
			simple: new Memory({ size: 2500 }),
			full: new Memory({ size: 500 })
		};

		this.current = this.queues[Queue.types[0]];

		this.pending = new Map();
		this.watchlist = new Memory({ size: 10000 });
		this.talks = new Memory({ size: 1000 });
		this.warnings = new Memory({ size: 10000, timeout: 24 * 60 * 60 * 1000 }); // 1 day
		this.noWelcome = new Memory({ timeout: 60 * 60 * 1000 }); // 1 hour

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

		this.current = this.queues[type];
		if (!this.current.queue.some(item => item.id === this.current.item?.id))
			this.current.item = this.current.queue[0] || null;

		this.ws.gui.renderQueue();
		this.ws.gui.newCurrentItem(this.current.item);

		document.querySelectorAll("#queue-tabs > .queue-tab.selected").forEach($el => $el.classList.remove("selected"));
		document.querySelector(`#queue-tab-${type}`).classList.add("selected");
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
				if (q[0]?.timestamp)
					this.queues[type].last.timestamp = this.ws.util.utcString(new Date(q[0].timestamp));

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
						this.queues[type].last.id = Math.max(...q.map(item => item.revid));

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

				if (type !== "pending" && type !== "users")
					await this.outdated(type);
			}

			this.backoff = Queue.refresh;
		} catch (error) {
			console.error(error);
			this.backoff = Math.min(this.backoff * 2, 120000);
		}

		setTimeout(() => this.fetch(), this.backoff);
	}
	async outdated(type) {
		if (this.queues[type].queue.length === 0)
			return;

		const remove = [ ];
		switch (type) {
			case "flagged": {
				for (const item of this.queues[type].queue) {
					if (item === this.current.item)
						continue;

					if (!this.pending.has(item.id))
						remove.push(item);
				}

				if (remove.length > 0)
					for (const item of remove) {
						const i = this.queues[type].queue.indexOf(item);
						if (i > -1) {
							this.queues[type].queue.splice(i, 1);
							this.ws.gui.removeQueueItem(type, item.id);
						}
					}
			} break;
			default: {
				let queue = this.queues[type].queue;
				if (type === "abuselog")
					queue = queue.filter(item => item.revid);

				const pages = [ ...new Set(queue.map(item => item.page.title)) ];
				if (pages.length === 0)
					return;

				const latests = await this.ws.api.getLatestIds(pages);
				for (const item of queue) {
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
					for (const [ id, revid ] of remove)
						[ "recent", "watchlist", "abuselog" ].forEach(t => {
							const prop = t === "abuselog" ? "revid" : "id";
							if (revid === this.queues[t].item?.[prop])
								return;

							const i = this.queues[t].queue.findIndex(qItem => qItem[prop] === revid);
							if (i > -1) {
								this.queues[t].queue.splice(i, 1);
								this.ws.gui.removeQueueItem(t, id);
							}
						});
			}
		}

		if (remove.length > 0)
			this.ws.gui.renderQueue(this.queues[type].queue, this.queues[type].item, type);
	}

	async add(type, items) {
		const prop = { "edit": "revid", "logevent": "logid", "abuselog": "id" }[Queue.groups[type]];
		items = items.filter(item => !this.queues[type].memory.has(item[prop]));
		items.forEach(item => this.queues[type].memory.add(item[prop]));

		const len = items.length;
		if (len === 0)
			return;

		const play = { ores: false, mention: false };
		const parsed = await this.generate(type, items, false);
		switch (Queue.groups[type]) {
			case "edit": {
				const threshold = this.ws.store.settings.audio.ores_alert.threshold;
				for (let i = 0; i < len; i++) {
					const item = items[i];
					const data = parsed[i];

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
					const item = items[i];
					const data = parsed[i];

					this.queues[type].queue.push(data);

					if (data.mentions.has && !this.playedSound.mention.has(data.id)) {
						this.playedSound.mention.add(data.id);
						play.mention = true;
					}
				}
			} break;
			case "abuselog": {
				for (let i = 0; i < len; i++) {
					const item = items[i];
					const data = parsed[i];

					this.queues[type].queue.push(data);

					if (data.mentions.has && !this.playedSound.mention.has(data.id)) {
						this.playedSound.mention.add(data.id);
						play.mention = true;
					}
				}
			} break;
		}

		this.sort(type);

		if (play.ores && this.ws.store.settings.audio.ores_alert.enabled)
			this.ws.audio.playSound([ "queue", "ores" ]);
		if (play.mention && this.ws.store.settings.username_highlighting.enabled)
			this.ws.audio.playSound([ "queue", "mention" ]);

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
					if (highlight.users.has(a.user.name))
						aScore += 100;
					if (highlight.pages.has(a.page.title))
						aScore += 75;
					aScore += a.tags.filter(tag => highlight.tags.has(tag)).length * 50;

					if (mentions && a.mentions.has)
						aScore += 200;

					let bScore = b.ores;
					if (highlight.users.has(b.user.name))
						bScore += 100;
					if (highlight.pages.has(b.page.title))
						bScore += 75;
					bScore += b.tags.filter(tag => highlight.tags.has(tag)).length * 50;

					if (mentions && b.mentions.has)
						bScore += 200;

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
						return -1;
					else if (b.history)
						return 1;

					const aScore = mentions && a.mentions.has;
					const bScore = mentions && b.mentions.has;

					if (aScore === bScore)
						return a.id - b.id;
					return bScore - aScore;
				});
			} break;
			case "abuselog": {
				sorted = sorted.sort((a, b) => {
					if (a.history && b.history)
						return a.history - b.history;
					else if (a.history)
						return -1;
					else if (b.history)
						return 1;

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
						return a.id - b.id;
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
					if (simple) {
						if (this.cache.full.has(item.revid))
							return void(result.push(this.cache.full.get(item.revid))) ?? false;
						else if (this.cache.simple.has(item.revid))
							return void(result.push(this.cache.simple.get(item.revid))) ?? false;
					} else if (this.cache.full.has(item.revid))
						return void(result.push(this.cache.full.get(item.revid))) ?? false;
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
					if (username) {
						if (item.comment)
							mentions.comment = ws.util.match(username, item.comment);
						if (data.edit.diff) {
							const $temp = document.createElement("div");
							$temp.innerHTML = data.edit.diff;
							if ($temp.textContent)
								mentions.diff = ws.util.match(username, $temp.textContent);
						}
					}

					this.watchlist.set(item.title, data.page.watched);

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, warning);

					const object = {
						display: {
							get title() {
								const $title = document.createElement("div");
								$title.className = "page-title";
								$title.classList.toggle("queue-highlight", ws.store.highlight.pages.has(item.title));

								const $icon = document.createElement("span");
								$icon.className = "fa fa-file-alt queue-item-icon";
								$title.appendChild($icon);

								const $text = document.createElement("a");
								$text.href = ws.util.pageLink(item.title);
								$text.dataset.tooltip = item.title;
								$text.dataset.multipleHrefs = `page;title=${encodeURIComponent(item.title)}&id=${item.revid}`;
								$text.textContent = ws.util.truncate(item.title, 50);
								$title.appendChild($text);

								return $title.outerHTML;
							},
							get username() {
								const $user = document.createElement("div");
								$user.className = "username";
								$user.classList.toggle("queue-highlight", ws.store.highlight.users.has(item.user));
								$user.classList.toggle("queue-user-empty-talk", data.user.talk === undefined);

								const $icon = document.createElement("span");
								$icon.className = "fa fa-user queue-user-icon";
								$user.appendChild($icon);

								const $text = document.createElement("a");
								$text.classList.toggle("user-blocked", data.user.blocked);
								$text.href = ws.util.pageLink(`User:${item.user}`);
								$text.dataset.tooltip = item.user;
								$text.dataset.multipleHrefs = `user;name=${encodeURIComponent(item.user)}`;
								$text.textContent = ws.util.truncate(item.user, 30);
								$user.appendChild($text);

								return $user.outerHTML;
							},
							get tags() {
								const $tags = document.createElement("div");
								$tags.className = "tags";

								const tags = item.tags.sort((a, b) => ws.store.highlight.tags.has(b) - ws.store.highlight.tags.has(a));
								tags.forEach(tag => {
									const $tag = document.createElement("span");
									$tag.className = "tag";
									$tag.classList.toggle("queue-highlight", ws.store.highlight.tags.has(tag));
									$tag.dataset.tooltip = tag;
									$tag.textContent = ws.util.truncate(tag, 10);
									$tags.appendChild($tag);
								});

								return $tags.outerHTML;
							}
						},
						page: {
							namespace: item.ns,
							title: item.title,

							history: data.page.history,
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
							contributions: data.user.contributions,

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							blocked: data.user.blocked,
							blocks: data.user.blocks,

							get talk() {
								return ws.queue.talks.get(item.user) ?? data.user.talk;
							}
						},
						mentions: {
							has: Object.values(mentions).some(v => v),
							...mentions
						},
						AI: { // will be populated asynchronously
							edit: null,
							username: null
						},

						id: item.revid,
						prior: prior,

						timestamp: item.timestamp,
						comment: item.comment,
						minor: item.minor || false,

						diff: data.edit.diff,
						sizediff: ("sizediff" in item ? item.sizediff : item.newlen - item.oldlen) || 0,

						ores: data.edit.ores,
						tags: item.tags || [ ],

						reverts: data.page.reverts,
						consecutive: simple ? undefined : ws.api.getConsecutiveEdits(item.title, item.revid, item.user, bypass),

						propagating: false,
						reviewed: false,
						history: false,

						pending: item.pending || false,

						group: Queue.groups[type],
						type: type,

						simple: simple,
						origin: item,
					};
					if (!simple && ws.AI) {
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
					if (username) {
						if (user)
							mentions.username = ws.util.match(username, user);
						if (item.comment)
							mentions.comment = ws.util.match(username, item.comment);
					}

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(user) || "0"))
                    	this.warnings.set(user, warning);

					const performerWarning = this.getWarningLevel(performer.user.talk || "");
                	if (levels.indexOf(performerWarning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, performerWarning);

					const object = {
						display: {
							get title() {
								const $title = document.createElement("div");
								$title.className = "page-title";
								$title.classList.toggle("queue-highlight", ws.store.highlight.pages.has(item.title));

								const $icon = document.createElement("span");
								$icon.className = "fa fa-file-alt queue-item-icon";
								$title.appendChild($icon);

								const $text = document.createElement("a");
								$text.href = ws.util.pageLink(item.title);
								$text.dataset.tooltip = item.title;
								$text.dataset.multipleHrefs = `log;title=${encodeURIComponent(item.title)}&log=${JSON.stringify(item)}`;
								$text.textContent = ws.util.truncate(item.title, 50);
								$title.appendChild($text);

								return $title.outerHTML;
							},
							get username() {
								const $user = document.createElement("div");
								$user.className = "username";
								$user.classList.toggle("queue-highlight", ws.store.highlight.users.has(user));
								$user.classList.toggle("queue-user-empty-talk", data.user.talk === undefined);

								const $icon = document.createElement("span");
								$icon.className = "fa fa-user queue-user-icon";
								$user.appendChild($icon);

								const $text = document.createElement("a");
								$text.classList.toggle("user-blocked", data.user.blocked);
								$text.href = ws.util.pageLink(`User:${user}`);
								$text.dataset.tooltip = user;
								$text.dataset.multipleHrefs = `user;name=${encodeURIComponent(user)}`;
								$text.textContent = ws.util.truncate(user, 30);
								$user.appendChild($text);

								return $user.outerHTML;
							},
							get performer() {
								const $user = document.createElement("div");
								$user.className = "username";
								$user.classList.toggle("queue-highlight", ws.store.highlight.users.has(item.user));
								$user.classList.toggle("queue-user-empty-talk", performer.user.talk === undefined);

								const $icon = document.createElement("span");
								$icon.className = "fa fa-user queue-user-icon";
								$user.appendChild($icon);

								const $text = document.createElement("a");
								$text.classList.toggle("user-blocked", performer.user.blocked);
								$text.href = ws.util.pageLink(`User:${item.user}`);
								$text.dataset.tooltip = item.user;
								$text.dataset.multipleHrefs = `user;name=${encodeURIComponent(item.user)}`;
								$text.textContent = ws.util.truncate(item.user, 30);
								$user.appendChild($text);

								return $user.outerHTML;
							},
						},
						page: {
							namespace: item.ns,
							title: item.title
						},
						user: {
							name: user,
							ip: ws.util.isIPAddress(user),
							temp: ws.util.isTempAccount(user),
							anon: ws.util.isIPAddress(user) || ws.util.isTempAccount(user),

							edits: Math.max(data.user.edits, data.user.contributions?.length || 0),
							contributions: data.user.contributions,

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							blocked: data.user.blocked,
							blocks: data.user.blocks,

							get talk() {
								return ws.queue.talks.get(user) ?? data.user.talk;
							},

							profanity: profanity.evaluate(user)
						},
						performer: {
							name: item.user,
							ip: ws.util.isIPAddress(item.user),
							temp: ws.util.isTempAccount(item.user),
							anon: ws.util.isIPAddress(item.user) || ws.util.isTempAccount(item.user),

							edits: Math.max(performer.user.edits, performer.user.contributions?.length || 0),
							contributions: performer.user.contributions,

							warning: this.getWarningLevel(performer.user.talk || ""),
							warnings: this.getWarningHistory(performer.user.talk || ""),

							blocked: performer.user.blocked,
							blocks: performer.user.blocks,

							get talk() {
								return ws.queue.talks.get(item.user) ?? performer.user.talk;
							}
						},
						mentions: {
							has: Object.values(mentions).some(v => v),
							...mentions
						},
						AI: { // will be populated asynchronously
							username: null
						},

						id: item.logid,

						timestamp: item.timestamp,
						comment: item.comment,

						propagating: false,
						reviewed: false,
						history: false,

						group: Queue.groups[type],
						type: type,

						simple: simple,
						origin: item,
					};
					if (!simple && ws.AI) {
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
					if (username) {
						if (item.comment)
							mentions.comment = ws.util.match(username, item.comment);
						if (data.edit.diff) {
							const $temp = document.createElement("div");
							$temp.innerHTML = data.edit.diff;
							if ($temp.textContent)
								mentions.diff = ws.util.match(username, $temp.textContent);
						}
					}

					this.watchlist.set(item.title, data.page.watched);

					const levels = [ "0", "1", "2", "3", "4", "4im" ];
					const warning = this.getWarningLevel(data.user.talk || "");
                	if (levels.indexOf(warning) > levels.indexOf(this.warnings.get(item.user) || "0"))
                    	this.warnings.set(item.user, warning);

					const object = {
						display: {
							get title() {
								const $title = document.createElement("div");
								$title.className = "page-title";
								$title.classList.toggle("queue-highlight", ws.store.highlight.pages.has(item.title));

								const $icon = document.createElement("span");
								$icon.className = "fa fa-file-alt queue-item-icon";
								$title.appendChild($icon);

								const $text = document.createElement("a");
								$text.href = ws.util.pageLink(item.title);
								$text.dataset.tooltip = item.title;
								$text.dataset.multipleHrefs = `page-abuse;title=${encodeURIComponent(item.title)}&id=${item.id}`;
								$text.textContent = ws.util.truncate(item.title, 50);
								$title.appendChild($text);

								return $title.outerHTML;
							},
							get username() {
								const $user = document.createElement("div");
								$user.className = "username";
								$user.classList.toggle("queue-highlight", ws.store.highlight.users.has(item.user));
								$user.classList.toggle("queue-user-empty-talk", data.user.talk === undefined);

								const $icon = document.createElement("span");
								$icon.className = "fa fa-user queue-user-icon";
								$user.appendChild($icon);

								const $text = document.createElement("a");
								$text.classList.toggle("user-blocked", data.user.blocked);
								$text.href = ws.util.pageLink(`User:${item.user}`);
								$text.dataset.tooltip = item.user;
								$text.dataset.multipleHrefs = `user;name=${encodeURIComponent(item.user)}`;
								$text.textContent = ws.util.truncate(item.user, 30);
								$user.appendChild($text);

								return $user.outerHTML;
							},
							get filters() {
								const $filters = document.createElement("div");
								$filters.className = "tags";

								const filters = item.entries.map(entry => ({ id: entry?.filter_id || "-1", filter: entry?.filter }));
								filters.sort((a, b) => +a.id - +b.id);
								filters.forEach(filter => {
									const $filter = document.createElement("span");
									$filter.className = "tag";
									$filter.dataset.tooltip = filter.filter;
									$filter.textContent = ws.util.truncate(filter.id, 10);
									$filters.appendChild($filter);
								});

								return $filters.outerHTML;
							}
						},
						page: {
							namespace: item.ns,
							title: item.title,

							history: data.page.history,
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
							contributions: data.user.contributions,

							warning: this.getWarningLevel(data.user.talk || ""),
							warnings: this.getWarningHistory(data.user.talk || ""),

							blocked: data.user.blocked,
							blocks: data.user.blocks,

							get talk() {
								return ws.queue.talks.get(item.user) ?? data.user.talk;
							}
						},
						mentions: {
							has: Object.values(mentions).some(v => v),
							...mentions
						},
						AI: { // will be populated asynchronously
							edit: null,
							username: null
						},

						id: item.id,
						revid: item.revid,

						timestamp: item.timestamp,
						comment: item.comment,
						minor: false,

						diff: data.edit.diff,
						sizediff: item.diff?.size,

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
					if (!simple && ws.AI) {
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

		return result;
	}

	next() {
		if (this.current.queue.length === 0)
			return;

		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (i === -1) {
			this.current.item = this.current.queue[0];
			return this.ws.gui.renderQueue();
		}

		if (this.current.type === "pending") {
			this.current.item = this.current.queue[Math.min(i + 1, this.current.queue.length - 1)];
			return this.ws.gui.renderQueue();
		}

		const leaving = this.current.item;
		const group = Queue.groups[leaving.type];
		if (!leaving.reviewed && (group === "edit" || (group === "abuselog" && leaving.revid))) {
			const id = leaving.type === "abuselog" ? leaving.revid : leaving.id;
			[ "recent", "watchlist", "abuselog" ].filter(t => t !== leaving.type).forEach(t => {
				if (t === "abuselog")
					this.queues[t].queue = this.queues[t].queue.filter(item => item.revid !== id);
				else
					this.queues[t].queue = this.queues[t].queue.filter(item => item.id !== id);
			});

			if (group !== "abuselog") {
				let toRemove = this.queues.abuselog.queue.filter(item => {
					return leaving.user.name === item.user.name &&
						   leaving.page.title === item.page.title &&
						   Math.abs(new Date(leaving.timestamp).getTime() - new Date(item.timestamp).getTime()) < 10 * 1000 // 10 seconds
				});

				if (toRemove.length > 0) { // TODO, if we are going to fetch the revid here why not use it if it shouldn't be removed
					Promise.allSettled(toRemove.map(async item => {
						const revid = await this.ws.api.getAbuseLogRevid(item.id);
						if (revid)
							return { id: item.id, revid };
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
		this.ws.gui.renderQueue();
	}

	previous() {
		const i = this.current.queue.findIndex(item => item.id === this.current.item?.id);
		if (this.current.type === "pending") {
			this.current.item = this.current.queue[Math.max(i - 1, 0)];
			return this.ws.gui.renderQueue();
		}

		if (i <= 0) {
			if (this.current.history.length === 0)
				return;

			this.current.queue.unshift(this.current.history.pop());
			this.current.item = this.current.queue[0];

			return this.ws.gui.renderQueue();
		}

		this.current.item = this.current.queue[i - 1];

		this.ws.gui.renderQueue();
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
		else if (!item.user.anon)
			return;
		else if ((item.user.edits || 0) === 0) // don't welcome users with 0 edits
			return;
		else if (item.user.talk === undefined)
			return;
		else if (this.noWelcome.has(item.user.name))
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
					<span style="font-size: 0.9em; color: #888;">Editing: <strong>${this.ws.util.escape(item.page.title)}</strong></span>`,
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
		this.#uaaQueue = this.#uaaQueue.then(() => this.#promptUAAInternal(item, analysis)).catch(() => {});
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
			Object.assign(item, loaded);

			resolve();
			item.propagating = false;
		} else
			this.generate(item.type, [ item.origin ], false, { bypass }).then(([ loaded ]) => {
				Object.assign(item, loaded);
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
						comment: simple.comment,
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
						comment: rev.comment,
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
				const templates = section.content.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/g);
				if (templates === null)
					break;

				const filtered = [ ...templates.map(t => {
					const match = t.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/);
					return match ? match[1].toString() : "0";
				}), highestLevel ].map(level => [ level, levels.indexOf(level) ]);

				highestLevel = filtered.sort((a, b) => b[1] - a[1])[0][0];
			}

		return highestLevel;
	}

	getWarningHistory(text) {
		const warnings = [];

		const month = this.ws.util.monthSectionName();
		const sections = this.ws.util.getPageSections(text);
		for (const section of sections)
			if (section.title === month) {
				const templateMatches = section.content.matchAll(/<\!-- Template:([\w-]+?)(\d(?:i?m)?) -->(.+?)(?=<\!-- Template:|$)/gs);
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