const serversWithPendingChanges = new Set([ ]);

import { truncate } from "../../../global/truncate/script.esm.js";

const eventstreamCallbacks = new Set();
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
        return [ ...new Set(param) ].filter(p => typeof p === "string" && p.trim());
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

        electron.eventstream(data => {
            for (const callback of eventstreamCallbacks)
                try {
                    callback(data);
                } catch (error) {
                    console.error("Error in eventstream callback:", error);
                }
        });
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
        return `${truncate(message, 500 - watermark.length)}${watermark}`;
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

    async post(params, bypass, serverOverride) {
        try {
            return await electron.mwapi("post", params, bypass, serverOverride);
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
        return await electron.mwapi("getToken", type, bypass, serverOverride);
    }

    async postWithToken(params, type = "csrf", bypass, serverOverride) {
        return await electron.mwapi("postWithToken", params, type, bypass, serverOverride);
    }

    async account(bypass, serverOverride) {
        return await electron.mwapi("account", bypass, serverOverride);
    }
    async getGlobalUserInfo(username, bypass, serverOverride) {
        return await electron.mwapi("getGlobalUserInfo", username, bypass, serverOverride);
    }

    async markWatchlistSeen(page, id, bypass, serverOverride) {
        return await electron.mwapi("markWatchlistSeen", page, id, bypass, serverOverride);
    }

    async append(title, section, content, summary, check, bypass, serverOverride) {
        if (typeof check === "function") {
            const result = await electron.mwapi("append", title, section, content, summary, true, bypass, serverOverride);
            if (result.needsCheck) {
                const validity = await check(result.text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "Append check failed." };

                return await electron.mwapi("append", title, section, content, summary, undefined, bypass, serverOverride);
            }
            return result;
        }
        return await electron.mwapi("append", title, section, content, summary, undefined, bypass, serverOverride);
    }

    async editSection(title, index, section, content, summary, check, bypass, serverOverride) {
        if (typeof check === "function") {
            const result = await electron.mwapi("editSection", title, index, section, content, summary, true, bypass, serverOverride);
            if (result.needsCheck) {
                const validity = await check(result.text);
                if (!validity.valid)
                    return { valid: false, reason: validity.reason || "Edit section check failed." };
                return await electron.mwapi("editSection", title, index, section, content, summary, undefined, bypass, serverOverride);
            }
            return result;
        }
        return await electron.mwapi("editSection", title, index, section, content, summary, undefined, bypass, serverOverride);
    }

    async acceptPendingEdit(id, summary, bypass, serverOverride) {
        return await electron.mwapi("acceptPendingEdit", id, summary, bypass, serverOverride);
    }

    async rejectPendingEdit(id, prior, title, summary, bypass, serverOverride) {
        return await electron.mwapi("rejectPendingEdit", id, prior, title, summary, bypass, serverOverride);
    }

    async rollbackEdit(title, user, summary, bypass, serverOverride) {
        return await electron.mwapi("rollbackEdit", title, user, summary, bypass, serverOverride);
    }

    async undoEdit(title, revid, summary, bypass, serverOverride) {
        return await electron.mwapi("undoEdit", title, revid, summary, bypass, serverOverride);
    }

    async restoreEdit(title, revid, summary, bypass, serverOverride) {
        return await electron.mwapi("restoreEdit", title, revid, summary, bypass, serverOverride);
    }

    async thankRevision(revid, bypass, serverOverride) {
        return await electron.mwapi("thankRevision", revid, bypass, serverOverride);
    }

    async watchPage(title, expiry, bypass, serverOverride) {
        return await electron.mwapi("watchPage", title, expiry, bypass, serverOverride);
    }

    async unwatchPage(title, bypass, serverOverride) {
        return await electron.mwapi("unwatchPage", title, bypass, serverOverride);
    }

    async parse(wt, title, preview = false, bypass, serverOverride) {
        return await electron.mwapi("parse", wt, title, preview, bypass, serverOverride);
    }

    async getTags(bypass, serverOverride) {
        return await electron.mwapi("getTags", bypass, serverOverride);
    }

    async getPagesContent(titles, bypass, serverOverride) {
        return await electron.mwapi("getPagesContent", titles, bypass, serverOverride);
    }

    async getRevisionContent(revids, bypass, serverOverride) {
        return await electron.mwapi("getRevisionContent", revids, bypass, serverOverride);
    }

    async getLatestIds(titles, bypass, serverOverride) {
        return await electron.mwapi("getLatestIds", titles, bypass, serverOverride);
    }

    async getEditCounts(usernames, bypass, serverOverride) {
        return await electron.mwapi("getEditCounts", usernames, bypass, serverOverride);
    }

    async areUsersBlocked(usernames, bypass, serverOverride) {
        return await electron.mwapi("areUsersBlocked", usernames, bypass, serverOverride);
    }
    async isUserGloballyLocked(username, bypass, serverOverride) {
        return await electron.mwapi("isUserGloballyLocked", username, bypass, serverOverride);
    }

    async getContributions(username, limit, bypass, serverOverride) {
        return await electron.mwapi("getContributions", username, limit, bypass, serverOverride);
    }

    async getBlocks(username, bypass, serverOverride) {
        return await electron.mwapi("getBlocks", username, bypass, serverOverride);
    }

    async pagesExist(titles, bypass, serverOverride) {
        return await electron.mwapi("pagesExist", titles, bypass, serverOverride);
    }

    async getPagesDetails(titles, bypass, serverOverride) {
        return await electron.mwapi("getPagesDetails", titles, bypass, serverOverride);
    }

    async countPageReverts(title, username, bypass, serverOverride) {
        return await electron.mwapi("countPageReverts", title, username, bypass, serverOverride);
    }

    async getHistory(title, limit, bypass, serverOverride) {
        return await electron.mwapi("getHistory", title, limit, bypass, serverOverride);
    }

    async getORES(revids, bias, bypass, serverOverride) {
        return await electron.mwapi("getORES", revids, bias, bypass, serverOverride);
    }
    async extractORES(ores, bias) {
        return await electron.mwapi("extractORES", ores, bias);
    }

    async getDiff(from, to, format, bypass, serverOverride) {
        return await electron.mwapi("getDiff", from, to, format, bypass, serverOverride);
    }

    async getRevision(title, revid, bypass, serverOverride) {
        return await electron.mwapi("getRevision", title, revid, bypass, serverOverride);
    }

    async getRevisionsBetween(title, from, to, bypass, serverOverride) {
        return await electron.mwapi("getRevisionsBetween", title, from, to, bypass, serverOverride);
    }

    async parseUsers(usernames, simple, bypass, serverOverride) {
        return await electron.mwapi("parseUsers", usernames, simple, bypass, serverOverride);
    }

    async parseEdits(items, simple, oresBias, bypass, serverOverride) {
        return await electron.mwapi("parseEdits", items, simple, oresBias, bypass, serverOverride);
    }

    async parseAbuselogs(items, simple, bypass, serverOverride) {
        return await electron.mwapi("parseAbuselogs", items, simple, bypass, serverOverride);
    }

    async getConsecutiveEdits(page, revid, username, bypass, serverOverride) {
        return await electron.mwapi("getConsecutiveEdits", page, revid, username, bypass, serverOverride);
    }

    async getAbuseLogRevid(logids, bypass, serverOverride) {
        return await electron.mwapi("getAbuseLogRevid", logids, bypass, serverOverride);
    }

    async feeds(recent, pending, users, watchlist, abuselog) {
        return await electron.mwapi("feeds", recent, pending, users, watchlist, abuselog);
    }

    eventstream = Object.freeze({
        subscribe: callback => {
            eventstreamCallbacks.add(callback);
            return callback;
        },
        unsubscribe: callback => {
            eventstreamCallbacks.delete(callback);
        },
    });
}