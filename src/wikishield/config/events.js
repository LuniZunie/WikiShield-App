import { Queue } from "../core/queue.js";
import { WikiShield } from "../core/wikishield.js";
import { getWarningFromLookup, warningsLookup } from "../data/warnings.js";
import { welcomes } from "../data/welcomes.js";
import { fullTrim } from "../../../global/full-trim/script.esm.js";

export const events = {
    "next-item": {
        title: "Go to next item",
        icon: "fas fa-arrow-right",

        script: (ws, item, params) => {
            ws.queue.next();
            return { valid: true };
        }
    },
    "previous-item": {
        title: "Go to previous item",
        icon: "fas fa-arrow-left",

        script: (ws, item, params) => {
            ws.queue.previous();
            return { valid: true };
        }
    },
    "clear-queue": {
        title: "Clear queue",
        icon: "fas fa-trash-can",

        valid: (ws, item, params) => {
            if (ws.queue.current.type === "pending")
                return { valid: false, reason: "Pending edits queue cannot be cleared." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.clear(ws.queue.current.type);
            return { valid: true };
        }
    },

    "next-queue": {
        title: "Go to next queue",
        icon: "fas fa-forward",

        script: (ws, item, params) => {
            const queues = Queue.types.map(type => ({ name: type, ...ws.store.settings.queue[type] }));
            queues.sort((a, b) => a.order - b.order);

            const available = queues.filter(queue => queue.enabled);
            if (available.length === 0)
                return { valid: false, reason: "No queues are enabled." };

            const index = available.findIndex(queue => queue.name === ws.queue.current.type);
            ws.queue.switch(available[(index + 1) % available.length].name);

            return { valid: true };
        }
    },
    "previous-queue": {
        title: "Go to previous queue",
        icon: "fas fa-forward",

        script: (ws, item, params) => {
            const queues = Queue.types.map(type => ({ name: type, ...ws.store.settings.queue[type] }));
            queues.sort((a, b) => a.order - b.order);

            const available = queues.filter(queue => queue.enabled);
            if (available.length === 0)
                return { valid: false, reason: "No queues are enabled." };

            const index = available.findIndex(queue => queue.name === ws.queue.current.type);
            ws.queue.switch(available[(index - 1 + available.length) % available.length].name);

            return { valid: true };
        }
    },

    "accept-pending-edit": {
        title: "Accept pending edit",
        icon: "fas fa-check",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        progress: "Accepting pending edit",
        valid: (ws, item, params) => {
            if (!ws.rights.review)
                return { valid: false, reason: "You do not have permission to review pending changes." };
            if (!ws.queue.pending.has(item.id))
                return { valid: false, reason: "Pending edit can only be accepted when a pending edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            const pending = ws.queue.pending.get(item.id);
            if (!pending)
                return { valid: false, reason: "Pending edit not found." };

            const count = `${pending.count || ""} pending revision${pending.count === 1 ? "" : "s"}`;
            const join = array => {
                switch (array.length) {
                    case 0:
                    case 1: {
                        return array[0] || "";
                    } break;
                    case 2: {
                        return `${array[0]} and ${array[1]}`;
                    } break;
                    default: {
                        return `${array.slice(0, -1).join(", ")}, and ${array[array.length - 1]}`;
                    } break;
                }
            };

            const users = Object.entries(pending.users || {}).map(user => [ ws.api.user(user[0]), user[1] ]);
            users.sort((a, b) => b[1] - a[1]); // sort by number of edits
            const overflow = Math.max(users.reduce((sum, user) => {
                const len = user[0].length;
                if (sum[0] + len <= 250)
                    return [ sum[0] + len, sum[1] + 1 ];

                return sum;
            }, [ 0, 0 ])[1], 1);

            let userText = "";
            const len = users.length;
            if (len > overflow) {
                const display = users.slice(0, overflow).map(user => user[0]);
                const remaining = len - display.length;
                userText = `${display.join(", ")}, and ${remaining} other${remaining === 1 ? "" : "s"}`;
            } else
                userText = join(users.map(user => user[0]));

            return await ws.api.acceptPendingEdit(
                item.pending.revid,
                ws.api.summary(`Accepted ${count} by ${userText}`, params.summary)
            );
        },
        successful: (ws, item, params) => {
            ws.store.statistics.pending_changes_reviewed.accepted++;
        }
    },
    "reject-pending-edit": {
        title: "Reject pending edit",
        icon: "fas fa-xmark",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        progress: "Rejecting pending edit",
        valid: (ws, item, params) => {
            if (!ws.rights.review)
                return { valid: false, reason: "You do not have permission to review pending changes." };
            if (!ws.queue.pending.has(item.id))
                return { valid: false, reason: "Pending edit can only be rejected when a pending edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            const pending = ws.queue.pending.get(item.id);
            if (!pending)
                return { valid: false, reason: "Pending edit not found." };

            const count = `${pending.count || ""} pending revision${pending.count === 1 ? "" : "s"}`;
            const join = array => {
                switch (array.length) {
                    case 0:
                    case 1: {
                        return array[0] || "";
                    } break;
                    case 2: {
                        return `${array[0]} and ${array[1]}`;
                    } break;
                    default: {
                        return `${array.slice(0, -1).join(", ")}, and ${array[array.length - 1]}`;
                    } break;
                }
            };

            const users = Object.entries(pending.users || {}).map(user => [ ws.api.user(user[0]), user[1] ]);
            users.sort((a, b) => b[1] - a[1]); // sort by number of edits
            const overflow = Math.max(users.reduce((sum, user) => {
                const len = user[0].length;
                if (sum[0] + len <= 250)
                    return [ sum[0] + len, sum[1] + 1 ];

                return sum;
            }, [ 0, 0 ])[1], 1);

            let userText = "";
            const len = users.length;
            if (len > overflow) {
                const display = users.slice(0, overflow).map(user => user[0]);
                const remaining = len - display.length;
                userText = `${display.join(", ")}, and ${remaining} other${remaining === 1 ? "" : "s"}`;
            } else
                userText = join(users.map(user => user[0]));

            return await ws.api.rejectPendingEdit(
                item.id,
                pending.prior,
                item.page.title,
                ws.api.summary(`Rejected ${count} by ${userText} to [[Special:Diff/${pending.prior}|last stable revision]]`, params.summary)
            );
        },
        successful: (ws, item, params) => {
            ws.store.statistics.pending_changes_reviewed.rejected++;
        }
    },

    "revert": {
        title: "Revert and auto warn/report",
        icon: "fas fa-undo-alt",

        parameters: (ws, item) => [
            {
                id: "warning",
                title: "Warning template",

                type: "choice",
                options: Object.keys(warningsLookup),
                default: Object.keys(warningsLookup)[0],
            }
        ],

        progress: "Reverting edit",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit can only be reverted when an edit is selected." };

            const warning = getWarningFromLookup(params.warning);
            if (!("summary" in warning))
                return { valid: false, reason: "Selected warning template does not support reverting." };

            return { valid: true };
        },
        script: async (ws, item, params) => {
            const warning = getWarningFromLookup(params.warning);

            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Reverting yourself",
                    `You are about to revert your own edit. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to revert their edit?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to revert the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to revert it?`
                ) === false)
            )
                return { valid: false, reason: "Revert cancelled by user." };

            const rollback = await (async () => {
                return await ws.api.rollbackEdit(item.page.title, item.user.name, ws.api.summary(`Reverted edits by ${ws.api.user(item.user.name)}`, warning.summary));
            })();
            if (!rollback.valid)
                return rollback;
            else {
                ws.store.statistics.reverts_made.total++;
                switch (item.type) {
                    case "recent": {
                        ws.store.statistics.reverts_made.from_recent_changes++;
                    } break;
                    case "pending": {
                        ws.store.statistics.reverts_made.from_pending_changes++;
                    } break;
                    case "watchlist": {
                        ws.store.statistics.reverts_made.from_watchlist++;
                    } break;
                    case "abuselog": {
                        ws.store.statistics.reverts_made.from_abuse_log++;
                    } break;
                    default: {
                        ws.store.statistics.reverts_made.from_loaded_edits++;
                    } break;
                }
            }

            let oldLevel;
            const warn = await (async () => {
                const talk = `User talk:${item.user.name}`;
                const monthSection = ws.util.monthSectionName();

                const content = (await ws.api.getPagesContent([ talk ]))[talk] || "";
                const sections = ws.util.getPageSections(content);

                let section = "new";
                const len = sections.length;
                for (let i = 0; i < len; i++)
                    if (sections[i].title === monthSection)
                        section = i + 1;

                let level;
                oldLevel = ws.queue.getWarningLevel(content);
                if (typeof warning.auto === "string")
                    level = warning.auto;
                else if (typeof warning.auto === "function")
                    level = warning.auto(item, oldLevel);
                else
                    level = warning.auto[oldLevel];

                const template = warning.templates.find(template => template.name === level.toString());
                if (!template)
                    return { valid: true }; // no warning to issue, still wanna check for reporting

                let summary = "Message about ";
                if (Queue.groups[item.type] === "edit") // kinda redundant but whatever
                    summary += `[[Special:Diff/${item.id}|your edit]] on [[${item.page.title}]]`;
                else if (item.type === "abuselog") {
                    if (item.revid)
                        summary += `[[Special:Diff/${item.revid}|your edit]] on [[${item.page.title}]]`;
                    else
                        summary += `[[Special:AbuseLog/${item.id}|your contribution]] on [[${item.page.title}]]`;
                } else
                    summary += `[[${item.page.title}]]`;

                let newContent = "";
                if (section === "new")
                    newContent = `{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;
                else
                    newContent = `${sections[section - 1].heading}\n${sections[section - 1].content}\n\n{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;

                const result = await ws.api.editSection(
                    talk,
                    section,
                    monthSection,
                    newContent,
                    ws.api.summary(summary, `${warning.name} (${template.name})`)
                );

                if (result.valid) {
                    ws.queue.talks.set(item.user.name, true);

                    const levels = [ "0", "1", "2", "3", "4", "4im" ];
                    if (levels.indexOf(level) > levels.indexOf(item.user.warning || "0"))
                        ws.queue.warnings.set(item.user.name, level);

                    ws.store.statistics.warnings_issued.total++;
                    switch (level) {
                        case "1": {
                            ws.store.statistics.warnings_issued.level_1++;
                        } break;
                        case "2": {
                            ws.store.statistics.warnings_issued.level_2++;
                        } break;
                        case "3": {
                            ws.store.statistics.warnings_issued.level_3++;
                        } break;
                        case "4": {
                            ws.store.statistics.warnings_issued.level_4++;
                        } break;
                        case "4im": {
                            ws.store.statistics.warnings_issued.level_4im++;
                        } break;
                    }
                }

                return result;
            })();
            if (!warn.valid)
                return warn;

            if (oldLevel === "4" || oldLevel === "4im")
                if (warning.reportable && ws.store.settings.auto_report.enabled && ws.store.settings.auto_report.for.has(params.warning)) {
                    const report = await (async () => {
                        if (await ws.api.areUsersBlocked([ item.user.name ])[item.user.name])
                            return { valid: false, reason: "User cannot be reported because they are blocked." };

                        return await ws.api.append(WikiShield.config.pages.AIV, null, fullTrim(`
                            * {{vandal|${item.user.name}}} &ndash; Vandalism past final warning ~~~~
                        `), ws.api.summary(`Reporting ${ws.api.user(item.user.name)}`), page => {
                            const content = ws.util.getPageSections(page).find(section => section.title === "User-reported")?.content;
                            return {
                                valid: !(content?.includes(`{{vandal|${item.user.name}}`) || content?.includes(`{{IPVandal|${item.user.name}}`)),
                                reason: "User has already been reported to AIV."
                            };
                        });
                    })();

                    if (!report.valid)
                        return { valid: true }; // invalid but everything worked so no need to throw an error
                    else {
                        ws.store.statistics.reports_filed.total++;
                        ws.store.statistics.reports_filed.AIV++;
                    }
                }

            return { valid: true };
        }
    },
    "warn-and-report": {
        title: "Auto warn/report",
        icon: "fas fa-exclamation-triangle",

        parameters: (ws, item) => [
            {
                id: "warning",
                title: "Warning template",

                type: "choice",
                options: Object.keys(warningsLookup),
                default: Object.keys(warningsLookup)[0],
            }
        ],

        progress: "Warning user",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be warned when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            const warning = getWarningFromLookup(params.warning);

            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Warning yourself",
                    `You are about to warn yourself. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to warn them?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to warn the user about the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to warn the user about it?`
                ) === false)
            )
                return { valid: false, reason: "Warn cancelled by user." };

            let oldLevel;
            const warn = await (async () => {
                const talk = `User talk:${item.user.name}`;
                const monthSection = ws.util.monthSectionName();

                const content = (await ws.api.getPagesContent([ talk ]))[talk] || "";
                const sections = ws.util.getPageSections(content);

                let section = "new";
                const len = sections.length;
                for (let i = 0; i < len; i++)
                    if (sections[i].title === monthSection)
                        section = i + 1;

                let level;
                oldLevel = ws.queue.getWarningLevel(content);
                if (typeof warning.auto === "string")
                    level = warning.auto;
                else if (typeof warning.auto === "function")
                    level = warning.auto(item, oldLevel);
                else
                    level = warning.auto[oldLevel];

                const template = warning.templates.find(template => template.name === level.toString());
                if (!template)
                    return { valid: true }; // no warning to issue, still wanna check for reporting

                let summary = "Message about ";
                if (Queue.groups[item.type] === "edit") // kinda redundant but whatever
                    summary += `[[Special:Diff/${item.id}|your edit]] on [[${item.page.title}]]`;
                else if (item.type === "abuselog") {
                    if (item.revid)
                        summary += `[[Special:Diff/${item.revid}|your edit]] on [[${item.page.title}]]`;
                    else
                        summary += `[[Special:AbuseLog/${item.id}|your contribution]] on [[${item.page.title}]]`;
                } else
                    summary += `[[${item.page.title}]]`;

                let newContent = "";
                if (section === "new")
                    newContent = `{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;
                else
                    newContent = `${sections[section - 1].heading}\n${sections[section - 1].content}\n\n{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;

                const result = await ws.api.editSection(
                    talk,
                    section,
                    monthSection,
                    newContent,
                    ws.api.summary(summary, `${warning.name} (${template.name})`)
                );

                if (result.valid) {
                    ws.queue.talks.set(item.user.name, true);

                    const levels = [ "0", "1", "2", "3", "4", "4im" ];
                    if (levels.indexOf(level) > levels.indexOf(item.user.warning || "0"))
                        ws.queue.warnings.set(item.user.name, level);

                    ws.store.statistics.warnings_issued.total++;
                    switch (level) {
                        case "1": {
                            ws.store.statistics.warnings_issued.level_1++;
                        } break;
                        case "2": {
                            ws.store.statistics.warnings_issued.level_2++;
                        } break;
                        case "3": {
                            ws.store.statistics.warnings_issued.level_3++;
                        } break;
                        case "4": {
                            ws.store.statistics.warnings_issued.level_4++;
                        } break;
                        case "4im": {
                            ws.store.statistics.warnings_issued.level_4im++;
                        } break;
                    }
                }

                return result;
            })();
            if (!warn.valid)
                return warn;

            if (oldLevel === "4" || oldLevel === "4im")
                if (warning.reportable && ws.store.settings.auto_report.enabled && ws.store.settings.auto_report.for.has(params.warning)) {
                    const report = await (async () => {
                        if (await ws.api.areUsersBlocked([ item.user.name ])[item.user.name])
                            return { valid: false, reason: "User cannot be reported because they are blocked." };

                        return await ws.api.append(WikiShield.config.pages.AIV, null, fullTrim(`
                            * {{vandal|${item.user.name}}} &ndash; Vandalism past final warning ~~~~
                        `), ws.api.summary(`Reporting ${ws.api.user(item.user.name)}`), page => {
                            const content = ws.util.getPageSections(page).find(section => section.title === "User-reported")?.content;
                            return {
                                valid: !(content?.includes(`{{vandal|${item.user.name}}`) || content?.includes(`{{IPVandal|${item.user.name}}`)),
                                reason: "User has already been reported to AIV."
                            };
                        });
                    })();

                    if (!report.valid)
                        return { valid: true }; // invalid but everything worked so no need to throw an error
                    else {
                        ws.store.statistics.reports_filed.total++;
                        ws.store.statistics.reports_filed.AIV++;
                    }
                }

            return { valid: true };
        }
    },

    "warn-user": {
        title: "Warn user",
        icon: "fas fa-exclamation-triangle",

        parameters: (ws, item) => [
            {
                id: "warning",
                title: "Warning template",

                type: "choice",
                options: Object.keys(warningsLookup),
                default: Object.keys(warningsLookup)[0],
            },
            {
                dependencies: [ "warning" ],

                id: "level",
                title: "Warning level",

                type: "choice",
                options: (dependencies) => {
                    return [
                        "auto",
                        ...warningsLookup[dependencies.warning].templates
                            .filter(template => template.generic === undefined)
                            .map(template => template.name)
                    ];
                },
                default: "auto",
            }
        ],

        continuity: true,
        progress: "Issuing warning to user",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be warned when an item is selected." };
            else if (params.level !== "auto" && getWarningFromLookup(params.warning)?.templates[params.level] === null)
                return { valid: false, reason: "Selected warning template does not support automatic level selection." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Warning yourself",
                    `You are about to warn yourself. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to warn them?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to warn the user about the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to warn the user about it?`
                ) === false)
            )
                return { valid: false, reason: "Warning cancelled by user." };

            const warning = getWarningFromLookup(params.warning);

            const talk = `User talk:${item.user.name}`;
            const monthSection = ws.util.monthSectionName();

            const content = (await ws.api.getPagesContent([ talk ]))[talk] || "";
            const sections = ws.util.getPageSections(content);

            let section = "new";
            const len = sections.length;
            for (let i = 0; i < len; i++)
                if (sections[i].title === monthSection)
                    section = i + 1;

            let level;
            if (params.level === "auto") {
                if (typeof warning.auto === "string")
                    level = warning.auto;
                else if (typeof warning.auto === "function")
                    level = warning.auto(item, ws.queue.getWarningLevel(content));
                else
                    level = warning.auto[ws.queue.getWarningLevel(content)];
            } else
                level = params.level;

            const template = warning.templates.find(template => template.name === level.toString());
            if (!template) {
                if (params.level !== "auto")
                    return { valid: false, reason: "Selected warning template does not support the specified level." };

                return { valid: true }; // no warning to issue, still wanna check for reporting
            }

            let summary = "Message about ";
            if (Queue.groups[item.type] === "edit")
                summary += `[[Special:Diff/${item.id}|your edit]] on [[${item.page.title}]]`;
            else if (item.type === "abuselog") {
                if (item.revid)
                    summary += `[[Special:Diff/${item.revid}|your edit]] on [[${item.page.title}]]`;
                else
                    summary += `[[Special:AbuseLog/${item.id}|your contribution]] on [[${item.page.title}]]`;
            } else
                summary += `[[${item.page.title}]]`;

            let newContent = "";
            if (section === "new")
                newContent = `{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;
            else
                newContent = `${sections[section - 1].heading}\n${sections[section - 1].content}\n\n{{subst:${template.template}|${item.page.title}|${template.generic || ""}}} ~~~~`;

            const result = await ws.api.editSection(
                talk,
                section,
                monthSection,
                newContent,
                ws.api.summary(summary, `${warning.name} (${template.name})`)
            );

            if (result.valid) {
                ws.queue.talks.set(item.user.name, true);

                const levels = [ "0", "1", "2", "3", "4", "4im" ];
                if (levels.indexOf(level) > levels.indexOf(item.user.warning || "0"))
                    ws.queue.warnings.set(item.user.name, level);

                ws.store.statistics.warnings_issued.total++;
                switch (level) {
                    case "1": {
                        ws.store.statistics.warnings_issued.level_1++;
                    } break;
                    case "2": {
                        ws.store.statistics.warnings_issued.level_2++;
                    } break;
                    case "3": {
                        ws.store.statistics.warnings_issued.level_3++;
                    } break;
                    case "4": {
                        ws.store.statistics.warnings_issued.level_4++;
                    } break;
                    case "4im": {
                        ws.store.statistics.warnings_issued.level_4im++;
                    } break;
                }
            }

            return result;
        },
    },

    "rollback-edit": {
        title: "Rollback edit",
        icon: "fas fa-undo-alt",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text"
            },
            {
                id: "hide_username",
                title: "Hide username",

                type: "choice",
                options: [ "Yes", "No" ],
                default: "No"
            }
        ],

        progress: "Rolling back edit",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit can only be rolled back when an edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Rollbacking own edit",
                    `You are about to revert your own edit. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to rollback their edit?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to rollback the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to rollback it?`
                ) === false)
            )
                return { valid: false, reason: "Rollback cancelled by user." };

            const user = params.hide_username === "Yes" ? "" : ` by ${ws.api.user(item.user.name)}`;
            return await ws.api.rollbackEdit(item.page.title, item.user.name, ws.api.summary(`Reverted edits${user}`, params.summary));
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reverts_made.total++;

            switch (item.type) {
                case "recent": {
                    ws.store.statistics.reverts_made.from_recent_changes++;
                } break;
                case "pending": {
                    ws.store.statistics.reverts_made.from_pending_changes++;
                } break;
                case "watchlist": {
                    ws.store.statistics.reverts_made.from_watchlist++;
                } break;
                case "abuselog": {
                    ws.store.statistics.reverts_made.from_abuse_log++;
                } break;
                default: {
                    ws.store.statistics.reverts_made.from_loaded_edits++;
                } break;
            }
        }
    },
    "rollback-goodfaith-edit": {
        title: "Rollback good faith edit",
        icon: "fas fa-undo-alt",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            },
            {
                id: "hide_username",
                title: "Hide username",

                type: "choice",
                options: [ "Yes", "No" ],
                default: "No"
            }
        ],

        progress: "Rolling back good faith edit",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit can only be rolled back when an edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Rollbacking own edit",
                    `You are about to revert your own edit. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to rollback their edit?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to rollback the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to rollback it?`
                ) === false)
            )
                return { valid: false, reason: "Rollback cancelled by user." };

            const user = params.hide_username === "Yes" ? "" : ` by ${ws.api.user(item.user.name)}`;
            return await ws.api.rollbackEdit(item.page.title, item.user.name, ws.api.summary(`Reverted [[Wp:AGF|Good faith]] edits${user}`, params.summary));
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reverts_made.total++;
            ws.store.statistics.reverts_made.good_faith++;

            switch (item.type) {
                case "recent": {
                    ws.store.statistics.reverts_made.from_recent_changes++;
                } break;
                case "pending": {
                    ws.store.statistics.reverts_made.from_pending_changes++;
                } break;
                case "watchlist": {
                    ws.store.statistics.reverts_made.from_watchlist++;
                } break;
                case "abuselog": {
                    ws.store.statistics.reverts_made.from_abuse_log++;
                } break;
                default: {
                    ws.store.statistics.reverts_made.from_loaded_edits++;
                } break;
            }
        }
    },

    "undo-edit": {
        title: "Undo edit",
        icon: "fas fa-undo",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            },
            {
                id: "hide_username",
                title: "Hide username",

                type: "choice",
                options: [ "Yes", "No" ],
                default: "No"
            }
        ],

        progress: "Undoing edit",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit can only be undone when an edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            await ws.gui.settings.waitForClose();
            if (
                (item.user.name === ws.api.username && await ws.gui.dialog.confirm(
                    "Undoing own edit",
                    `You are about to undo your own edit. Are you sure you want to proceed?`
                ) === false) ||
                (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                    "User is whitelisted",
                    `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to undo their edit?`
                ) === false) ||
                (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                    "Page is whitelisted",
                    `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to undo the edit on it?`
                ) === false) ||
                (item.tags?.some(tag => ws.store.whitelist.tags.has(tag)) && await ws.gui.dialog.confirm(
                    "Edit is whitelisted",
                    `This edit has one or more whitelisted tags. Are you sure you want to undo it?`
                ) === false)
            )
                return { valid: false, reason: "Undo cancelled by user." };

            const user = params.hide_username === "Yes" ? "" : ` by ${ws.api.user(item.user.name)}`;
            return await ws.api.undoEdit(item.page.title, item.id, ws.api.summary(`Undid revision ${ws.api.revision(item.id)}${user}`, params.summary));
        },
    },
    "restore-edit": {
        title: "Restore edit",
        icon: "fas fa-redo",

        parameters: (ws, item) => [
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        progress: "Restoring edit",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit can only be restored when an edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            return await ws.api.restoreEdit(item.page.title, item.id, ws.api.summary(`Restored revision ${ws.api.revision(item.id)} by ${ws.api.user(item.user.name)}`, params.summary));
        }
    },

    "send-message-to-user-talk": {
        title: "Send message to user talk page",
        icon: "fas fa-comment",

        parameters: (ws, item) => [
            {
                id: "heading",
                title: "Section heading",

                type: "text",
            },
            {
                id: "message",
                title: "Message (sign with ~~~~)",

                type: "text",
            }
        ],

        progress: "Sending message to user talk page",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Message can only be sent when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            return await ws.api.editSection(
                `User talk:${item.user.name}`,
                "new",
                params.heading,
                params.message,
                ws.api.summary(`Message from ${ws.api.username}: ${params.heading}`)
            );
        }
    },
    "send-message-to-page-talk": {
        title: "Send message to page talk page",
        icon: "fas fa-comment",

        parameters: (ws, item) => [
            {
                id: "heading",
                title: "Section heading",

                type: "text",
            },
            {
                id: "message",
                title: "Message (sign with ~~~~)",

                type: "text",
            }
        ],

        progress: "Sending message to page talk page",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Message can only be sent when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            const title = item.page.title.split(":");
            let ns = "Talk";
            if (title.length > 1)
                ns = title[0].toLowerCase().includes("talk") ? title[0] : `${title[0]} talk`;

            const page = `${ns}:${title.length === 1 ? title[0] : title.slice(1).join(":")}`;
            return await ws.api.editSection(
                page,
                "new",
                params.heading,
                params.message,
                ws.api.summary(`Message from ${ws.api.username}: ${params.heading}`)
            );
        }
    },

    "report-user-to-aiv": {
        title: "Report user to AIV",
        icon: "fas fa-flag",

        parameters: (ws, item) => [
            {
                id: "reason",
                title: "Reason",

                type: "choice",
                options: [
                    "Vandalism past final warning",
                    "Vandalism-only account",
                    "Vandalism after recent release of block",
                    "Spambot or compromised account",
                    "Long-term abuse",
                ],
                default: "Vandalism past final warning",
            },
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        continuity: true,
        progress: "Reporting user to AIV",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be reported when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            if (item.user.name === ws.api.username)
                return { valid: false, reason: "You cannot report yourself, silly!" };

            await ws.gui.settings.waitForClose();
            if (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                "User is whitelisted",
                `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to report them?`
            ) === false)
                return { valid: false, reason: "User report cancelled by user." };

            if (await ws.api.areUsersBlocked([ item.user.name ])[item.user.name])
                return { valid: false, reason: "User cannot be reported because they are blocked." };

            return await ws.api.append(WikiShield.config.pages.AIV, null, fullTrim(`
                * {{vandal|${item.user.name}}} &ndash; ${params.reason}${params.summary ? `: ${params.summary}` : ""} ~~~~
            `), ws.api.summary(`Reporting ${ws.api.user(item.user.name)}`), page => {
                const content = ws.util.getPageSections(page).find(section => section.title === "User-reported")?.content;
                return {
                    valid: !(content?.includes(`{{vandal|${item.user.name}}`) || content?.includes(`{{IPVandal|${item.user.name}}`)),
                    reason: "User has already been reported to AIV."
                };
            });
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reports_filed.total++;
            ws.store.statistics.reports_filed.AIV++;
        }
    },
    "report-user-to-uaa": {
        title: "Report user to UAA",
        icon: "fas fa-user-slash",

        parameters: (ws, item) => [
            {
                id: "reason",
                title: "Reason",

                type: "choice",
                options: [
                    "Disruptive username",
                    "Offensive username",
                    "Promotional username",
                    "Misleading username"
                ],
                default: "Disruptive username",
            },
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        continuity: true,
        progress: "Reporting user to UAA",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be reported when an item is selected." };
            else if (item.user.anon)
                return { valid: false, reason: "User cannot be reported because they are anonymous." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            if (item.user.name === ws.api.username)
                return { valid: false, reason: "You cannot report yourself, silly!" };

            await ws.gui.settings.waitForClose();
            if (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                "User is whitelisted",
                `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to report them?`
            ) === false)
                return { valid: false, reason: "User report cancelled by user." };

            if (await ws.api.areUsersBlocked([ item.user.name ])[item.user.name])
                return { valid: false, reason: "User cannot be reported because they are blocked." };

            const username = params.reason === "Offensive username" ? "offensive username" : ws.api.user(item.user.name);

            return await ws.api.append(WikiShield.config.pages.UAA, null, fullTrim(`
                * {{user-uaa|${item.user.name}}} &ndash; ${params.reason}${params.summary ? `: ${params.summary}` : ""} ~~~~
            `), ws.api.summary(`Reporting ${username}`), page => {
                return {
                    valid: !ws.util.getPageSections(page).find(section => section.title === "User-reported")?.content.includes(`{{user-uaa|${item.user.name}}`),
                    reason: "User has already been reported to UAA."
                };
            });
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reports_filed.total++;
            ws.store.statistics.reports_filed.UAA++;
        }
    },
    "request-page-protection": {
        title: "Request page protection",
        icon: "fas fa-shield-alt",

        parameters: (ws, item) => [
            {
                id: "level",
                title: "Protection level",

                type: "choice",
                options: [
                    ...(ws.api.hasPendingChanges ? [ "Pending changes protection", ] : []),
                    "Semi-protection",
                    "Extended-confirmed protection",
                    "Full protection",
                    "Move protection",
                    "Template protection",
                ],
                default: "Semi-protection",
            },
            {
                id: "reason",
                title: "Reason",

                type: "choice",
                options: [
                    "Generic",
                    "Persistent vandalism",
                    "Disruptive editing",
                    "Edit warring",
                    "BLP violations",
                    "Sockpuppetry",
                    "Arbitration enforcement",
                ],
                default: "Generic",
            },
            {
                id: "duration",
                title: "Duration",

                type: "choice",
                options: [
                    "Temporary",
                    "Indefinite",
                ],
                default: "Temporary",
            },
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        progress: "Requesting page protection",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Page protection can only be requested for edits." };
            return { valid: true };
        },
        script: async (ws, item, params) => { // what in the skibidi is this structured spaghetti code
            await ws.gui.settings.waitForClose();
            if (ws.store.whitelist.pages.has(item.page.title) && await ws.gui.dialog.confirm(
                "Page is whitelisted",
                `The page <a href="https://${ws.server}/wiki/${encodeURIComponent(item.page.title)}" target="_blank">${item.page.title}</a> is whitelisted. Are you sure you want to request protection for it?`
            ) === false)
                return { valid: false, reason: "Page protection request cancelled by user." };

            const reason = params.reason === "Generic" ? params.summary : `${params.reason} &ndash; ${params.summary}`;
            return await ws.api.append(WikiShield.config.pages.RFPP, null, `\n${fullTrim(`
                === [[${item.page.title}]] ===
                * {{pagelinks|${item.page.title}}}
                '''${params.duration} ${params.level.toLowerCase()}'''${reason ? `: ${reason}` : ""} ~~~~
            `)}`, ws.api.summary(`Requesting ${params.level} protection for [[${item.page.title}]]`), page => {
                return {
                    valid: !ws.util.getPageSections(page).some(section => section.title === `[[${item.page.title}]]`),
                    reason: "Page protection has already been requested for this page."
                };
            });
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reports_filed.total++;
            ws.store.statistics.reports_filed.RFPP++;
        }
    },

    "request-global-block": {
        title: "Request global block",
        icon: "fas fa-ban",

        parameters: (ws, item) => [
            {
                id: "reason",
                title: "Reason",

                type: "choice",
                options: [
                    "Generic",
                    "Long-term abuse",
                    "Cross-wiki abuse",
                    "Spam / spambot",
                    "Compromised account"
                ],
                default: "Generic",
            },
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            }
        ],

        progress: "Requesting global block",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Global block can only be requested when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            if (item.user.name === ws.api.username)
                return { valid: false, reason: "You cannot request a global block for yourself, silly!" };

            await ws.gui.settings.waitForClose();
            if (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                "User is whitelisted",
                `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to request a global block for them?`
            ) === false)
                return { valid: false, reason: "Global block request cancelled by user." };

            if (await ws.api.isUserGloballyLocked(item.user.name))
                return { valid: false, reason: "User is globally locked." };

            const reason = params.reason === "Generic" ? params.summary : `${params.reason}. ${params.summary}`;

            const page = (await ws.api.getPagesContent([ WikiShield.config.pages.SRG ], true, "meta.wikimedia.org"))[WikiShield.config.pages.SRG] || "";
            const sections = ws.util.getPageSections(page);

            return await ws.api.append(
                WikiShield.config.pages.SRG,
                (Number(Object.entries(sections).find(([ , section ]) => section.level === 2 && section.title === "Requests for global (un)block")?.[0]) + 1) || undefined,
                `\n${fullTrim(`
                    === Global block for ${item.user.name} ===
                    {{Status}} <!-- Do not remove this template -->
                    * {{Luxotool|${item.user.name}}}
                    ${reason ? `${reason} ` : ""} <small>([[:en:WP:WikiShield|WikiShield]])</small> ~~~~
                `)}`,
                ws.api.summary(`Requesting global block for ${ws.api.user(item.user.name)}`),
                page => {
                    let searching = false;
                    let sections = [ ];
                    for (const section of ws.util.getPageSections(page)) {
                        if (section.level === 2) {
                            if (section.title === "Requests for global (un)block")
                                searching = true;
                            else if (searching)
                                break;
                        } else if (searching && section.level === 3)
                            sections.push(section);
                    }

                    sections = sections.filter(section => !section.content.match(/^{{Status\|not done}}/i));
                    return {
                        valid: !sections.some(section => {
                            const content = section.content;
                            if (content.match(new RegExp(`{{Luxotool\\|(?:\\d+=)?\\s*${ws.util.escapeRegex(item.user.name)}}}`, "i")))
                                return true;
                            else if (content.match(new RegExp(`{{MultiLock\\|(?:[^|}]*\\|)*(?:\\d+=)?\\s*${ws.util.escapeRegex(item.user.name)}(?:\\|hidename=1)?(?:\\||})`, "i")))
                                return true;
                            return false;
                        }),
                        reason: "User has already been requested for global block."
                    };
                },
                false,
                "meta.wikimedia.org"
            );
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reports_filed.total++;
            ws.store.statistics.reports_filed.global_block++;
        }
    },
    "request-global-lock": {
        title: "Request global lock",
        icon: "fas fa-lock",

        parameters: (ws, item) => [
            {
                id: "reason",
                title: "Reason",

                type: "choice",
                options: [
                    "Generic",
                    "Long-term abuse",
                    "Cross-wiki abuse",
                    "Abusive-username",
                    "Spam / spambot",
                    "Compromised account"
                ],
                default: "Generic",
            },
            {
                id: "summary",
                title: "Summary (optional)",

                type: "text",
            },
            {
                id: "hide_username",
                title: "Hide username",

                type: "choice",
                options: [ "Yes", "No" ],
                default: "No"
            }
        ],

        progress: "Requesting global lock",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Global lock can only be requested when an item is selected." };
            else if (item.user.anon)
                return { valid: false, reason: "Global lock cannot be requested for anonymous users." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            if (item.user.name === ws.api.username)
                return { valid: false, reason: "You cannot request a global lock for yourself, silly!" };

            await ws.gui.settings.waitForClose();
            if (ws.store.whitelist.users.has(item.user.name) && await ws.gui.dialog.confirm(
                "User is whitelisted",
                `The user <a href="https://${ws.server}/wiki/User:${encodeURIComponent(item.user.name)}" target="_blank">${item.user.name}</a> is whitelisted. Are you sure you want to request a global lock for them?`
            ) === false)
                return { valid: false, reason: "Global lock request cancelled by user." };

            if (await ws.api.isUserGloballyLocked(item.user.name))
                return { valid: false, reason: "User is already globally locked." };

            const reason = params.reason === "Generic" ? params.summary : `${params.reason}. ${params.summary}`;
            const user = params.hide_username === "Yes" ? "" : ` for ${ws.api.centralAuthUser(item.user.name)}`;

            const page = (await ws.api.getPagesContent([ WikiShield.config.pages.SRG ], true, "meta.wikimedia.org"))[WikiShield.config.pages.SRG] || "";
            const sections = ws.util.getPageSections(page);

            return await ws.api.append(
                WikiShield.config.pages.SRG,
                (Number(Object.entries(sections).find(([ , section ]) => section.level === 2 && section.title === "Requests for global (un)lock and (un)hiding")?.[0]) + 1) || undefined,
                `\n${fullTrim(`
                    === Global lock${user} ===
                    {{Status}} <!-- Do not remove this template -->
                    * {{LockHide|${item.user.name}${params.hide_username === "Yes" ? "|hidename=1" : ""}}}
                    ${reason ? `${reason} ` : ""} <small>([[:en:WP:WikiShield|WikiShield]])</small> ~~~~
                `)}`,
                ws.api.summary(`Requesting global lock${user}`),
                page => {
                    let searching = false;
                    let sections = [ ];
                    for (const section of ws.util.getPageSections(page)) {
                        if (section.level === 2) {
                            if (section.title === "Requests for global (un)lock and (un)hiding")
                                searching = true;
                            else if (searching)
                                break;
                        } else if (searching && section.level === 3)
                            sections.push(section);
                    }

                    sections = sections.filter(section => !section.content.match(/^{{Status\|not done}}/i));
                    return {
                        valid: !sections.some(section => {
                            const content = section.content;
                            if (content.match(new RegExp(`{{LockHide\\|(?:\\d+=)?\\s*${ws.util.escapeRegex(item.user.name)}(\\|hidename=1)?}}`, "i")))
                                return true;
                            else if (content.match(new RegExp(`{{MultiLock\\|(?:[^|}]*\\|)*(?:\\d+=)?\\s*${ws.util.escapeRegex(item.user.name)}(?:\\|hidename=1)?(?:\\||})`, "i")))
                                return true;
                            return false;
                        }),
                        reason: "User has already been requested for global lock."
                    };
                },
                false,
                "meta.wikimedia.org"
            );
        },
        successful: (ws, item, params) => {
            ws.store.statistics.reports_filed.total++;
            ws.store.statistics.reports_filed.global_lock++;
        }
    },

    "thank-user": {
        title: "Thank user",
        icon: "fas fa-handshake",

        progress: "Thanking user",
        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "User can only be thanked when an edit is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            const summary = ws.api.summary(`Thank you for [[Special:Diff/${item.id}|your edit]] on [[${item.page.title}]]`);
            const page = `User talk:${item.user.name}`;
            if (item.user.temp) {
                const result = await ws.api.thankRevision(item.id);
                if (result.valid || ws.store.settings.talk_page_thanks_for_temporary_users.enabled) {
                    if ((await ws.api.pagesExist(page))[page] === undefined) // if talk page doesn't exist, we can use the welcome, thanks template =)
                        await ws.api.editSection(page, "new", "Thank you!", "{{subst:Thanks-autosign}}", summary);
                }

                return result; // if the talk page thank failed, at least the revision thank went through
            } else if (item.user.ip)
                return await ws.api.editSection(page, "new", "Thank you!", "{{subst:Thanks-autosign}}", summary);
            else
                return await ws.api.thankRevision(item.id);
        },
        successful: (ws, item, params) => {
            ws.store.statistics.edits_reviewed.thanked++;
        }
    },
    "welcome-user": {
        title: "Welcome user",
        icon: "fas fa-paper-plane",

        parameters: (ws, item) => [
            {
                id: "template",
                title: "Template",

                type: "choice",
                options: Object.keys(welcomes),
                default: Object.keys(welcomes)[0],
            }
        ],

        progress: "Welcoming user",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be welcomed when an item is selected." };
            else if (item.user.talk !== undefined)
                return { valid: false, reason: "User cannot be welcomed because their talk page is not empty." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            return await (async () => {
                const page = `User talk:${item.user.name}`;
                if ((await ws.api.pagesExist([ page ]))[page] !== undefined)
                    return { valid: false, reason: "User cannot be welcomed because their talk page is not empty." };

                let template = welcomes[params.template];
                if (!template)
                    return { valid: false, reason: "Selected welcome template does not exist." };

                const DONT_CRASH_ANY_COMPUTERS_PLEASE = new Set([ template ]);
                while (typeof template?.template === "function") {
                    template = welcomes[template.template(ws, item)];
                    if (DONT_CRASH_ANY_COMPUTERS_PLEASE.has(template))
                        return (void ws.gui.dialog.toast(
                            "REPORT TO DEVELOPER",
                            "Uh oh! Something has gone <i>cat</i>astrophically wrong. Please report this to a developer, and include the error code below:<br><br><code>WELCOME_TEMPLATE_LOOP</code>",
                            "dev",
                            -1,
                        )) ?? { valid: false };

                    if (!template)
                        return { valid: false, reason: "Selected welcome template does not exist." };

                    DONT_CRASH_ANY_COMPUTERS_PLEASE.add(template);
                }

                const content = `{{subst:${template.template}}}${template.sign ? ` ~~~~` : ""}`;
                return await ws.api.append(page, null, content, ws.api.summary(`Welcome to Wikipedia!`));
            })();
        },
        successful: (ws, item, params) => {
            ws.store.statistics.users_welcomed.total++;

            ws.queue.talks.set(item.user.name, true);
            ws.gui.renderQueue();
        }
    },

    "watch-page": {
        title: "Watch page",
        icon: "fas fa-eye",

        progress: "Watching page",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be watched when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            return await ws.api.watchPage(item.page.title, ws.util.utcString(ws.util.expiryToDate(ws.store.settings.expiry.watchlist)));
        },
        successful: (ws, item, params) => {
            ws.store.statistics.watchlist.watched++;
            ws.queue.watchlist.set(item.page.title, true);
        }
    },
    "unwatch-page": {
        title: "Unwatch page",
        icon: "fas fa-eye-slash",

        progress: "Unwatching page",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be unwatched when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            return await ws.api.unwatchPage(item.page.title);
        },
        successful: (ws, item, params) => {
            ws.store.statistics.watchlist.unwatched++;
            ws.queue.watchlist.set(item.page.title, false);
        }
    },

    "whitelist-user": {
        title: "Add user to whitelist",
        icon: "fas fa-user-check",

        progress: "Adding user to whitelist",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be added to whitelist when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.whitelist.users.set(item.user.name, [ Date.now(), ws.util.expiryToDate(ws.store.settings.expiry.whitelist.users).valueOf() ]);
            ws.store.statistics.items_whitelisted.total++;
            ws.store.statistics.items_whitelisted.users++;

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "unwhitelist-user": {
        title: "Remove user from whitelist",
        icon: "fas fa-user-minus",

        progress: "Removing user from whitelist",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be removed from whitelist when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.whitelist.users.delete(item.user.name);

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "whitelist-page": {
        title: "Add page to whitelist",
        icon: "fas fa-check",

        progress: "Adding page to whitelist",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be added to whitelist when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.whitelist.pages.set(item.page.title, [ Date.now(), ws.util.expiryToDate(ws.store.settings.expiry.whitelist.pages).valueOf() ]);
            ws.store.statistics.items_whitelisted.total++;
            ws.store.statistics.items_whitelisted.pages++;

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "unwhitelist-page": {
        title: "Remove page from whitelist",
        icon: "fas fa-minus",

        progress: "Removing page from whitelist",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be removed from whitelist when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.whitelist.pages.delete(item.page.title);

            ws.gui.renderQueue();
            return { valid: true };
        }
    },

    "highlight-user": {
        title: "Add user to highlighted users",
        icon: "fas fa-star",

        progress: "Adding user to highlighted users",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be added to highlighted users when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.highlight.users.set(item.user.name, [ Date.now(), ws.util.expiryToDate(ws.store.settings.expiry.highlight.users).valueOf() ]);
            ws.store.statistics.items_highlighted.total++;
            ws.store.statistics.items_highlighted.users++;

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "unhighlight-user": {
        title: "Remove user from highlighted users",
        icon: "fas fa-user-minus",

        progress: "Removing user from highlighted users",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User can only be removed from highlighted users when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.highlight.users.delete(item.user.name);

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "highlight-page": {
        title: "Add page to highlighted pages",
        icon: "fas fa-star",

        progress: "Adding page to highlighted pages",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be added to highlighted pages when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.highlight.pages.set(item.page.title, [ Date.now(), ws.util.expiryToDate(ws.store.settings.expiry.highlight.pages).valueOf() ]);
            ws.store.statistics.items_highlighted.total++;
            ws.store.statistics.items_highlighted.pages++;

            ws.gui.renderQueue();
            return { valid: true };
        }
    },
    "unhighlight-page": {
        title: "Remove page from highlighted pages",
        icon: "fas fa-minus",

        progress: "Removing page from highlighted pages",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be removed from highlighted pages when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.store.highlight.pages.delete(item.page.title);

            ws.gui.renderQueue();
            return { valid: true };
        }
    },

    "refresh-user-contributions": {
        title: "Refresh user contributions",
        icon: "fas fa-rotate",

        progress: "Refreshing user contributions",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User contributions can only be refreshed when an item is selected." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            try {
                document.querySelector("#refresh-page-history").classList.add("refreshing");

                const user = (await ws.api.parseUsers([ item.user.name ]))[0].user;

                ws.queue.talks.set(item.user.name, user.talk);
                ws.queue.contributions.set(item.user.name, user.contributions);
                ws.queue.blocked.set(item.user.name, user.blocked);
                ws.queue.blocks.set(item.user.name, user.blocks);

                item.user.edits = Math.max(user.edits, user.contributions?.length || 0)
                item.user.warning = ws.queue.getWarningLevel(user.talk || "");
                item.user.warnings = ws.queue.getWarningHistory(user.talk || "");

                delete item.user.cached_contributions

                ws.gui.renderQueue();
                if (ws.queue.current.item === item)
                    ws.gui.newCurrentItem(item);

                return { valid: true };
            } catch (err) {
                console.error(err);
                return { valid: false, reason: "An error occurred while fetching user contributions." };
            }
        }
    },
    "refresh-page-history": {
        title: "Refresh page history",
        icon: "fas fa-rotate",

        progress: "Refreshing page history",
        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page history can only be refreshed when an item is selected." };
            else if (item.type === "users")
                return { valid: false, reason: "Page history cannot be refreshed for user creations." };
            return { valid: true };
        },
        script: async (ws, item, params) => {
            try {
                document.querySelector("#refresh-page-history").classList.add("refreshing");

                const [ history, detailsData ] = await Promise.all([
                    ws.api.getHistory(item.page.title),
                    ws.api.getPagesDetails(item.page.title)
                ]);
                const details = detailsData[item.page.title];

                ws.queue.histories.set(item.page.title, history);

                item.page.metadata = details.metadata;
                item.page.categories = details.categories;
                item.page.protection = details.protection;

                delete item.page.cached_history;

                ws.gui.renderQueue();
                if (ws.queue.current.item === item)
                    ws.gui.newCurrentItem(item);

                return { valid: true };
            } catch (err) {
                console.error(err);
                return { valid: false, reason: "An error occurred while fetching page history." };
            }
        }
    },

    "open-user-page": {
        title: "Open user page",
        icon: "fas fa-circle-user",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User page can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`User:${item.user.name}`));
            return { valid: true };
        }
    },
    "open-user-talk": {
        title: "Open user talk page",
        icon: "fas fa-comment",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User talk page can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`User talk:${item.user.name}`));
            return { valid: true };
        }
    },
    "open-user-contributions": {
        title: "Open user contributions",
        icon: "fas fa-list",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User contributions can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`Special:Contributions/${item.user.name}`));
            return { valid: true };
        }
    },
    "open-user-filter-log": {
        title: "Open user filter log",
        icon: "fas fa-filter",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "User filter log can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`?title=Special:AbuseLog&wpSearchUser=${encodeURIComponent(item.user.name)}`, true));
            return { valid: true };
        }
    },

    "open-page": {
        title: "Open page",
        icon: "fas fa-file",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(item.page.title));
            return { valid: true };
        }
    },
    "open-page-talk": {
        title: "Open page talk",
        icon: "fas fa-comments",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page talk can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const title = item.page.title.split(":");
            let ns = "Talk";
            if (title.length > 1)
                ns = title[0].toLowerCase().includes("talk") ? title[0] : `${title[0]} talk`;

            const page = ws.page(`${ns}:${title.length === 1 ? title[0] : title.slice(1).join(":")}`);
            ws.open(page);
            return { valid: true };
        }
    },
    "open-page-history": {
        title: "Open page history",
        icon: "fas fa-clock-rotate-left",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Page history can only be opened when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`Special:PageHistory/${item.page.title}`));
            return { valid: true };
        }
    },

    "open-revision": {
        title: "Open revision",
        icon: "fas fa-file-lines",

        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Revision can only be opened for edits." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`Special:Permalink/${item.id}`));
            return { valid: true };
        }
    },
    "open-diff": {
        title: "Open diff",
        icon: "fas fa-code-compare",

        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Diff can only be opened for edits." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.open(ws.page(`Special:Diff/${item.id}`));
            return { valid: true };
        }
    },

    "copy-link": {
        title: "Copy link",
        icon: "fas fa-link",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Link can only be copied when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            if (item.group === "edit")
                navigator.clipboard.writeText(ws.page(`?diff=${item.id}`, true));
            else if (item.group === "logevent")
                navigator.clipboard.writeText(ws.page(`?title=Special:Log&logid=${item.id}`, true));
            else if (item.group === "abuselog") {
                if (item.revid)
                    navigator.clipboard.writeText(ws.page(`?diff=${item.revid}`, true));
                else
                    navigator.clipboard.writeText(ws.page(`?title=Special:AbuseLog/${item.id}`, true));
            } else {
                ws.gui.dialog.toast(
                    "Cannot copy link",
                    `Please report this issue to a developer, including the error code below:<br><br><code>UNKNOWN_ITEM_GROUP_FOR_LINK_COPY</code>`,
                    "error",
                    3000,
                );
                return { valid: false };
            }

            ws.gui.dialog.toast(
                "Link copied",
                `The link has been copied to your clipboard.`,
                "success",
                3000,
            );
            return { valid: true };
        }
    },

    "open-revert-menu": {
        title: "Open revert menu",
        icon: "fas fa-undo",

        valid: (ws, item, params) => {
            let type = item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Revert menu is only available for edits." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $button = document.querySelector('[data-menu="revert"]');

            const $container = document.querySelector("#revert-menu");
            $container.innerHTML = "";
            ws.gui.createWarnMenu("reverts", $container, item);

            if ($button) {
                const $trigger = $button.querySelector('.bottom-tool-trigger');
                const $menu = document.querySelector(`#${$button.dataset.menu}-menu`);
                if ($trigger && $menu) {
                    if ($menu.classList.contains('show')) {
                        $menu.classList.remove('show');
                        $trigger.classList.remove('active');
                    } else {
                        ws.gui.closeMenus();

                        $menu.classList.add('show');
                        $trigger.classList.add('active');

                        ws.gui.positionBottomMenu($button, $menu);
                    }
                }
            }

            return { valid: true };
        }
    },
    "open-warn-menu": {
        title: "Open warn menu",
        icon: "fas fa-exclamation-triangle",

        valid: (ws, item, params) => {
            if (!item)
                return { valid: false, reason: "Warning menu is only available when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $button = document.querySelector('[data-menu="warn"]');

            const $container = document.querySelector("#warn-menu");
            $container.innerHTML = "";
            ws.gui.createWarnMenu("warnings", $container, item);

            if ($button) {
                const $trigger = $button.querySelector('.bottom-tool-trigger');
                const $menu = document.querySelector(`#${$button.dataset.menu}-menu`);
                if ($trigger && $menu) {
                    if ($menu.classList.contains('show')) {
                        $menu.classList.remove('show');
                        $trigger.classList.remove('active');
                    } else {
                        ws.gui.closeMenus();

                        $menu.classList.add('show');
                        $trigger.classList.add('active');

                        ws.gui.positionBottomMenu($button, $menu);
                    }
                }
            }

            return { valid: true };
        }
    },
    "open-user-menu": {
        title: "Open user menu",
        icon: "fas fa-flag",

        valid: (ws, item, params) => {
            if (!ws.queue.current.item)
                return { valid: false, reason: "User menu is only available when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $button = document.querySelector('[data-menu="user"]');
            if ($button) {
                const $trigger = $button.querySelector('.bottom-tool-trigger');
                const $menu = document.querySelector(`#${$button.dataset.menu}-menu`);
                if ($trigger && $menu) {
                    if ($menu.classList.contains('show')) {
                        $menu.classList.remove('show');
                        $trigger.classList.remove('active');
                    } else {
                        ws.gui.closeMenus();

                        $menu.classList.add('show');
                        $trigger.classList.add('active');

                        ws.gui.positionBottomMenu($button, $menu);
                    }
                }
            }

            return { valid: true };
        }
    },
    "open-page-menu": {
        title: "Open page menu",
        icon: "fas fa-flag",

        valid: (ws, item, params) => {
            if (!ws.queue.current.item)
                return { valid: false, reason: "Page menu is only available when an item is selected." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $button = document.querySelector('[data-menu="page"]');
            if ($button) {
                const $trigger = $button.querySelector('.bottom-tool-trigger');
                const $menu = document.querySelector(`#${$button.dataset.menu}-menu`);
                if ($trigger && $menu) {
                    if ($menu.classList.contains('show')) {
                        $menu.classList.remove('show');
                        $trigger.classList.remove('active');
                    } else {
                        ws.gui.closeMenus();

                        $menu.classList.add('show');
                        $trigger.classList.add('active');

                        ws.gui.positionBottomMenu($button, $menu);
                    }
                }
            }

            return { valid: true };
        }
    },
    "open-edit-menu": {
        title: "Open edit menu",
        icon: "fas fa-flag",

        valid: (ws, item, params) => {
            let type = ws.queue.current.item.type;
            if (type === "abuselog" && item.revid)
                type = "edit"; // treat abuse log items with revids as edits for the sake of the revert menu

            if (Queue.groups[type] !== "edit")
                return { valid: false, reason: "Edit menu is only available for edits." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $button = document.querySelector('[data-menu="edit"]');
            if ($button) {
                const $trigger = $button.querySelector('.bottom-tool-trigger');
                const $menu = document.querySelector(`#${$button.dataset.menu}-menu`);
                if ($trigger && $menu) {
                    if ($menu.classList.contains('show')) {
                        $menu.classList.remove('show');
                        $trigger.classList.remove('active');
                    } else {
                        ws.gui.closeMenus();

                        $menu.classList.add('show');
                        $trigger.classList.add('active');

                        ws.gui.positionBottomMenu($button, $menu);
                    }
                }
            }

            return { valid: true };
        }
    },

    "switch-to-recent-queue": {
        title: "Switch to recent changes queue",
        icon: "fas fa-stopwatch",

        valid: (ws, item, params) => {
            if (!ws.store.settings.queue.recent.enabled)
                return { valid: false, reason: "Recent changes queue is not enabled." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.switch("recent");
            return { valid: true };
        }
    },
    "switch-to-pending-queue": {
        title: "Switch to pending changes queue",
        icon: "fas fa-flag",

        valid: (ws, item, params) => {
            if (!ws.store.settings.queue.pending.enabled)
                return { valid: false, reason: "Pending changes queue is not enabled." };
            else if (!ws.rights.review)
                return { valid: false, reason: "You do not have permission to review pending changes." };
            else if (!ws.api.hasPendingChanges)
                return { valid: false, reason: "The pending changes extension is not enabled on this wiki." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.switch("pending");
            return { valid: true };
        }
    },
    "switch-to-watchlist-queue": {
        title: "Switch to watchlist queue",
        icon: "fas fa-book-bookmark",

        valid: (ws, item, params) => {
            if (!ws.store.settings.queue.watchlist.enabled)
                return { valid: false, reason: "Watchlist queue is not enabled." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.switch("watchlist");
            return { valid: true };
        }
    },
    "switch-to-users-queue": {
        title: "Switch to user creation logs queue",
        icon: "fas fa-user-plus",

        valid: (ws, item, params) => {
            if (!ws.store.settings.queue.users.enabled)
                return { valid: false, reason: "User creation logs queue is not enabled." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.switch("users");
            return { valid: true };
        }
    },
    "switch-to-abuselog-queue": {
        title: "Switch to abuse log queue",
        icon: "fas fa-filter-circle-xmark",

        valid: (ws, item, params) => {
            if (!ws.store.settings.queue.abuselog.enabled)
                return { valid: false, reason: "Abuse log queue is not enabled." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            ws.queue.switch("abuselog");
            return { valid: true };
        }
    },

    "toggle-zen-mode": {
        title: "Toggle zen mode",
        icon: "fas fa-spa",

        script: (ws, item, params) => {
            ws.store.settings.zen_mode.enabled = !ws.store.settings.zen_mode.enabled;
            document.querySelector('#zen-mode-enable')?.classList.toggle("active", ws.store.settings.zen_mode.enabled);

            ws.gui.updateZenMode();

            return { valid: true };
        }
    },
    "toggle-consecutive-edits": {
        title: "Toggle consecutive edits",
        icon: "fas fa-users",

        valid: (ws, item, params) => {
            const type = ws.queue.current.type;
            if (type !== "recent" && type !== "watchlist")
                return { valid: false, reason: "Consecutive edits can only be viewed in the recent changes or watchlist queues." };
            return { valid: true };
        },
        script: (ws, item, params) => {
            const $consecutive = document.querySelector("#consecutive-edits-tab");
            if (!$consecutive.classList.contains("hidden")) {
                if ($consecutive.classList.contains("selected"))
                    document.querySelector("#latest-edits-tab").click();
                else
                    $consecutive.click();
            }

            return { valid: true };
        }
    },
};
