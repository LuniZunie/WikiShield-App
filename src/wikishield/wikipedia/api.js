const serversWithPendingChanges = new Set([ ]);

export class API {
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
        return [...new Set(param)];
    }

    #ws = null;
    #server = null;
    #account = null;

    get username() {
        return this.#account;
    }

    get hasPendingChanges() {
        return serversWithPendingChanges.has(this.#server);
    }

    constructor(ws, server, username, pendingChangesServers) {
        this.#ws = ws;

        this.#server = server;
        this.#account = username;

        for (const pcServer of pendingChangesServers)
            serversWithPendingChanges.add(pcServer);
    }

    build(opts = {}) {
        return {
            "assertuser": this.#account,
            "discussiontoolsautosubscribe": "no",
            ...opts,
        };
    }

    summary(base, custom) {
        const watermark = " ([[:en:WP:WikiShield|WS]])";
        const message = `${base}${custom ? `: ${custom}` : ""}`;
        return `${this.#ws.util.truncate(message, 500 - watermark.length)}${watermark}`;
    }

    user(username) {
        return `[[Special:Contribs/${username}|${username}]] ([[User talk:${username}|talk]])`;
    }
    revision(revid) {
        return `[[Special:Diff/${revid}|${revid}]]`;
    }

    async post(params, bypass, serverOverride) {
        try {
            return await electronAPI.mwapi("post", params, bypass, serverOverride);
        } catch (error) {
            if (error === "assertnameduserfailed" || error.message?.includes("assertnameduserfailed"))
                return this.#ws.disable("Invalid account", "Your account was logged out or changed.");
            throw error;
        }
    }

    async continuous(params, cancel, bypass, serverOverride) {
        try {
            let continueObject = null;
            const responses = [];
            do {
                const data = await this.post({ ...params, ...(continueObject || {}) }, bypass, serverOverride);
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
            return { stopped: true, responses: [] };
        }
    }

    async getToken(type = "csrf", bypass, serverOverride) {
        return await electronAPI.mwapi("getToken", type, bypass, serverOverride);
    }

    async postWithToken(params, type = "csrf", bypass, serverOverride) {
        return await electronAPI.mwapi("postWithToken", params, type, bypass, serverOverride);
    }

    async account(bypass, serverOverride) {
        return await electronAPI.mwapi("account", bypass, serverOverride);
    }

    async append(title, section, content, summary, check, bypass, serverOverride) {
        if (typeof check === "function") {
            const result = await electronAPI.mwapi("append", title, section, content, summary, true, bypass, serverOverride);
            if (result.needsCheck) {
                const validity = await check(result.text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "Append check failed." };

                return await electronAPI.mwapi("append", title, section, content, summary, undefined, bypass, serverOverride);
            }
            return result;
        }
        return await electronAPI.mwapi("append", title, section, content, summary, undefined, bypass, serverOverride);
    }

    async editSection(title, index, section, content, summary, check, bypass, serverOverride) {
        if (typeof check === "function") {
            const result = await electronAPI.mwapi("editSection", title, index, section, content, summary, true, bypass, serverOverride);
            if (result.needsCheck) {
                const validity = await check(result.text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "Edit section check failed." };
                return await electronAPI.mwapi("editSection", title, index, section, content, summary, undefined, bypass, serverOverride);
            }
            return result;
        }
        return await electronAPI.mwapi("editSection", title, index, section, content, summary, undefined, bypass, serverOverride);
    }

    async acceptPendingEdit(id, summary, bypass, serverOverride) {
        return await electronAPI.mwapi("acceptPendingEdit", id, summary, bypass, serverOverride);
    }

    async rejectPendingEdit(id, prior, title, summary, bypass, serverOverride) {
        return await electronAPI.mwapi("rejectPendingEdit", id, prior, title, summary, bypass, serverOverride);
    }

    async rollbackEdit(title, user, summary, bypass, serverOverride) {
        return await electronAPI.mwapi("rollbackEdit", title, user, summary, bypass, serverOverride);
    }

    async undoEdit(title, revid, summary, bypass, serverOverride) {
        return await electronAPI.mwapi("undoEdit", title, revid, summary, bypass, serverOverride);
    }

    async restoreEdit(title, revid, summary, bypass, serverOverride) {
        return await electronAPI.mwapi("restoreEdit", title, revid, summary, bypass, serverOverride);
    }

    async thankRevision(revid, bypass, serverOverride) {
        return await electronAPI.mwapi("thankRevision", revid, bypass, serverOverride);
    }

    async watchPage(title, expiry, bypass, serverOverride) {
        return await electronAPI.mwapi("watchPage", title, expiry, bypass, serverOverride);
    }

    async unwatchPage(title, bypass, serverOverride) {
        return await electronAPI.mwapi("unwatchPage", title, bypass, serverOverride);
    }

    async parse(wikitext, bypass, serverOverride) {
        return await electronAPI.mwapi("parse", wikitext, bypass, serverOverride);
    }

    async getPagesContent(titles, bypass, serverOverride) {
        return await electronAPI.mwapi("getPagesContent", titles, bypass, serverOverride);
    }

    async getRevisionContent(revids, bypass, serverOverride) {
        return await electronAPI.mwapi("getRevisionContent", revids, bypass, serverOverride);
    }

    async getLatestIds(titles, bypass, serverOverride) {
        return await electronAPI.mwapi("getLatestIds", titles, bypass, serverOverride);
    }

    async getEditCounts(usernames, bypass, serverOverride) {
        return await electronAPI.mwapi("getEditCounts", usernames, bypass, serverOverride);
    }

    async areUsersBlocked(usernames, bypass, serverOverride) {
        return await electronAPI.mwapi("areUsersBlocked", usernames, bypass, serverOverride);
    }

    async getContributions(username, limit, bypass, serverOverride) {
        return await electronAPI.mwapi("getContributions", username, limit, bypass, serverOverride);
    }

    async getBlocks(username, bypass, serverOverride) {
        return await electronAPI.mwapi("getBlocks", username, bypass, serverOverride);
    }

    async pagesExist(titles, bypass, serverOverride) {
        return await electronAPI.mwapi("pagesExist", titles, bypass, serverOverride);
    }

    async getPagesDetails(titles, bypass, serverOverride) {
        return await electronAPI.mwapi("getPagesDetails", titles, bypass, serverOverride);
    }

    async countPageReverts(title, username, bypass, serverOverride) {
        return await electronAPI.mwapi("countPageReverts", title, username, bypass, serverOverride);
    }

    async getHistory(title, limit, bypass, serverOverride) {
        return await electronAPI.mwapi("getHistory", title, limit, bypass, serverOverride);
    }

    async getORES(revids, models, bypass, serverOverride) {
        return await electronAPI.mwapi("getORES", revids, models, bypass, serverOverride);
    }

    async getDiff(from, to, format = "table", bypass, serverOverride) {
        return await electronAPI.mwapi("getDiff", from, to, format, bypass, serverOverride);
    }

    async getRevision(title, revid, bypass, serverOverride) {
        return await electronAPI.mwapi("getRevision", title, revid, bypass, serverOverride);
    }

    async queue(type, ns, since, full) {
        return await electronAPI.mwapi("queue", type, ns, since, full);
    }

    async getRevisionsBetween(title, from, to, bypass, serverOverride) {
        return await electronAPI.mwapi("getRevisionsBetween", title, from, to, bypass, serverOverride);
    }

    async parseUsers(usernames, simple, bypass, serverOverride) {
        return await electronAPI.mwapi("parseUsers", usernames, simple, bypass, serverOverride);
    }

    async parseEdits(items, simple, bypass, serverOverride) {
        return await electronAPI.mwapi("parseEdits", items, simple, bypass, serverOverride);
    }

    async parseAbuselogs(items, simple, bypass, serverOverride) {
        return await electronAPI.mwapi("parseAbuselogs", items, simple, bypass, serverOverride);
    }

    async getConsecutiveEdits(page, revid, username, bypass, serverOverride) {
        return await electronAPI.mwapi("getConsecutiveEdits", page, revid, username, bypass, serverOverride);
    }

    async getAbuseLogRevid(logids, bypass, serverOverride) {
        return await electronAPI.mwapi("getAbuseLogRevid", logids, bypass, serverOverride);
    }

    async feeds(recent = { }, pending = { }, users = { }, watchlist = { }, abuselog = { }) {
        return await electronAPI.mwapi("feeds", recent, pending, users, watchlist, abuselog);
    }
}