import { Memory } from "../utils/memory.js";

const serversWithTags = new Set([ "en.wikipedia.org" ]);
const serversWithPendingChanges = new Set([ "en.wikipedia.org", "de.wikipedia.org" ]);

const cache = {
    parse: new Memory({ size: 1000 }),
    pending: new Memory({ timeout: 60 * 60 * 1000, size: 1000 }),
    ores: new Memory({ timeout: 15 * 60 * 1000, size: 1000 }),
    diff: new Memory({ timeout: 5 * 60 * 1000, size: 500 }),
};

export class API {
    static account() {
        return window.electronAPI.getActiveAccount();
    }
    static chunk(array, size = 50) {
        const chunks = [];

        const len = array.length;
        for (let i = 0; i < len; i += size) {
            chunks.push(array.slice(i, i + size));
        }

        return chunks;
    }
    static paramify(param) {
        if (!Array.isArray(param))
            param = [ param ];

        return [ ...new Set(param) ];
    }

    #ws = null;

    #server = null;
    #account = null;
    #bot = null;

    #tags = "";

    #loggedIn = false;

    #tokens = { };

    get bot() {
        return this.#bot;
    }
    get username() {
        return this.#account;
    }
    get hasPendingChanges() {
        return serversWithPendingChanges.has(this.#server);
    }

    constructor(ws, server) {
        this.#ws = ws;

        this.#server = server;
        if (serversWithTags.has(server))
            this.#tags = "WikiShield script";
    }

    login() {
        if (this.#loggedIn === true) {
            return Promise.resolve();
        } else if (this.#loggedIn instanceof Promise) {
            return this.#loggedIn;
        }

        async function exec() {
            const { username, password } = await API.account();

            try {
                // Get login token
                const tokenResponse = await fetch(`https://${this.#server}/w/api.php`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        action: "query",
                        meta: "tokens",
                        type: "login",
                        format: "json"
                    }).toString()
                });

                const tokenData = await tokenResponse.json();
                const token = tokenData.query.tokens.logintoken;

                // Attempt login
                const loginResponse = await fetch(`https://${this.#server}/w/api.php`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams({
                        action: "login",
                        lgname: username,
                        lgpassword: password,
                        lgtoken: token,
                        format: "json"
                    }).toString()
                });

                const loginData = await loginResponse.json();

