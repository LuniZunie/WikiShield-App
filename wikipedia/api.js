const Logger = require("electron-log");

const { convertToUTCString } = require("../global/utc-string/script.com.js");
const { truncate } = require("../global/truncate/script.com.js");
const { Memory } = require("../global/memory/script.com.js");
const { Trie } = require("../global/trie/script.com.js");
const { ORES } = require("./ores.js");

const __servers__ = require("../servers.js");

const __tags__ = new Set(__servers__.filter(s => s.tag).map(s => s.host));
const __pendingChanges__ = new Set(__servers__.filter(s => s.pending_changes).map(s => s.host));

module.exports.MediaWikiAPI = class MediaWikiAPI {
    static cache = { };

    static get pendingChangesServers() {
        return Array.from(__pendingChanges__);
    }
    static hasPendingChanges(server) {
        return __pendingChanges__.has(server);
    }

    static chunk(array, size = 50) {
        const chunks = [ ];

        const len = array.length;
        for (let i = 0; i < len; i += size)
            chunks.push(array.slice(i, i + size));
        return chunks;
    }

    static paramify(param) {
        if (!Array.isArray(param))
            param = [ param ];
        return [ ...new Set(param) ];
    }
    static join(param) {
        return param.join("|").replace(/\|\|+/g, "|");
    }

    static getUsername(oauth, server) {
        return oauth.fetch(`https://${server}/w/api.php`, {
            action: "query",
            meta: "userinfo",
            uiprop: "name",
            format: "json",
            formatversion: 2
        }, undefined, "POST", true).then(data => data?.query?.userinfo?.name || null);
    }

    constructor(glob, oauth, server, username) {
        this.glob = glob;
        this.oauth = oauth;
        this.server = server;
        this.username = username;

        this.tokens = { };

        MediaWikiAPI.cache[server] ??= {
            parse: new Trie({ size: 1000 }),

            pending: new Memory({ size: 2500, timeout: 60 * 60 * 1000 }),
            abuse: new Memory({ size: 2500, timeout: 15 * 60 * 1000 }),

            ores: new Memory({ size: 10000, timeout: 15 * 60 * 1000 }),
            diff: new Memory({ size: 500, timeout: 5 * 60 * 1000 }),
        };
    }

    close() {
        this.stream.disconnect();
    }

    get cache() {
        return MediaWikiAPI.cache[this.server];
    }

    build(opts = { }, serverOverride = null) {
        return {
            "tags": __tags__.has(serverOverride ?? this.server) ? "WikiShield script" : "",
            "assertuser": this.username,
            "discussiontoolsautosubscribe": "no",
            ...opts
        };
    }

    user(username) {
        return `[[Special:Contribs/${username}|${username}]] ([[User talk:${username}|talk]])`;
    }
    revision(revid) {
        return `[[Special:Diff/${revid}|${revid}]]`;
    }
    centralAuthUser(username) {
        return `[[Special:CentralAuth/${username}|${username}]]`;
    }

    summary(base, custom) {
        const watermark = " ([[:en:WP:WikiShield|WS]])"; // tehehe
        const message = `${base}${custom ? `: ${custom}` : ""}`;
        return `${truncate(message, 500 - watermark.length)}${watermark}`;
    }

    async post(params, bypass = false, serverOverride = null) {
        try {
            const data = await this.oauth.fetch(`https://${serverOverride || this.server}/w/api.php`, this.build({ ...params, format: "json", formatversion: 2 }, serverOverride), undefined, "POST", bypass, serverOverride);
            if (data.error) {
                if (data.error.code === "alreadyrolled" || data.error.code === "editconflict")
                    return "editconflict";
                else if (data.error.code === "missingcontent" && params.action === "compare") // uh oh, it got revdel'd or oversighted
                    return { compare: { body: "" } };
                else
                    throw new Error(`API Error: ${data.error.code} - ${data.error.info}`);
            }
            return data;
        } catch (err) {
            Logger.error("Error in API POST request:", err, JSON.stringify(params));
            throw err;
        }
    }
    async continuous(params, cancel, bypass, serverOverride) {
        try {
            let cont = null;

            const responses = [ ];
            do {
                const data = await this.post({ ...params, ...(cont || { }) }, bypass, serverOverride);
                responses.push(data);

                cont = data.continue || null;
                if (typeof cancel === "function" && await cancel(data, responses) === true)
                    cont = false;
            } while (cont);

            return { stopped: cont !== null, responses: responses };
        } catch (err) {
            Logger.error("Error in API continuous request:", err, JSON.stringify(params));
            return { stopped: true, responses: [ ] };
        }
    }

    async getToken(type = "csrf", bypass, serverOverride) {
        const id = `${serverOverride ?? this.server}:${type}`;
        if (this.tokens[id] === undefined) {
            try {
                return this.tokens[id] = this.post({ action: "query", meta: "tokens", type: type }, bypass, serverOverride).then(data => data?.query?.tokens?.[`${type}token`] || null);
            } catch (err) {
                Logger.error("Error fetching token:", err);
                throw err;
            }
        } else
            return this.tokens[id];
    }
    async postWithToken(params, type = "csrf", bypass, serverOverride) {
        try {
            return await this.post({ ...params, token: await this.getToken(type, bypass, serverOverride) }, bypass, serverOverride);
        } catch (err) {
            Logger.error("Post with token error:", err);
            throw err;
        }
    }

    async account(bypass, serverOverride) {
        try {
            return (await this.post({ action: "query", meta: "userinfo", uiprop: "*" }, bypass, serverOverride))?.query?.userinfo || { };
        } catch (err) { return void(Logger.error("Error fetching account info:", err)) ?? { } };
    }
    async getGlobalUserInfo(username, bypass, serverOverride) {
        try {
            const response = await this.post({
                action: "query",
                meta: "globaluserinfo",
                guiuser: username,
                guiprop: "groups|rights"
            }, bypass, serverOverride);
            return response.query?.globaluserinfo || { };
        } catch (err) { return void(Logger.error("Error fetching global user info:", err)) ?? { }; }
    }

    async markWatchlistSeen(page, id, bypass, serverOverride) {
        try {
            await this.postWithToken({
                action: "setnotificationtimestamp",
                titles: page,
                newerthanrevid: id
            }, "csrf", bypass, serverOverride);
        } catch (err) { return void(Logger.error("Error marking watchlist item as seen:", err)) ?? { valid: false, reason: err.message }; }
    }

    async append(title, section, content, summary, check = null, bypass, serverOverride) {
        try {
            if (check !== null) {
                const text = (await this.getPagesContent([ title ], bypass, serverOverride))[title] || "";
                return { needsCheck: true, text };
            }

            const result = await this.postWithToken({ action: "edit", title, ...((section ?? null) === null ? { } : { section }), appendtext: `\n${content}`, summary }, "csrf", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return void(Logger.error("Error appending to section:", err)) ?? { valid: false, reason: err.message }; }
    }
    async editSection(title, index, section, content, summary, check = null, bypass, serverOverride) {
        try {
            if (check !== null) {
                const text = (await this.getPagesContent([ title ], bypass, serverOverride))[title] || "";
                return { needsCheck: true, text };
            }

            const result = await this.postWithToken({ action: "edit", title, section: index, sectiontitle: section, text: content, summary }, "csrf", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return void(Logger.error("Error editing section:", err)) ?? { valid: false, reason: err.message }; }
    }

    async acceptPendingEdit(id, summary, bypass, serverOverride) {
        try {
            await this.postWithToken({ action: "review", revid: id, comment: summary }, "csrf", bypass, serverOverride);
            return { valid: true };
        } catch (err) { return { valid: false, reason: "Edit could not be accepted." }; }
    }
    async rejectPendingEdit(id, prior, title, summary, bypass, serverOverride) {
        try {
            const stable = (await this.getRevisionsContent([ prior ], bypass, serverOverride))[prior] || "";
            const result = await this.postWithToken({ action: "edit", title: title, text: stable, summary, baserevid: id }, "csrf", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return { valid: false, reason: "Edit could not be rejected." }; }
    }

    async rollbackEdit(title, user, summary, bypass, serverOverride) {
        try {
            const result = await this.postWithToken({ action: "rollback", title, user, summary }, "rollback", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };
            else if (result === "onlyauthor")
                return { valid: false, reason: "Cannot rollback edits as the no other user has edited the page." };
            else if (!result.rollback?.revid)
                return { valid: false, reason: "Edit conflict." };

            const data = await this.getRevision(title, result.rollback.revid, bypass, serverOverride);
            if (data.user !== this.username)
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return void(Logger.error("Error rolling back edit:", err)) ?? { valid: false, reason: err.message }; }
    }
    async undoEdit(title, revid, summary, bypass, serverOverride) {
        try {
            const result = await this.postWithToken({ action: "edit", title, undo: revid, summary }, "csrf", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };
            else if (!result.edit?.newrevid)
                return { valid: false, reason: "Edit conflict." };

            const data = await this.getRevision(title, result.edit.newrevid, bypass, serverOverride);
            if (data.user !== this.username)
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return void(Logger.error("Error undoing edit:", err)) ?? { valid: false, reason: err.message }; }
    }
    async restoreEdit(title, revid, summary, bypass, serverOverride) {
        try {
            const start = convertToUTCString(new Date());

            const content = (await this.getRevisionsContent([ revid ], bypass, serverOverride))[revid] || "";
            const result = await this.postWithToken({ action: "edit", title, text: content, summary, starttimestamp: start }, "csrf", bypass, serverOverride);
            if (result === "editconflict")
                return { valid: false, reason: "Edit conflict." };
            else if (!result.edit?.newrevid)
                return { valid: false, reason: "Edit conflict." };

            const data = await this.getRevision(title, result.edit.newrevid, bypass, serverOverride);
            if (data.user !== this.username)
                return { valid: false, reason: "Edit conflict." };

            return { valid: true };
        } catch (err) { return void(Logger.error("Error restoring edit:", err)) ?? { valid: false, reason: err.message }; }
    }

    async thankRevision(revid, bypass, serverOverride) {
        try {
            await this.postWithToken({ action: "thank", rev: revid }, "csrf", bypass, serverOverride);
            return { valid: true };
        } catch (err) { return void(Logger.error("Error thanking revision:", err)) ?? { valid: false, reason: err.message }; }
    }

    async watchPage(title, expiry, bypass, serverOverride) {
        try {
            await this.postWithToken({ action: "watch", title, expiry }, "watch", bypass, serverOverride);
            return { valid: true };
        } catch (err) { return void(Logger.error("Error watching page:", err)) ?? { valid: false, reason: err.message }; }
    }
    async unwatchPage(title, bypass, serverOverride) {
        try {
            await this.postWithToken({ action: "watch", title, unwatch: true }, "watch", bypass, serverOverride);
            return { valid: true };
        } catch (err) { return void(Logger.error("Error unwatching page:", err)) ?? { valid: false, reason: err.message }; }
    }

    async parse(wt, title, preview = false, bypass, serverOverride) {
        title ??= undefined;
        const cacheKey = [ title, wt ].filter(item => item !== undefined);

        if (this.cache.parse.has(...cacheKey))
            return this.cache.parse.get(...cacheKey);

        try {
            const text = (await this.post({
                action: "parse",
                prop: "text",
                preview,
                text: wt,
                title,
                contentmodel: "wikitext"
            }, bypass, serverOverride))?.parse?.text || "";
            this.cache.parse.set(...cacheKey, text);
            return text;
        } catch (err) { return void(Logger.error("Error parsing wikitext:", err)) ?? ""; }
    }

    async getTags(bypass, serverOverride) {
        try {
            return (await this.continuous({
                action: "query", list: "tags", tglimit: "max"
            }, undefined, bypass, serverOverride)).responses.flatMap(r => r.query?.tags || [ ]);
        } catch (err) { return void(Logger.error("Error fetching revisions between IDs:", err)) ?? [ ]; }
    }

    async getPagesContent(titles, bypass, serverOverride) {
        titles = MediaWikiAPI.paramify(titles);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(titles, 50).map(async chunk => {
                return await this.post({ action: "query", prop: "revisions", rvprop: "content", rvslots: "*", titles: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));

            const pages = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    pages[page.title] = page.revisions?.[0]?.slots?.main?.content || "";
            }

            return pages;
        } catch (err) { return void(Logger.error("Error fetching pages content:", err)) ?? { }; }
    }
    async getRevisionsContent(revids, bypass, serverOverride) {
        revids = MediaWikiAPI.paramify(revids);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(revids, 500).map(async chunk => {
                return await this.post({ action: "query", prop: "revisions", rvprop: "ids|content", rvslots: "*", revids: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));

            const revisions = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    for (const rev of page.revisions || [ ])
                        revisions[rev.revid] = rev.slots?.main?.content || "";
            }

            return revisions;
        } catch (err) { return void(Logger.error("Error fetching revisions content:", err)) ?? { }; }
    }

    async getLatestIds(titles, bypass, serverOverride) {
        titles = MediaWikiAPI.paramify(titles);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(titles, 50).map(async chunk => {
                return await this.post({ action: "query", prop: "revisions", rvprop: "ids", titles: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));

            const pages = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    pages[page.title] = page.revisions?.[0]?.revid || null;
            }

            return pages;
        } catch (err) { return void(Logger.error("Error fetching latest IDs:", err)) ?? { }; }
    }
    async getRevisionsBetween(title, from, to, bypass, serverOverride) {
        try {
            return (await this.continuous({
                action: "query", prop: "revisions", titles: title, rvstartid: to, rvendid: from, rvprop: "title|ids|flags|user|timestamp|comment|parsedcomment|size|tags", rvlimit: "max"
            }, undefined, bypass, serverOverride)).responses.flatMap(r => r.query?.pages?.[0]?.revisions || [ ]);
        } catch (err) { return void(Logger.error("Error fetching revisions between IDs:", err)) ?? [ ]; }
    }

    async getEditCounts(usernames, bypass, serverOverride) {
        usernames = MediaWikiAPI.paramify(usernames);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(usernames, 500).map(async chunk => {
                return await this.post({ action: "query", list: "users", usprop: "editcount", ususers: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));

            const users = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const user of promise.value.query?.users || [ ])
                    users[user.name] = user.editcount;
            }

            return users;
        } catch (err) { return void(Logger.error("Error fetching edit counts:", err)) ?? { }; }
    }
    async areUsersBlocked(usernames, bypass, serverOverride) {
        usernames = MediaWikiAPI.paramify(usernames);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(usernames, 500).map(async chunk => {
                return await this.post({ action: "query", list: "blocks", bkusers: MediaWikiAPI.join(chunk), bkprop: "id|user|by|reason|expiry|flags" }, bypass, serverOverride);
            }));

            const users = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const block of promise.value.query?.blocks || [ ])
                    users[block.user] = block;
            }
            return users;
        } catch (err) { return void(Logger.error("Error fetching blocked users:", err)) ?? { }; }
    }
    async isUserGloballyLocked(username, bypass, serverOverride) {
        try {
            const response = await this.post({
                action: "query",
                meta: "globaluserinfo",
                guiuser: username,
            }, bypass, serverOverride);
            return response.query?.globaluserinfo?.locked === true;
        } catch (err) { return void(Logger.error("Error checking if user is globally locked:", err)) ?? false; }
    }

    async getContributions(username, limit = 10, bypass, serverOverride) {
        try {
            return (await this.post({
                action: "query",
                list: "usercontribs",

                ucuser: username,
                uclimit: limit,
                ucprop: "ids|title|timestamp|comment|parsedcomment|flags|tags|sizediff|flags"
            }, bypass, serverOverride)).query?.usercontribs || [ ];
        } catch (err) { return void(Logger.error("Error fetching contributions:", err)) ?? [ ]; }
    }
    async getBlocks(username, bypass, serverOverride) {
        try {
            return (await this.continuous({
                action: "query",
                list: "logevents",

                letype: "block",
                letitle: `User:${username}`,
                leaction: "block/block",
                lelimit: "max",
                leprop: "id|timestamp|details|user|comment|parsedcomment"
            }, undefined, bypass, serverOverride)).responses.flatMap(r => r.query?.logevents || [ ]);
        } catch (err) { return void(Logger.error("Error fetching blocks:", err)) ?? [ ]; }
    }

    async pagesExist(titles, bypass, serverOverride) {
        titles = MediaWikiAPI.paramify(titles);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(titles, 50).map(async chunk => {
                return await this.post({ action: "query", prop: "revisions", rvprop: "content", rvslots: "*", titles: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));

            const pages = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    pages[page.title] = page.missing ? undefined : page.revisions?.[0].slots?.main?.content;
            }

            return pages;
        } catch (err) { return void(Logger.error("Error checking page existence:", err)) ?? [ ]; }
    }
    async getPagesDetails(titles, bypass, serverOverride) {
        titles = MediaWikiAPI.paramify(titles);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(titles, 50).map(async chunk => {
                return await this.continuous({
                    action: "query",
                    prop: "info|categories|templates",
                    titles: MediaWikiAPI.join(chunk),

                    inprop: "protection|watched",

                    cllimit: "max",

                    tllimit: "max",
                    tlnamespace: "10",
                }, undefined, bypass, serverOverride);
            }));

            const pages = { };
            for (const result of promises) {
                if (result.status !== "fulfilled")
                    continue;
                for (const page of result.value.responses.flatMap(response => response.query?.pages || [ ])) {
                    pages[page.title] ??= { protection: null, watched: false, categories: [ ], metadata: [ ] };

                    let highest = pages[page.title]?.protection?.level || null;
                    for (const prot of page.protection || [ ]) {
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
                    for (const template of page.templates || [ ]) {
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
        } catch (err) { return void(Logger.error("Error fetching page details:", err)) ?? { }; }
    }

    async getHistory(title, limit = 10, bypass, serverOverride) {
        try {
            const page = (await this.post({
                action: "query",
                prop: "revisions",
                titles: title,

                rvlimit: limit + 1, // +1 bc we need sizediff
                rvprop: "ids|user|timestamp|comment|parsedcomment|flags|tags|size|flags",
            }, bypass, serverOverride)).query?.pages?.[0];

            if (!page?.revisions)
                return [ ];

            const len = page.revisions.length;
            const count = Math.min(limit, len || 0);
            for (let i = 0; i < count; i++) {
                const rev = page.revisions[i];

                rev.ns = page.ns;
                rev.pageid = page.pageid;
                rev.title = page.title;

                if (i + 1 < len)
                    rev.sizediff = rev.size - page.revisions[i + 1].size;
                else
                    rev.sizediff = rev.size;
            }

            return page.revisions.slice(0, count);
        } catch (err) { return void(Logger.error("Error fetching page history:", err)) ?? [ ]; }
    }
    async countPageReverts(title, username, bypass, serverOverride) {
        const check = tag => tag === "mw-undo" || tag === "mw-rollback" || tag === "mw-manual-revert";
        try {
            const data = await this.continuous({
                action: "query",
                prop: "revisions",
                titles: title,

                rvdir: "newer",
                rvstart: convertToUTCString(new Date(Date.now() - 8.64e7)), // 1 day
                rvprop: "tags",
                rvuser: username,
                rvlimit: "max",
            }, undefined, bypass, serverOverride);

            let count = 0;
            for (const response of data.responses)
                count += response.query?.pages?.[0]?.revisions?.filter(rev => rev.tags.some(check)).length || 0;

            return count;
        } catch (err) { return void(Logger.error("Error counting page reverts:", err)) ?? 0; }
    }

    async getORES(revids, bias, bypass, serverOverride) {
        revids = MediaWikiAPI.paramify(revids);
        try {
            const ores = { };
            revids = revids.filter(id => {
                const cached = this.cache.ores.get(id);
                if (cached)
                    return void(ores[id] = cached) ?? false;
                return true;
            });

            const chunks = MediaWikiAPI.chunk(revids, 50);
            const promises = await Promise.allSettled(chunks.map(async chunk => {
                return await this.post({ action: "query", prop: "revisions", rvprop: "ids|oresscores", rvslots: "*", revids: MediaWikiAPI.join(chunk) }, bypass, serverOverride);
            }));
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    for (const rev of page.revisions || [ ])
                        ores[rev.revid] = rev.oresscores || { };
            }

            return ORES.extract(ores, bias);
        } catch (err) { return void(Logger.error("Error fetching ORES scores:", err)) ?? { }; }
    }
    async extractORES(ores, bias = 0.5) {
        return ORES.extract(ores, bias);
    }

    async getDiff(from, to, format = "table", bypass, serverOverride) {
        from ??= false;

        const cacheKey = `${format}@${from}-${to}`;
        if (this.cache.diff.has(cacheKey))
            return this.cache.diff.get(cacheKey);

        try {
            const params = { action: "compare", prop: "diff", difftype: format, torev: to };
            if (from == false) {
                params.fromslots = "main";
                params["fromtext-main"] = "";
            } else
                params.fromrev = from;

            const diff = (await this.post(params, bypass, serverOverride)).compare?.body || "";
            this.cache.diff.set(cacheKey, diff);
            return diff;
        } catch (err) { return void(Logger.error("Error fetching diff:", err)) ?? ""; }
    }
    async getWikitextDiff(from, to, format = "table", bypass, serverOverride) {
        from ??= false;
        try {
            return (await this.post({
                action: "compare",
                prop: "diff",
                difftype: format,

                fromslots: "main",
                "fromtext-main": from === false ? "" : from,

                toslots: "main",
                "totext-main": to,
            }, bypass, serverOverride)).compare?.body || "";
        } catch (err) { return void(Logger.error("Error fetching wikitext diff:", err)) ?? ""; }
    }
    async getSizeDiff(from, to, bypass, serverOverride) {
        try {
            const revisions = await this.post({ action: "query", prop: "revisions", rvprop: "size", revids: `${from}|${to}` }, bypass, serverOverride).query?.pages?.[0]?.revisions || [ ];
            if (revisions.length === 0)
                return 0;
            else if (revisions.length === 1)
                return revisions[0].size;
            return revisions[1].size - revisions[0].size;
        } catch (err) { return void(Logger.error("Error fetching size diff:", err)) ?? 0; }
    }

    async getRevision(title, revid, bypass, serverOverride) {
        try {
            const page = (await this.post({
                action: "query",
                prop: "revisions",
                titles: title,

                rvprop: "ids|user|comment|parsedcomment|timestamp|size|tags|flags",
                rvslots: "*",
                rvstartid: revid,
                rvlimit: 2
            }, bypass, serverOverride)).query?.pages?.[0];

            if (!page?.revisions?.length)
                return { };

            const rev = page.revisions[0];
            return {
                revid: rev.revid,
                parentid: rev.parentid,

                user: rev.user,
                parsedcomment: rev.parsedcomment,
                comment: rev.comment,
                timestamp: rev.timestamp,

                size: rev.size,
                oldlen: page.revisions[1]?.size || 0,

                minor: rev.minor || false,
                tags: rev.tags || [ ],
            };
        } catch (err) { return void(Logger.error("Error fetching revision:", err)) ?? { }; }
    }
    async getRevisions(revids, bypass, serverOverride) {
        revids = MediaWikiAPI.paramify(revids);
        try {
            const promises = await Promise.allSettled(MediaWikiAPI.chunk(revids, 500).map(async chunk => {
                return await this.post({
                    action: "query",
                    prop: "revisions",
                    rvprop: "ids|user|comment|parsedcomment|timestamp|size|tags|flags|oresscores",
                    rvslots: "*",
                    revids: MediaWikiAPI.join(chunk)
                }, bypass, serverOverride);
            }));

            const revisions = { };
            for (const promise of promises) {
                if (promise.status !== "fulfilled")
                    continue;
                for (const page of promise.value.query?.pages || [ ])
                    for (const rev of page.revisions || [ ])
                        revisions[rev.revid] = rev;
            }

            return revisions;
        } catch (err) { return void(Logger.error("Error fetching revisions:", err)) ?? { }; }
    }

    async getConsecutiveEdits(page, revid, username, bypass, serverOverride) {
        try {
            const data = await this.continuous({
                action: "query", prop: "revisions", titles: page, rvprop: "ids|timestamp|user|size|parsedcomment", rvlimit: "max", rvstartid: revid
            }, data => data.query?.pages?.[0]?.revisions.some(rev => rev.user !== username), bypass, serverOverride);

            const revisions = data.responses.flatMap(response => response.query?.pages?.[0]?.revisions || [ ]);

            let last, prior;
            const first = revisions[0];
            if (first?.user !== username)
                return { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null, edits: [ ] };

            const result = { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null, edits: [ ] };
            const len = revisions.length;
            for (let i = 0; i < len; i++) {
                const rev = revisions[i];
                prior = rev;

                if (rev.user !== username)
                    break;

                result.edits.push(rev);

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
                result.diff = await this.getDiff(prior?.revid || null, first.revid, "table", bypass, serverOverride);
            else
                result.diff = await this.getDiff(null, first.revid, "table", bypass, serverOverride);

            return result;
        } catch (err) {
            Logger.error("Get consecutive edits error:", err);
            return { count: 0, sizediff: 0, timestamp: { new: null, old: null }, diff: null };
        }
    }

    async parseUsers(usernames, simple, bypass, serverOverride) {
        usernames = MediaWikiAPI.paramify(usernames);
        const result = Array.from({ length: usernames.length }, () => ({ user: { } }));
        try {
            const promises = [ ];

            promises.push(
                this.getEditCounts(usernames, bypass, serverOverride).then(data => {
                    usernames.forEach((name, i) => result[i].user.edits = data[name] || 0);
                }),
                this.areUsersBlocked(usernames, bypass, serverOverride).then(data => {
                    usernames.forEach((name, i) => result[i].user.blocked = data[name] || null);
                }),
                this.pagesExist(usernames.map(name => `User talk:${name}`), bypass, serverOverride).then(data => {
                    usernames.forEach((name, i) => result[i].user.talk = data[`User talk:${name}`]);
                })
            )

            if (!simple)
                promises.push(
                    (async () => {
                        await Promise.all(usernames.map(async (name, i) => {
                            [result[i].user.contributions, result[i].user.blocks] = await Promise.all([
                                this.getContributions(name, undefined, bypass, serverOverride),
                                this.getBlocks(name, bypass, serverOverride),
                            ]);
                        }));
                    })()
                );

            await Promise.all(promises);

            return result;
        } catch (err) { return void(Logger.error("Parse user error:", err)) ?? result; }
    }

    async parseEdits(items, simple, oresBias, bypass, serverOverride) {
        items = MediaWikiAPI.paramify(items);

        const users = MediaWikiAPI.paramify(items.map(item => item.item.user));
        const revids = MediaWikiAPI.paramify(items.map(item => item.item.revid));
        const titles = MediaWikiAPI.paramify(items.map(item => item.item.title));

        const result = items.map(({ item, prior }) => ({
            item,
            prior,
            data: { user: { }, page: { }, edit: { } }
        }))
        try {
            const promises = [ ];
            promises.push(
                this.parseUsers(users, simple, bypass, serverOverride).then(data => {
                    items.forEach((item, i) => {
                        const userIndex = users.indexOf(item.item.user);
                        result[i].data.user = data[userIndex].user;
                    });
                }),
                this.getPagesDetails(titles, bypass, serverOverride).then(data => {
                    items.forEach((item, i) => {
                        result[i].data.page.protection = data[item.item.title]?.protection || { protected: false };
                        result[i].data.page.watched = data[item.item.title]?.watched || false;
                        result[i].data.page.categories = data[item.item.title]?.categories || [ ];
                        result[i].data.page.metadata = data[item.item.title]?.metadata || [ ];
                    });
                }),
                this.getORES(revids, oresBias, bypass, serverOverride).then(data => {
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
                                result[i].data.page.consecutive,
                                result[i].data.page.reverts,
                                result[i].data.page.history,
                                result[i].data.edit.diff
                            ] = await Promise.all([
                                this.getConsecutiveEdits(item.item.title, item.item.revid, item.item.user, bypass, serverOverride),
                                this.countPageReverts(item.item.title, this.username, bypass, serverOverride),
                                this.getHistory(item.item.title, undefined, bypass, serverOverride),
                                this.getDiff(item.prior || null, item.item.revid, "table", bypass, serverOverride),
                            ]);
                        }));
                    })(),
                );

            await Promise.all(promises);

            return result;
        } catch (err) { return void(Logger.error("Parse edit error:", err)) ?? result; }
    }

    async parseAbuselogs(items, simple, bypass, serverOverride) {
        items = MediaWikiAPI.paramify(items);

        const users = MediaWikiAPI.paramify(items.map(item => item.user));
        const titles = MediaWikiAPI.paramify(items.map(item => item.title));

        const result = items.map(item => ({
            item,
            data: { user: { }, page: { }, edit: { } }
        }));
        try {
            const promises = [ ];
            promises.push(
                (async () => {
                    await Promise.all(items.map(async (item, i) => {
                        [
                            result[i].data.parsedcomment,
                        ] = await Promise.all([
                            this.parse(item.comment, undefined, false, bypass, serverOverride)
                        ]);
                    }));
                })(),
                this.parseUsers(users, simple, bypass, serverOverride).then(data => {
                    items.forEach((item, i) => {
                        const userIndex = users.indexOf(item.user);
                        result[i].data.user = data[userIndex].user;
                    });
                }),
                this.getPagesDetails(titles, bypass, serverOverride).then(data => {
                    items.forEach((item, i) => {
                        result[i].data.page.protection = data[item.title]?.protection || { protected: false };
                        result[i].data.page.watched = data[item.title]?.watched || false;
                        result[i].data.page.categories = data[item.title]?.categories || [ ];
                        result[i].data.page.metadata = data[item.title]?.metadata || [ ];
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
                                this.countPageReverts(item.title, this.username, bypass, serverOverride),
                                this.getHistory(item.title, undefined, bypass, serverOverride),
                                !item.diff ?
                                    Promise.resolve(null) :
                                    this.getWikitextDiff(item.diff.old, item.diff.new, "table", bypass, serverOverride),
                            ]);
                        }));
                    })(),
                );

            await Promise.all(promises);

            return result;
        } catch (err) { return void(Logger.error("Parse abuselog error:", err)) ?? result; }
    }

    async getAbuseLogRevid(logid, bypass, serverOverride) {
        try {
            const data = (await this.post({ action: "query", list: "abuselog", afllogids: logid, aflprop: "ids|revid" }, bypass, serverOverride)).query?.abuselog || [ ];
            return data.find(entry => entry.id === logid)?.revid || null;
        } catch (err) { return void(Logger.error("Error fetching abuse log revids:", err)) ?? { }; }
    }

    async feeds(recent = null, pending = null, users = null, watchlist = null, abuselog = null) {
        [ recent, pending, users, watchlist, abuselog ] = [ recent, pending, users, watchlist, abuselog ].map(feed => typeof feed === "object" ? feed : ({ }));
        try {
            const options = { action: "query", list: [ ] };

            if (recent !== null) {
                options.list.push("recentchanges");

                options.rctype = "edit";
                options.rcprop = "title|ids|sizes|flags|user|timestamp|comment|parsedcomment|tags|oresscores";

                options.rcshow = "!bot";
                options.rcnamespace = recent.ns || "*";

                if (recent.since) options.rcstart = recent.since;
                options.rcdir = recent.since ? "newer" : "older";

                options.rclimit = "max";
            }
            if (pending !== null && __pendingChanges__.has(this.server)) {
                options.list.push("oldreviewedpages");

                options.ornamespace = pending.ns || "*";

                options.orlimit = "max";
            }
            if (users !== null) {
                options.list.push("logevents");

                options.letype = "newusers";
                options.wlprop = "ids|title|type|user|timestamp|comment|details|parsedcomment";

                if (users.since) options.lestart = users.since;
                options.ledir = users.since ? "newer" : "older";

                options.lelimit = "max";
            }
            if (watchlist !== null) {
                options.list.push("watchlist");

                options.wltype = "edit";
                options.wlprop = "title|ids|sizes|flags|user|timestamp|comment|tags|oresscores|parsedcomment";

                options.wlexcludeuser = this.username;
                options.wlnamespace = watchlist.ns || "*";

                if (watchlist.since) options.wlstart = watchlist.since;
                options.wldir = watchlist.since ? "newer" : "older";

                options.wllimit = "max";
            }
            if (abuselog !== null) {
                options.list.push("abuselog");

                options.aflnamespace = abuselog.ns || "*";

                if (abuselog.since) options.aflstart = abuselog.since;
                options.afldir = abuselog.since ? "newer" : "older";

                options.aflprop = "ids|user|title|action|result|timestamp|hidden|revid|filter|details";
                options.afllimit = "max";
            }

            options.list = MediaWikiAPI.join(options.list);

            const data = { recent: [ ], pending: [ ], users: [ ], watchlist: [ ], abuselog: [ ] };
            (await this.continuous(options)).responses.forEach(response => {
                const query = response.query || { };
                if (query.recentchanges)
                    data.recent = data.recent.concat(query.recentchanges);
                if (query.oldreviewedpages)
                    data.pending = data.pending.concat(query.oldreviewedpages).slice(0, 100); // pending changes feed can be very large, so we limit it to 100 entries
                if (query.logevents)
                    data.users = data.users.concat(query.logevents.filter(entry => !entry.temp));
                if (query.watchlist)
                    data.watchlist = data.watchlist.concat(query.watchlist);
                if (query.abuselog)
                    data.abuselog = data.abuselog.concat(query.abuselog);
            });

            if (data.pending.length > 0) {
                const stability = new Map();
                const temp = { };
                await Promise.allSettled(data.pending.map(async item => {
                    if (!this.cache.pending.has(item.revid))
                        this.cache.pending.set(item.revid, await this.post({
                            action: "query",
                            prop: "revisions",
                            titles: item.title,
                            rvstartid: item.revid,
                            rvlimit: 1,
                            rvprop: "ids|flags|user|timestamp|comment|parsedcomment|size|tags",
                        }));
                    const rev = this.cache.pending.get(item.revid);

                    if (!stability.has(item.title))
                        stability.set(item.title, this.post({
                            action: "query",
                            list: "logevents",
                            letype: "stable",
                            leprop: "ids|title|type|user|timestamp|comment|details|parsedcomment",
                            letitle: item.title,
                            lelimit: 1
                        }));
                    item.stability = (await stability.get(item.title))?.query?.logevents?.[0] || { };

                    const page = rev.query?.pages?.[0];
                    temp[item.title] = { title: item.title, sizediff: item.diff_size, ...page.revisions?.[0], pending: item };
                }));

                data.pending = Object.values(temp);
                if (pending.full === true) {
                    const full = { };
                    await Promise.allSettled(data.pending.map(async item => {
                        const between = await this.getRevisionsBetween(item.title, item.pending.stable_revid, item.revid);
                        if (between.length < 2)
                            return;
                        const stable = between.pop();
                        full[item.title] = {
                            count: between.length,
                            users: between.reduce((acc, rev) => {
                                if (rev.user in acc)
                                    acc[rev.user]++;
                                else
                                    acc[rev.user] = 1;
                                return acc;
                            }, { }),

                            edits: between,

                            revid: item.revid,
                            prior: stable.revid,
                            sizediff: item.size - stable.size,

                            timestamp: {
                                new: item.timestamp,
                                old: between[between.length - 1].timestamp,
                            },
                            pending: item.pending,
                        };
                    }));
                    data.pending = full;
                }
            }

            if (data.abuselog.length > 0) {
                const logsById = { };
                data.abuselog.forEach(log => {
                    if (log.action !== "edit")
                        return;

                    const id = `${log.user}|${log.title}|${log.timestamp}`;
                    if (id in logsById)
                        logsById[id].push(log);
                    else
                        logsById[id] = [ log ];
                });

                const temp = [ ];
                await Promise.allSettled(Object.entries(logsById).map(async ([ , log ]) => {
                    const last = log[log.length - 1];

                    const result = new Set(log.flatMap(e => e.result.split(",")));

                    const revision = log.find(e => e.revid !== "" && e.revid !== undefined);
                    const publicEntry = log.find(e => Object.keys(e.details).length);
                    temp.push({
                        id: last.id,

                        revision: revision !== undefined,
                        private: !publicEntry,
                        result,
                        action: last.action,

                        revid: revision?.revid ?? null,
                        diff: publicEntry.details ? {
                            new: publicEntry.details.new_wikitext,
                            old: publicEntry.details.old_wikitext,
                            size: publicEntry.details.edit_delta,
                        } : null,
                        timestamp: last.timestamp,
                        comment: publicEntry?.details?.summary ?? null,

                        user: last.user,
                        editcount: publicEntry?.details?.user_editcount ?? null,

                        ns: last.ns,
                        title: last.title,

                        entries: log
                    });
                }));

                data.abuselog = temp;
            }

            return data;
        } catch (err) {
            Logger.error("Feeds error:", err);
            return {
                recent: [ ],
                pending: pending.full ? { } : [ ],
                users: [ ],
                watchlist: [ ],
                abuselog: [ ],
            };
        }
    }
}