                if (loginData.login?.result === "Success") {
                    this.#bot = username;
                    this.#account = loginData.login.lgusername;
                    return;
                } else
                    throw new Error(loginData.login?.reason || "Unknown error occurred");
            } catch (error) {
                console.error("Login error:", error);
                throw error;
            }
        }

        this.#loggedIn = exec.call(this);
        this.#loggedIn
            .then(() => {
                this.#loggedIn = true;
            })
            .catch(() => {
                this.#loggedIn = false;
            });

        return this.#loggedIn;
    }

    build(opts = { }) {
        return {
            "tags": this.#tags,
            "assertuser": this.#account,
			"discussiontoolsautosubscribe": "no",

            ...opts,
        };
    }

    async account() {
        try {
            const response = await fetch(`https://${this.#server}/w/api.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams(this.build({
                    action: "query",
                    meta: "userinfo",
                    uiprop: "*",
                    format: "json",
                    formatversion: 2
                })).toString()
            });
            const data = await response.json();
            return data?.query?.userinfo || { };
        } catch (error) {
            if (error === "assertnameduserfailed")
                return this.#ws.disable("Invalid account", "Your account was logged out or changed.");

            console.error("User info error:", error);
            return { };
        }
    }

    summary(base, custom) {
        const watermark = " ([[:en:WP:WikiShield|WS]])";
        const message = `${base}${custom ? `: ${custom}` : ""}`;
        return `${this.#ws.util.truncate(message, 500 - watermark.length)}${watermark}`; // always get the watermark in 🙈
    }
    user(username) {
        return `[[Special:Contribs/${username}|${username}]] ([[User talk:${username}|talk]])`;
    }

    async post(params) {
        await this.login();

        try {
            return await fetch(`https://${this.#server}/w/api.php`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams(this.build({
                    ...params,
                    format: "json",
                    formatversion: 2,
                })).toString()
            }).then(response => response.json());
        } catch (error) {
            if (error === "assertnameduserfailed")
                return this.#ws.disable("Invalid account", "Your account was logged out or changed.");

            console.error("Get error:", error);
            throw error;
        }
    }
    async continuous(params, cancel) {
        await this.login();

        try {
            let continueObject = null;
            const responses = [ ];
            do {
                const data = await this.post({ ...params, ...(continueObject || {}) });
                responses.push(data);

                continueObject = data.continue || null;
                if (typeof cancel === "function")
                    if (await cancel(data, responses) === true) {
                        continueObject = true;
                        break;
                    }
            } while (continueObject);

            return { stopped: continueObject !== null, responses: responses };
        } catch (error) {
            console.error("Continuous error:", error);
            return { stopped: true, responses: [ ] };
        }
    }

    async getToken(type = "csrf") {
        await this.login();

        if (this.#tokens[type] === undefined)
            try {
                this.#tokens[type] = fetch(`https://${this.#server}/w/api.php`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: new URLSearchParams(this.build({
                        action: "query",
                        meta: "tokens",
                        type: type,
                        format: "json"
                    })).toString()
                })
                    .then(response => response.json())
                    .then(data => {
                        const token = data.query.tokens[`${type}token`];
                        return token;
                    });

                return this.#tokens[type];
            } catch (error) {
                if (error === "assertnameduserfailed")
                    return this.#ws.disable("Invalid account", "Your account was logged out or changed.");

                console.error("Get token error:", error);
                window.electronAPI.errorbox(`Could not get ${type} token`, error);
                throw error;
            }
        else
            return this.#tokens[type];
    }

    async postWithToken(params, type = "csrf") {
        await this.login();

        try {
            const token = await this.getToken(type);
            return await this.post({ ...params, token: token });
        } catch (error) {
            console.error("Post with token error:", error);
            throw error;
        }
    }

    async append(title, section, content, summary, check) {
        try {
            if (typeof check === "function") {
                const text = (await this.getPagesContent([ title ]))[title] || "";
                const validity = await check(text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "Append check failed." };
            }

            await this.postWithToken({
                action: "edit",
                title: title,
                ...((section ?? null) === null ? {} : { section }),
                appendtext: `\n${content}`,
                summary: summary,
            });

            return { valid: true };
        } catch (error) {
            console.error("Append error:", error);
            return { valid: false, reason: error.message };
        }
    }
    async editSection(title, index, section, content, summary, check) {
        try {
            if (typeof check === "function") {
                const text = (await this.getPagesContent([ title ]))[title] || "";
                const validity = await check(text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "New section check failed." };
            }

            await this.postWithToken({
                action: "edit",
                title: title,
                section: index,
                sectiontitle: section,
                text: content,
                summary: summary,
            });

            return { valid: true };
        } catch (error) {
            console.error("New section error:", error);
            return { valid: false, reason: error.message };
        }
    }

    async acceptPendingEdit(item, summary) {
        try {
            await this.postWithToken({
                action: "review",
                revid: item.pending.revid,
                comment: summary,
            });

            return { valid: true };
        } catch (error) {
            console.error("Accept pending edit error:", error);
            return { valid: false, reason: error.message };
        }
    }
    async rejectPendingEdit(item, summary) {
        try {
            const stable = (await this.getRevisionContent([ item.pending.stable_revid ]))[item.pending.stable_revid] || "";
            await this.postWithToken({
                action: "edit",
                title: item.page.title,
                text: stable,
                summary: summary,
                baserevid: item.id,
            });

            return { valid: true };
        } catch (error) {
            console.error("Reject pending edit error:", error);
            return { valid: false, reason: error.message };
        }
    }

    async rollbackEdit(title, user, summary) {
        try {
            const result = await this.postWithToken({
                action: "rollback",
                title: title,
                user: user,
                summary: summary,
            }, "rollback");

            if (!result?.rollback?.revid)
                return { valid: false, reason: "Edit conflict." };

            const data = await this.getRevision(title, result.rollback.revid);
            if (data.user !== this.#account)
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (error) {
            console.error("Rollback edit error:", error);
            return { valid: false, reason: error.message };
        }
    }
    async undoEdit(title, revid, summary) {
        try {
            const result = await this.postWithToken({
                action: "edit",
                title: title,
                undo: revid,
                summary: summary,
            });

            if (!result?.edit?.newrevid)
                return { valid: false, reason: "Edit conflict." };

            const data = await this.getRevision(title, result.edit.newrevid);
            if (data.user !== this.#account)
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (error) {
            console.error("Rollback edit error:", error);
            return { valid: false, reason: error.message };
        }
    }

    async thankRevision(revid) {
        try {
            await this.postWithToken({
                action: "thank",
                rev: revid,
            });

            return { valid: true };
        } catch (error) {
            console.error("Thank revision error:", error);
            return { valid: false, reason: error.message };
        }
    }

    async parse(wikitext) {
        try {
            if (cache.parse.has(wikitext))
                return cache.parse.get(wikitext);

            const text = (await this.post({
                action: "parse",
                prop: "text",
                text: wikitext
            }))?.parse?.text || "";

            cache.parse.set(wikitext, text);
            return text;
        } catch (error) {
            console.error("Parse error:", error);
            return "";
        }
    }

    async getPagesContent(titles) {
        titles = API.paramify(titles);
        try {
            const promises = await Promise.allSettled(API.chunk(titles, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "content",
                    rvslots: "*",
                    titles: chunk.join("|"),
                });
            }));

            const pages = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.query?.pages || [])
                    pages[page.title] = page.revisions?.[0].slots?.main?.content || "";
            }

            return pages;
        } catch (error) {
			console.error(`Could not fetch page ${titles}: ${error}`);
            return { };
        }
    }
    async getRevisionContent(revids) {
        revids = API.paramify(revids);

        try {
            const promises = await Promise.allSettled(API.chunk(revids, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "ids|content",
                    rvslots: "*",
                    revids: chunk.join("|"),
                });
            }));

            const revisions = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.query?.pages || [])
                    for (const rev of page.revisions || [])
                        revisions[rev.revid] = rev.slots?.main?.content || "";
            }
            return revisions;
        } catch (error) {
            console.error(`Could not fetch revisions ${revids}: ${error}`);
            return { };
        }
    }

    async getLatestIDs(titles) {
        titles = API.paramify(titles);
        try {
            const promises = await Promise.allSettled(API.chunk(titles, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "ids",
                    titles: chunk.join("|"),
                });
            }));

            const pages = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.query?.pages || [])
                    pages[page.title] = page.revisions?.[0].revid;
            }

            return pages;
        } catch (error) {
            console.error(`Could not fetch latest IDs for ${titles}: ${error}`);
            return { };
        }
    }

    async getEditCounts(usernames) {
        usernames = API.paramify(usernames);
        try {
            const promises = await Promise.allSettled(API.chunk(usernames, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    list: "users",
                    ususers: chunk.join("|"),
                    usprop: "editcount",
                });
            }));

            const users = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const user of result.value.query?.users || [])
                    users[user.name] = user.name === "LuniXunie" ? 0 : user.editcount;
            }

            return users;
        } catch (error) {
            console.error(`Could not fetch edit counts for ${usernames}: ${error}`);
            return { };
        }
    }

    async areUsersBlocked(usernames) {
        usernames = API.paramify(usernames);
        try {
            const promises = await Promise.allSettled(API.chunk(usernames, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    list: "blocks",
                    bkusers: chunk.join("|"),
                    bkprop: "id|user|by|timestamp|expiry|reason",
                    bklimit: "max",
                });
            }));

            const blocked = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const block of result.value.query?.blocks || [])
                    blocked[block.user] = block;
            }

            return blocked;
        } catch (error) {
            console.error(`Could not fetch blocked status for ${usernames}: ${error}`);
            return { };
        }
    }

    async getContributions(username, limit = 10) {
        try {
            return (await this.post({
                action: "query",
                list: "usercontribs",
                ucuser: username,
                uclimit: limit,
                ucprop: "ids|title|timestamp|comment|flags|tags|sizediff|flags",
            })).query?.usercontribs || [ ];
        } catch (error) {
            console.error(`Could not fetch contributions for ${username}: ${error}`);
            return [ ];
        }
    }

    async getBlocks(username) {
        try {
            return (await this.continuous({
                action: "query",
                list: "logevents",
                letype: "block",
                letitle: `User:${username}`,
                leaction: "block/block",
                lelimit: "max",
                leprop: "id|timestamp|details|user|comment",
            })).responses.flatMap(response => response.query?.logevents || [ ]);
        } catch (error) {
            console.error(`Could not fetch blocks for ${username}: ${error}`);
            return [ ];
        }
    }

    async pagesExist(titles) {
        titles = API.paramify(titles);
        try {
            const promises = await Promise.allSettled(API.chunk(titles, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "content",
                    rvslots: "*",
                    titles: chunk.join("|"),
                });
            }));

            const pages = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.query?.pages || [])
                    pages[page.title] = page.missing ? undefined : page.revisions?.[0].slots?.main?.content;
            }

            return pages;
        } catch (error) {
            console.error("Pages exist error:", error);
            return { };
        }
    }

    async getPagesDetails(titles) {
        titles = API.paramify(titles);
        try {
            const promises = await Promise.allSettled(API.chunk(titles, 500).map(async chunk => {
                return await this.continuous({
                    action: "query",
                    prop: "info|categories|templates",
                    inprop: "protection|watched",
                    titles: chunk.join("|"),

                    cllimit: "max",

                    tllimit: "max",
                    tlnamespace: 10,
                });
            }));

            const pages = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.responses.flatMap(response => response.query?.pages || [])) {
                    pages[page.title] ??= { protection: null, watched: false, categories: [ ], metadata: [ ] };

                    let highest = pages[page.title]?.protection?.level || null;
                    for (const prot of page.protection || []) {
                        if (prot.type !== "edit")
                            continue;

                        if (prot.level === "sysop" || highest === "sysop")
                            highest = "sysop";
                        else if (prot.level === "autoconfirmed" || highest === "autoconfirmed")
                            highest = "autoconfirmed";
                        else if (prot.level === "extendedconfirmed" || highest === "extendedconfirmed")
                            highest = "extendedconfirmed";
                    }

                    const metadata = [ ];
                    for (const template of page.templates || []) {
                        const title = template.title.replace(/^Template:/i, "");
                        if (title.match(/^use\s/i))
                            metadata.push(title);
                    }

                    pages[page.title] = {
                        protection: highest === null ? { protected: false } : { protected: true, level: highest },
                        watched: page.watched === true || pages[page.title].watched,
                        categories: pages[page.title].categories.concat(page.categories?.map(cat => cat.title) || [ ]),
                        metadata: pages[page.title].metadata.concat(metadata),
                    };
                }
            }

            return pages;
        } catch (error) {
            console.error("Get pages details error:", error);
            return { };
        }
    }

    async countPageReverts(title, username) {
        const check = tag => tag === "mw-undo" || tag === "mw-rollback" || tag === "mw-manual-revert";

        try {
            const data = await this.continuous({
                action: "query",
                prop: "revisions",
                titles: title,
                rvstart: this.#ws.util.utcString(new Date(Date.now() - 8.64e+7)), // 1 day ago
                rvdir: "newer",
                rvuser: username,
                rvprop: "tags",
                rvlimit: "max",
            });

            let count = 0;
            for (const response of data.responses)
                count += response.query?.pages?.[0].revisions?.filter(rev => rev.tags.some(check)).length || 0;

            return count;
        } catch (error) {
            console.error(`Could not count reverts for ${title}: ${error}`);
            return 0;
        }
    }

    async getHistory(title, limit = 10) {
        try {
            const page = (await this.post({
                action: "query",
                prop: "revisions",
                rvprop: "ids|user|timestamp|comment|flags|tags|size|flags",
                rvlimit: limit + 1, // +1 to get size diffs
                titles: title,
            })).query?.pages?.[0] || { revisions: [] };

            const count = Math.min(limit, page.revisions.length);
            for (let i = 0; i < count; i++) {
                const rev = page.revisions[i];

                rev.ns = page.ns;
                rev.pageid = page.pageid;
                rev.title = page.title;

                if (i + 1 < page.revisions.length)
                    rev.sizediff = rev.size - page.revisions[i + 1].size;
                else
                    rev.sizediff = rev.size;
            }

            return page.revisions.slice(0, count);
        } catch (error) {
            console.error(`Could not fetch history for ${title}: ${error}`);
            return [ ];
        }
    }

    async getORES(revids, models = [ "damaging:true", "goodfaith:false" ]) {
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        revids = API.paramify(revids);

        const result = { };
        try {
            const toFetch = [ ];
            for (const revid of revids) {
                if (cache.ores.has(revid))
                    result[revid] = cache.ores.get(revid);
                else
                    toFetch.push(revid);
            }
            if (toFetch.length === 0)
                return result;

            const promises = await Promise.allSettled(API.chunk(toFetch, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "oresscores|ids",
                    rvslots: "*",
                    revids: chunk.join("|"),
                });
            }));

            const set = new Set(toFetch);
            const scores = { };
            for (const chunk of promises) {
                if (chunk.status !== "fulfilled")
                    continue;
                for (const page of chunk.value.query?.pages || [])
                    for (const rev of page?.revisions || [])
                        if (set.has(rev.revid))
                            scores[rev.revid] = rev.oresscores || { };
            }

            set.forEach(revid => {
                const data = scores[revid] || { };

                const values = [ ];
                for (const model of models) {
                    const [ name, field ] = model.split(":");
                    const score = data[name]?.[field];
                    if (score !== undefined)
                        values.push(score);
                }

                const score = values.length === 0 ? NaN : mean(values);
                if (!isNaN(score))
                    cache.ores.set(revid, score);

                result[revid] = score;
            });

            return result;
        } catch (error) {
            console.error("Get ORES error:", error);
            return { };
        }
    }
    async getDiff(from, to, format = "table") {
        from ??= false;

        const cacheKey = `${format}@${from}-${to}`;
        if (cache.diff.has(cacheKey))
            return cache.diff.get(cacheKey);

        try {
            const params = {
                action: "compare",
                prop: "diff",
                difftype: format,
                torev: to
            };
            if (from === false) {
                params.fromslots = "main";
                params["fromtext-main"] = "";
            } else
                params.fromrev = from;

            const data = await this.post(params);

            const diff = data.compare?.body || "";
            cache.diff.set(cacheKey, diff);
            return diff;
        } catch (error) {
            console.error("Get diff error:", error);
            return "";
        }
    }

    async getRevision(title, revid) {
        try {
            const data = await this.post({
                action: "query",
                prop: "revisions",
                rvprop: "ids|user|comment|timestamp|size|tags|flags",
                rvslots: "*",
                rvstartid: revid,
                rvlimit: 2,
                titles: title,
            });

            const page = data.query?.pages?.[0];
            if (!page || !page.revisions || page.revisions.length === 0)
                return { };

            const rev = page.revisions[0];
            return {
                revid: rev.revid,
                parentid: rev.parentid,

                user: rev.user,

                timestamp: rev.timestamp,
                comment: rev.comment || "",
                tags: rev.tags || [],

                size: rev.size,
                oldlen: page.revisions[1]?.size || 0,

                minor: rev.minor || false,
            }
        } catch (error) {
            console.error(`Could not fetch revision ${revid}: ${error}`);
            return { };
        }
    }

    async queue(type, ns, since, full) {
        const ws = this.#ws;
        const options = {
            get recent() {
                return {
                    action: "query",
                    list: "recentchanges",
                    rcnamespace: ns,
                    rclimit: "max",
                    rcprop: "title|ids|sizes|flags|user|timestamp|comment|tags",
                    rctype: "edit",
                    rctoponly: true,
                    rcstart: since || "",
                    rcdir: since ? "newer" : "older",
                };
            },
            get pending() {
                return {
                    action: "query",
                    list: "oldreviewedpages",
                    orppnamespace: ns,
                    orpplimit: "max",
                    orstart: since || "",
                    ordir: since ? "newer" : "older",
                };
            },
            get users() {
                return {
                    action: "query",
                    list: "logevents",
                    letype: "newusers",
                    lelimit: "max",
                    lestart: since || "",
                    ledir: since ? "newer" : "older",
                };
            },
            get watchlist() {
                return {
                    action: "query",
                    list: "watchlist",
                    wlnamespace: ns,
                    wllimit: "max",
                    wlprop: "title|ids|sizes|flags|user|timestamp|comment|tags",
                    wltype: "edit",
                    wlstart: since || "",
                    wldir: since ? "newer" : "older",
                    wlexcludeuser: ws.api.username,
                };
            }
        };

        if (type === "pending" && !this.hasPendingChanges)
            return [ ];

        try {
            const data = await this.continuous(options[type]);

            switch (type) {
                case "recent": {
                    return data.responses.flatMap(response => response.query?.recentchanges || [ ]);
                } break;
                case "pending": {
                    const localCache = {
                        stability: new Map(),
                    };

                    const promises = await Promise.allSettled(data.responses.flatMap(response => response.query?.oldreviewedpages || [ ]).map(async obj => {
                        if (!cache.pending.has(obj.revid))
                            cache.pending.set(obj.revid, await this.post({
                                action: "query",
                                prop: "revisions",
                                titles: obj.title,
                                rvstartid: obj.revid,
                                rvlimit: 1,
                                rvprop: "ids|flags|user|timestamp|comment|size|tags",
                            }));
                        const rev = cache.pending.get(obj.revid);

                        if (!localCache.stability.has(obj.title))
                            localCache.stability.set(obj.title, this.post({
                                action: "query",
                                list: "logevents",
                                letype: "stable",
                                letitle: obj.title,
                                lelimit: 1,
                            }));
                        obj.stability = (await localCache.stability.get(obj.title))?.query?.logevents?.[0] || { };

                        const page = rev.query?.pages?.[0];
                        return {
                            title: obj.title,
                            sizediff: obj.diff_size,
                            ...page.revisions?.[0],
                            pending: obj,
                        };
                    }));

                    const list = promises.filter(p => p.status === "fulfilled").map(p => p.value);
                    if (full === false)
                        return list;

                    const temp = { };
                    await Promise.allSettled(list.map(async item => {
                        const between = await this.getRevisionsBetween(item.title, item.pending.stable_revid, item.revid);
                        if (between.length < 2)
                            return;

                        const stable = between.pop();
                        temp[item.title] = {
                            count: between.length,
                            users: between.reduce((acc, rev) => {
                                if (rev.user in acc)
                                    acc[rev.user]++;
                                else
                                    acc[rev.user] = 1;

                                return acc;
                            }, { }),

                            revid: item.revid,
                            prior: stable.revid,

                            sizediff: item.size - stable.size,

                            timestamp: {
                                new: item.timestamp,
                                old: between[between.length - 1].timestamp,
                            }
                        };
                    }));

                    return temp;
                } break;
                case "users": {
                    return data.responses.flatMap(response => response.query?.logevents || [ ]);
                } break;
                case "watchlist": {
                    return data.responses.flatMap(response => response.query?.watchlist || [ ]);
                } break;
            }
        } catch (error) {
            console.error(`Queue (${type}) error:`, error);
            return [ ];
        }
    }

    async getRevisionsBetween(title, from, to) {
        try {
            const data = await this.continuous({
                action: "query",
                prop: "revisions",
                titles: title,
                rvstartid: to,
                rvendid: from,
                rvlimit: "max",
                rvprop: "title|ids|flags|user|timestamp|comment|size|tags",
            });
            return data.responses.flatMap(response => response.query?.pages?.[0]?.revisions || [ ]);
        } catch (error) {
            console.error("Get revisions between error:", error);
            return [ ];
        }
    }

    async parseUsers(usernames, simple) {
        usernames = API.paramify(usernames);

        const result = Array.from({ length: usernames.length }, () => ({ user: { } }));
        try {
            const promises = [ ];

            promises.push(
                this.getEditCounts(usernames).then(data => {
                    usernames.forEach((name, i) => result[i].user.edits = data[name] || 0);
                }),
                this.areUsersBlocked(usernames).then(data => {
                    usernames.forEach((name, i) => result[i].user.blocked = data[name] || null);
                }),
                this.pagesExist(usernames.map(name => `User talk:${name}`)).then(data => {
                    usernames.forEach((name, i) => result[i].user.talk = data[`User talk:${name}`]);
                })
            )

            if (!simple)
                promises.push(
                    (async () => {
                        await Promise.all(usernames.map(async (name, i) => {
                            [ result[i].user.contributions, result[i].user.blocks ] = await Promise.all([
                                this.getContributions(name),
                                this.getBlocks(name),
                            ]);
                        }));
                    })()
                );

            await Promise.all(promises);

            return result;
        } catch (error) {
            console.error("Parse user error:", error);
            return result;
        }
    }
    async parseEdits(items, simple) {
        items = API.paramify(items);

        const users = API.paramify(items.map(item => item.item.user));
        const revids = API.paramify(items.map(item => item.item.revid));
        const titles = API.paramify(items.map(item => item.item.title));

        const result = items.map(({ item, prior }) => ({
            item,
            prior,
            data: { user: { }, page: { }, edit: { } }
        }))
        try {
            const promises = [ ];
            promises.push(
                this.parseUsers(users, simple).then(data => {
                    items.forEach((item, i) => {
                        const userIndex = users.indexOf(item.item.user);
                        result[i].data.user = data[userIndex].user;
                    });
                }),
                this.getPagesDetails(titles).then(data => {
                    items.forEach((item, i) => {
                        result[i].data.page.protection = data[item.item.title]?.protection || { protected: false };
                        result[i].data.page.watched = data[item.item.title]?.watched || false;
                        result[i].data.page.categories = data[item.item.title]?.categories || [ ];
                        result[i].data.page.metadata = data[item.item.title]?.metadata || [ ];
                    });
                }),
                this.getORES(revids).then(data => {
                    items.forEach((item, i) => {
                        result[i].data.edit.ores = data[item.item.revid] || 0;
                    });
                })
            );

            if (!simple)
                promises.push(
                    (async () => {
                        await Promise.all(items.map(async (item, i) => {
                            [
                                result[i].data.page.reverts,
                                result[i].data.page.history,
                                result[i].data.edit.diff
                            ] = await Promise.all([
                                this.countPageReverts(item.item.title, this.#account),
                                this.getHistory(item.item.title, 10),
                                this.getDiff(item.prior, item.item.revid, "table"),
                            ]);
                        }));
                    })(),
                );

            await Promise.all(promises);

            return result;
        } catch (error) {
            console.error("Parse edits error:", error);
            return result;
        }
    }

    async getConsecutiveEdits(page, revid, username) {
        try {
            const data = await this.continuous({
                action: "query",
                prop: "revisions",
                titles: page,
                rvprop: "ids|timestamp|user|size",
                rvlimit: "max",
                rvstartid: revid,
            }, data => {
                return data.query?.pages?.[0]?.revisions.some(rev => rev.user !== username);
            });

            const revisions = data.responses.flatMap(response => response.query?.pages?.[0]?.revisions || [ ]);

            let last, prior;
            const first = revisions[0];
            if (first?.user !== username)
                return { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null };

            const result = { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null };

            const len = revisions.length;
            for (let i = 0; i < len; i++) {
                const rev = revisions[i];
                prior = rev;

                if (rev.user !== username)
                    break;

                last = rev;
                result.count++;
                if (i + 1 < len)
                    result.sizediff += (rev.size - revisions[i + 1].size) || 0;
                else
                    result.sizediff += rev.size || 0;
            }

            result.timestamp.new = first?.timestamp || null;
            result.timestamp.old = last?.timestamp || null;

            if (data.stopped)
                result.diff = await this.getDiff(prior?.revid || null, first.revid, "table");
            else
                result.diff = await this.getDiff(null, first.revid, "table"); // all edits are by the user

            return result;
        } catch (error) {
            console.error("Get consecutive edits error:", error);
            return { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null };
        }
    }
}