// DO NOT CHANGE THIS FILE

import { isObject, isURL } from "../utility.js";
import { namespaces } from "../../namespaces.js";
import { warningsLookup } from "../../warnings.js";
import { events } from "../../../config/events.js";
import { conditions } from "../../../config/conditions.js";
import { validateShortcut } from "../../../config/control-keys.js";
import { expiryRegex } from "../../../utilities/helpers.js";
import { sortDependencies } from "../../../utilities/scripts.js";
import { GUI } from "../../../ui/gui.js";

import { Version } from "../versions.js";

Version.v3 = class V3 extends Version {
    static number = 3;
    static get default() {
        return {
            version: 3,

            changelog: "6",

            settings: {
                performance: {
                    startup: "adaptive",
                },

                namespaces: [ 0 ],

                queue: {
                    max_size: 100,
                    max_edits: 50,
                    min_ores: .0,

                    ores_bias: .5,

                    recent: {
                        enabled: true,
                        order: 0,
                    },
                    pending: {
                        enabled: true,
                        order: 1,
                    },
                    users: {
                        enabled: false,
                        order: 2,
                    },
                    watchlist: {
                        enabled: true,
                        order: 3,
                    },
                    abuselog: {
                        enabled: true,
                        order: 4,
                    }
                },

                username_highlighting: {
                    enabled: true,
                    fuzzy: false,
                },

                wikipedia_popups: {
                    enabled: true,
                },

                auto_welcome: {
                    enabled: false,
                },

                talk_page_thanks_for_temporary_users: {
                    enabled: true
                },

                expiry: {
                    watchlist: "1W",

                    whitelist: {
                        users: "infinity",
                        pages: "infinity",
                        tags: "infinity",
                    },
                    highlight: {
                        users: "1W",
                        pages: "1W",
                        tags: "1W",
                    },
                },

                auto_report: {
                    enabled: true,

                    for: [
                        "Vandalism", "Subtle vandalism", "Image vandalism", "Sandbox", "Deliberate errors",

                        "Disruptive editing", "Editing tests", "Commentary", "Inappropriate jokes", "Deleting",

                        "Unsourced", "Unsourced (BLP)", "Unsourced genre", "Original research", /* "POV", */
                        "Censoring", "AI-generated", "AI-generated (talk)", /* "MOS violation", */ /* "Not English", */

                        "Personal attacks", "Harassment", "TPO", /* "Chatting", */ /* "Owning", */
                        "AfD removal", /* "Gaming the system", */

                        "Advertising", "Spam links",

                        "Attempt",

                        "Inappropriate edit summary", "Misleading edit summary"
                    ], // imported as array, stored as Set
                },

                AI: {
                    enabled: false,
                    provider: "Ollama",

                    edit_analysis: {
                        enabled: true,
                    },
                    username_analysis: {
                        enabled: true,
                    },

                    Ollama: {
                        "server": "http://localhost:11434",
                        "model": "",
                    }
                },

                audio: {
                    ores_alert: {
                        enabled: true,
                        threshold: .95
                    },

                    volume: {
                        "master": 1,
                        "master.startup": 1,

                        "master.music": 1,
                        "master.music.zen_mode": 1,

                        "master.ui": 1,
                        "master.ui.click": .05,

                        "master.queue": 1,
                        "master.queue.ores": 1,
                        "master.queue.mention": 1,

                        "master.notification": 1,
                        "master.notification.alert": .7,
                        "master.notification.message": .5,
                        "master.notification.toast": .5,

                        "master.action": 1,
                        "master.action.default": .6,
                        "master.action.failed": .85,
                        "master.action.report": 1,
                        "master.action.block": 1,
                        "master.action.protect": 1,
                    }
                },

                zen_mode: {
                    enabled: false,

                    sound: {
                        enabled: true,
                    },
                    music: {
                        enabled: true,
                    },

                    alerts: {
                        enabled: true,
                    },
                    messages: {
                        enabled: false,
                    },
                    toasts: {
                        enabled: false,
                    },

                    badges: {
                        enabled: false,
                    },
                },

                accessibility: {
                    colorblind: false,
                    dyslexia: false,

                    high_contrast: false,

                    reduce_motion: false,
                },

                repeat_control_scripts: true
            },
            UI: {
                theme: {
                    app: "auto",
                    palette: "traffic",
                },
                queue: {
                    width: "15vw",
                },
                details: {
                    width: "15vw",
                }
            },
            control_scripts: [
                {
                    keys: [ "arrowright", " " ],
                    actions: [
                        {
                            name: "next-item",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "arrowleft" ],
                    actions: [
                        {
                            name: "previous-item",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "q" ],
                    actions: [
                        {
                            name: "next-item",
                            params: { }
                        },
                        {
                            name: "revert",
                            params: {
                                warning: "Vandalism"
                            }
                        },
                        {
                            name: "highlight-user",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "h" ],
                    actions: [
                        {
                            name: "open-page-history",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "c" ],
                    actions: [
                        {
                            name: "open-user-contributions",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "t" ],
                    actions: [
                        {
                            name: "thank-user",
                            params: { }
                        }
                    ]
                },
                {
                    keys: [ "w" ],
                    actions: [
                        {
                            name: "welcome-user",
                            params: { }
                        }
                    ]
                }
            ],
            statistics: {
                edits_reviewed: {
                    total: 0,

                    thanked: 0,
                },

                recent_changes_reviewed: {
                    total: 0,
                },
                pending_changes_reviewed: {
                    total: 0,

                    accepted: 0,
                    rejected: 0,
                },
                watchlist_changes_reviewed: {
                    total: 0,
                },
                users_reviewed: {
                    total: 0,
                },
                abuselogs_reviewed: {
                    total: 0,
                },

                reverts_made: {
                    total: 0,
                    good_faith: 0,

                    from_recent_changes: 0,
                    from_pending_changes: 0,
                    from_watchlist: 0,
                    from_abuselogs: 0,
                    from_loaded_edits: 0,
                },

                users_welcomed: {
                    total: 0,
                },

                warnings_issued: {
                    total: 0,

                    level_1: 0,
                    level_2: 0,
                    level_3: 0,
                    level_4: 0,
                    level_4im: 0,
                },
                reports_filed: {
                    total: 0,

                    AIV: 0,
                    UAA: 0,
                    RFPP: 0,

                    global_blocks: 0,
                    global_locks: 0,
                },

                watchlist: {
                    watched: 0,
                    unwatched: 0
                },

                items_whitelisted: {
                    total: 0,

                    users: 0,
                    pages: 0,
                    tags: 0,
                },
                items_highlighted: {
                    total: 0,

                    users: 0,
                    pages: 0,
                    tags: 0,
                },

                blocks_issued: {
                    total: 0,
                },
                pages_protected: {
                    total: 0,
                },

                actions_executed: {
                    total: 0,

                    successful: 0
                },

                session_time: 0 // in milliseconds
            },
            highlight: {
                users: [ ], // imported as array, stored as Map
                pages: [ ], // imported as array, stored as Map
                tags: [ ], // imported as array, stored as Map
            },
            whitelist: {
                users: [ ], // imported as array, stored as Map
                pages: [ ], // imported as array, stored as Map
                tags: [ ], // imported as array, stored as Map
            },
            favorite: {
                warnings: [ ],
                reverts: [ ],
            }
        };
    }

    static upgrade() {
        if (this.loadedData.version !== this.number - 1) {
            this.loadedLogger.dev(`[INVALID_UPGRADE_ATTEMPT] Attempted to upgrade from version ${this.loadedData.version} to version ${this.number}, but this upgrade method only supports upgrades from version ${this.number - 1}.`);
            throw new Error("INVALID_UPGRADE_ATTEMPT");
        }

        this.deprecated("settings", "cloud_storage");

        // properties without sanitization did not exist in the previous version
        const defaults = this.default;
        return {
            changelog: this.sanitize([ "changelog" ], defaults.changelog),

            settings: {
                performance: {
                    startup: this.sanitize([ "settings", "performance", "startup" ], defaults.settings.performance.startup),
                },

                namespaces: this.sanitize([ "settings", "namespaces" ], defaults.settings.namespaces),

                queue: {
                    max_size: this.sanitize([ "settings", "queue", "max_size" ], defaults.settings.queue.max_size),
                    max_edits: this.sanitize([ "settings", "queue", "max_edits" ], defaults.settings.queue.max_edits),
                    min_ores: this.sanitize([ "settings", "queue", "min_ores" ], defaults.settings.queue.min_ores),

                    ores_bias: defaults.settings.queue.ores_bias,

                    recent: {
                        enabled: this.sanitize([ "settings", "queue", "recent", "enabled" ], defaults.settings.queue.recent.enabled),
                        order: this.sanitize([ "settings", "queue", "recent", "order" ], defaults.settings.queue.recent.order),
                    },
                    pending: {
                        enabled: this.sanitize([ "settings", "queue", "flagged", "enabled" ], defaults.settings.queue.pending.enabled),
                        order: this.sanitize([ "settings", "queue", "flagged", "order" ], defaults.settings.queue.pending.order),
                    },
                    users: {
                        enabled: this.sanitize([ "settings", "queue", "users", "enabled" ], defaults.settings.queue.users.enabled),
                        order: this.sanitize([ "settings", "queue", "users", "order" ], defaults.settings.queue.users.order),
                    },
                    watchlist: {
                        enabled: this.sanitize([ "settings", "queue", "watchlist", "enabled" ], defaults.settings.queue.watchlist.enabled),
                        order: this.sanitize([ "settings", "queue", "watchlist", "order" ], defaults.settings.queue.watchlist.order),
                    },
                    abuselog: {
                        enabled: defaults.settings.queue.abuselog.enabled,
                        order: defaults.settings.queue.abuselog.order,
                    },
                },

                username_highlighting: {
                    enabled: this.sanitize([ "settings", "username_highlighting", "enabled" ], defaults.settings.username_highlighting.enabled),
                    fuzzy: this.sanitize([ "settings", "username_highlighting", "fuzzy" ], defaults.settings.username_highlighting.fuzzy),
                },

                wikipedia_popups: {
                    enabled: defaults.settings.wikipedia_popups.enabled,
                },

                auto_welcome: {
                    enabled: this.sanitize([ "settings", "auto_welcome", "enabled" ], defaults.settings.auto_welcome.enabled),
                },

                talk_page_thanks_for_temporary_users: {
                    enabled: defaults.settings.talk_page_thanks_for_temporary_users.enabled,
                },

                expiry: {
                    watchlist: this.sanitize([ "settings", "expiry", "watchlist" ], defaults.settings.expiry.watchlist, value => ({
                        "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                    })[value]),
                    whitelist: {
                        users: this.sanitize([ "settings", "expiry", "whitelist", "users" ], defaults.settings.expiry.whitelist.users, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                        pages: this.sanitize([ "settings", "expiry", "whitelist", "pages" ], defaults.settings.expiry.whitelist.pages, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                        tags: this.sanitize([ "settings", "expiry", "whitelist", "tags" ], defaults.settings.expiry.whitelist.tags, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                    },
                    highlight: {
                        users: this.sanitize([ "settings", "expiry", "highlight", "users" ], defaults.settings.expiry.highlight.users, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                        pages: this.sanitize([ "settings", "expiry", "highlight", "pages" ], defaults.settings.expiry.highlight.pages, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                        tags: this.sanitize([ "settings", "expiry", "highlight", "tags" ], defaults.settings.expiry.highlight.tags, value => ({
                            "none": "", "1 hour": "1h", "1 day": "1D", "1 week": "1W", "1 month": "1M", "3 months": "3M", "6 months": "6M", "indefinite": "infinity"
                        })[value]),
                    },
                },

                auto_report: {
                    enabled: this.sanitize([ "settings", "auto_report", "enabled" ], defaults.settings.auto_report.enabled),

                    for: this.sanitize([ "settings", "auto_report", "for" ], defaults.settings.auto_report.for, value => {
                        if (!Array.isArray(value))
                            return undefined;

                        const set = new Set([ "Attempt" ]); // add some default reports
                        value.forEach(v => set.add(v));

                        return [ ...set ];
                    }),
                },

                AI: {
                    enabled: this.sanitize([ "settings", "AI", "enabled" ], defaults.settings.AI.enabled),
                    provider: this.sanitize([ "settings", "AI", "provider" ], defaults.settings.AI.provider),

                    edit_analysis: {
                        enabled: this.sanitize([ "settings", "AI", "edit_analysis", "enabled" ], defaults.settings.AI.edit_analysis.enabled),
                    },
                    username_analysis: {
                        enabled: this.sanitize([ "settings", "AI", "username_analysis", "enabled" ], defaults.settings.AI.username_analysis.enabled),
                    },

                    Ollama: {
                        "server": this.sanitize([ "settings", "AI", "Ollama", "server" ], defaults.settings.AI.Ollama.server),
                        "model": this.sanitize([ "settings", "AI", "Ollama", "model" ], defaults.settings.AI.Ollama.model),
                    }
                },

                audio: {
                    ores_alert: {
                        enabled: this.sanitize([ "settings", "audio", "ores_alert", "enabled" ], defaults.settings.audio.ores_alert.enabled),
                        threshold: this.sanitize([ "settings", "audio", "ores_alert", "threshold" ], defaults.settings.audio.ores_alert.threshold)
                    },

                    volume: {
                        "master": this.sanitize([ "settings", "audio", "volume", "master" ], defaults.settings.audio.volume.master),
                        "master.startup": this.sanitize([ "settings", "audio", "volume", "master.startup" ], defaults.settings.audio.volume["master.startup"]),

                        "master.music": this.sanitize([ "settings", "audio", "volume", "master.music" ], defaults.settings.audio.volume["master.music"]),
                        "master.music.zen_mode": this.sanitize([ "settings", "audio", "volume", "master.music.zen_mode" ], defaults.settings.audio.volume["master.music.zen_mode"]),

                        "master.ui": this.sanitize([ "settings", "audio", "volume", "master.ui" ], defaults.settings.audio.volume["master.ui"]),
                        "master.ui.click": this.sanitize([ "settings", "audio", "volume", "master.ui.click" ], defaults.settings.audio.volume["master.ui.click"]),

                        "master.queue": this.sanitize([ "settings", "audio", "volume", "master.queue" ], defaults.settings.audio.volume["master.queue"]),
                        "master.queue.ores": this.sanitize([ "settings", "audio", "volume", "master.queue.ores" ], defaults.settings.audio.volume["master.queue.ores"]),
                        "master.queue.mention": this.sanitize([ "settings", "audio", "volume", "master.queue.mention" ], defaults.settings.audio.volume["master.queue.mention"]),

                        "master.notification": this.sanitize([ "settings", "audio", "volume", "master.notification" ], defaults.settings.audio.volume["master.notification"]),
                        "master.notification.alert": this.sanitize([ "settings", "audio", "volume", "master.notification.alert" ], defaults.settings.audio.volume["master.notification.alert"]),
                        "master.notification.message": this.sanitize([ "settings", "audio", "volume", "master.notification.notice" ], defaults.settings.audio.volume["master.notification.message"]),
                        "master.notification.toast": this.sanitize([ "settings", "audio", "volume", "master.notification.toast" ], defaults.settings.audio.volume["master.notification.toast"]),

                        "master.action": this.sanitize([ "settings", "audio", "volume", "master.action" ], defaults.settings.audio.volume["master.action"]),
                        "master.action.default": this.sanitize([ "settings", "audio", "volume", "master.action.default" ], defaults.settings.audio.volume["master.action.default"]),
                        "master.action.failed": this.sanitize([ "settings", "audio", "volume", "master.action.failed" ], defaults.settings.audio.volume["master.action.failed"]),
                        "master.action.report": this.sanitize([ "settings", "audio", "volume", "master.action.report" ], defaults.settings.audio.volume["master.action.report"]),
                        "master.action.block": this.sanitize([ "settings", "audio", "volume", "master.action.block" ], defaults.settings.audio.volume["master.action.block"]),
                        "master.action.protect": this.sanitize([ "settings", "audio", "volume", "master.action.protect" ], defaults.settings.audio.volume["master.action.protect"]),
                    },
                },

                zen_mode: {
                    enabled: this.sanitize([ "settings", "zen_mode", "enabled" ], defaults.settings.zen_mode.enabled),

                    sound: {
                        enabled: this.sanitize([ "settings", "zen_mode", "sound", "enabled" ], defaults.settings.zen_mode.sound.enabled),
                    },
                    music: {
                        enabled: this.sanitize([ "settings", "zen_mode", "music", "enabled" ], defaults.settings.zen_mode.music.enabled),
                    },

                    alerts: {
                        enabled: this.sanitize([ "settings", "zen_mode", "alerts", "enabled" ], defaults.settings.zen_mode.alerts.enabled),
                    },
                    messages: {
                        enabled: this.sanitize([ "settings", "zen_mode", "notices", "enabled" ], defaults.settings.zen_mode.messages.enabled),
                    },
                    toasts: {
                        enabled: this.sanitize([ "settings", "zen_mode", "toasts", "enabled" ], defaults.settings.zen_mode.toasts.enabled),
                    },

                    badges: {
                        enabled: this.sanitize([ "settings", "zen_mode", "badges", "enabled" ], defaults.settings.zen_mode.badges.enabled),
                    },
                },

                accessibility: {
                    colorblind: defaults.settings.accessibility.colorblind,
                    dyslexia: defaults.settings.accessibility.dyslexia,

                    high_contrast: defaults.settings.accessibility.high_contrast,

                    reduce_motion: defaults.settings.accessibility.reduce_motion,
                },

                repeat_control_scripts: this.sanitize([ "settings", "repeat_control_scripts" ], defaults.settings.repeat_control_scripts),
            },
            UI: {
                theme: {
                    app: defaults.UI.theme.app,
                    palette: this.sanitize([ "UI", "theme", "palette" ], defaults.UI.theme.palette, value => {
                        return [ "traffic", "heat", "natural", "cool" ][value] || defaults.UI.theme.palette;
                    })
                },
                queue: {
                    width: this.sanitize([ "UI", "queue", "width" ], defaults.UI.queue.width),
                },
                details: {
                    width: this.sanitize([ "UI", "details", "width" ], defaults.UI.details.width),
                }
            },
            control_scripts: this.sanitize([ "control_scripts" ], defaults.control_scripts, (value) => {
                if (Array.isArray(value)) {
                    function updateActions(actions, ...path) {
                        return actions.filter((action, index) => {
                            index = +index;

                            if (!isObject(action))
                                return true; // malformed but don't care here

                            if (action.name === "if" || action.name === "if not") {
                                const not = action.name === "if not";
                                const swap = () => action.name = not ? "if" : "if not";

                                if (typeof action.condition === "string")
                                    action.condition = { name: action.condition, params: { } };
                                action.condition.params ??= { };

                                switch (action.condition.name) {
                                    case "operatorNonAdmin": {
                                        swap();
                                    } case "operatorAdmin": {
                                        action.condition.name = "account-admin";
                                    } break;

                                    case "userIsHighlighted": {
                                        action.condition.name = "username-highlighted";
                                    } break;
                                    case "userIsWhitelisted": {
                                        action.condition.name = "username-whitelisted";
                                    } break;
                                    case "pageIsWhitelisted": {
                                        action.condition.name = "page-whitelisted";
                                    } break;

                                    case "userIsAnon": {
                                        swap();
                                    } case "userIsRegistered": {
                                        action.codition.name = "user-registered";
                                    } break;
                                    case "userIsIP": {
                                        action.condition.name = "user-ip";
                                    } break;
                                    case "userIsTemp": {
                                        action.condition.name = "user-temp";
                                    } break;
                                    case "userHasEmptyTalkPage": {
                                        action.condition.name = "user-empty-talk";
                                    } break;

                                    case "editIsMajor": {
                                        swap();
                                    } case "editIsMinor": {
                                        action.condition.name = "edit-minor";
                                    } break;
                                    case "editSizeNegative": {
                                        action.condition.name = "edit-size";
                                        action.condition.params = { condition: "<", size: 0 };
                                    } break;
                                    case "editSizePositive": {
                                        action.condition.name = "edit-size";
                                        action.condition.params = { condition: ">", size: 0 };
                                    } break;
                                    case "editSizeLarge": {
                                        action.condition.name = "abs-edit-size";
                                        action.condition.params = { condition: "≥", size: 1000 };
                                    } break;

                                    case "userEditCountLow": {
                                        action.condition.name = "user-edit-count";
                                        action.condition.params = { condition: "<", count: 10 };
                                    } break;
                                    case "userEditCountHigh": {
                                        action.condition.name = "user-edit-count";
                                        action.condition.params = { condition: "≥", count: 100 };
                                    } break;

                                    case "atFinalWarning": {
                                        action.condition.name = "user-final-warning";
                                    } break;
                                    case "userNoWarnings": {
                                        swap();
                                    } case "userHasWarnings": {
                                        action.condition.name = "user-has-warnings";
                                    } break;
                                }

                                if (!(action.condition.name in conditions))
                                    return true; // malformed but don't care here
                                if (!Array.isArray(action.actions))
                                    return true; // malformed but don't care here

                                action.actions = updateActions.call(this, action.actions, ...path, index, "actions");
                            } else {
                                action.params ??= { };
                                switch (action.name) {
                                    case "toggleZenMode": { action.name = "toggle-zen-mode"; } break;
                                    case "acceptFlaggedEdit": {
                                        action.name = "accept-pending-edit";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.summary = action.params.reason;
                                        delete action.params.reason;
                                    } break;
                                    case "rejectFlaggedEdit": {
                                        action.name = "reject-pending-edit";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.summary = action.params.reason;
                                        delete action.params.reason;
                                    } break;
                                    case "prevEdit": { action.name = "previous-item"; } break;
                                    case "nextEdit": { action.name = "next-item"; } break;
                                    case "deleteQueue": { action.name = "clear-queue"; } break;
                                    case "openRevertMenu": { action.name = "open-revert-menu"; } break;
                                    case "openWarnMenu": { action.name = "open-warn-menu"; } break;
                                    case "openUserPage": { action.name = "open-user-page"; } break;
                                    case "openUserTalk": { action.name = "open-user-talk"; } break;
                                    case "openUserContribs": { action.name = "open-user-contributions"; } break;
                                    case "openFilterLog": { action.name = "open-user-filter-log"; } break;
                                    case "openPage": { action.name = "open-page"; } break;
                                    case "openTalk": { action.name = "open-page-talk"; } break;
                                    case "openHistory": { action.name = "open-page-history"; } break;
                                    case "openRevision": { action.name = "open-revision"; } break;
                                    case "openDiff": { action.name = "open-diff"; } break;
                                    case "switchToRecentQueue": { action.name = "switch-to-recent-queue"; } break;
                                    case "switchToFlaggedQueue": { action.name = "switch-to-pending-queue"; } break;
                                    case "switchToUsersQueue": { action.name = "switch-to-users-queue"; } break;
                                    case "switchToWatchlistQueue": { action.name = "switch-to-watchlist-queue"; } break;
                                    case "watchPage": { action.name = "watch-page"; } break;
                                    case "unwatchPage": { action.name = "unwatch-page"; } break;
                                    case "whitelistUser": { action.name = "whitelist-user"; } break;
                                    case "whitelistPage": { action.name = "whitelist-page"; } break;
                                    case "unwhitelistUser": { action.name = "unwhitelist-user"; } break;
                                    case "unwhitelistPage": { action.name = "unwhitelist-page"; } break;
                                    case "highlightUser": { action.name = "highlight-user"; } break;
                                    case "highlightPage": { action.name = "highlight-page"; } break;
                                    case "unwhitelistUser": { action.name = "unhighlight-user"; } break;
                                    case "unwhitelistPage": { action.name = "unhighlight-page"; } break;
                                    case "thankUser": { action.name = "thank-user"; } break;
                                    case "warn": { action.name = "warn-user"; } break;
                                    case "rollback": {
                                        action.name = "rollback-edit";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.hide_username = "No";
                                    } break;
                                    case "rollbackGoodFaith": {
                                        action.name = "rollback-goodfaith-edit";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.hide_username = "No";
                                    } break;
                                    case "undo": {
                                        action.name = "undo-edit";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.hide_username = "No";
                                    } break;
                                    case "reportToAIV": {
                                        action.name = "report-user-to-aiv";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.reason = action.params.reportMessage;
                                        delete action.params.reportMessage;

                                        action.params.summary = action.params.comment;
                                        delete action.params.comment;
                                    } break;
                                    case "reportToUAA": {
                                        action.name = "report-user-to-uaa";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.reason = action.params.reportMessage;
                                        delete action.params.reportMessage;

                                        action.params.summary = action.params.comment;
                                        delete action.params.comment;
                                    } break;
                                    case "requestProtection": {
                                        action.name = "request-page-protection";
                                        if (!isObject(action.params))
                                            return true;

                                        action.params.summary = action.params.comment;
                                        delete action.params.comment;
                                    } break;
                                    case "welcome": { action.name = "welcome-user"; } break;
                                    case "toggleConsecutive": { action.name = "toggle-consecutive-edits"; } break;

                                    case "block": {
                                        this.loadedLogger.warn(`Skipping deprecated action 'block' in control script at ${[...path, index].join(" -> ")}.`);
                                        return false; // removed
                                    } break;
                                    case "protect": {
                                        this.loadedLogger.warn(`Skipping deprecated action 'protect' in control script at ${[...path, index].join(" -> ")}.`);
                                        return false; // removed
                                    } break;
                                    case "openSettings": {
                                        this.loadedLogger.warn(`Skipping deprecated action 'openSettings' in control script at ${[...path, index].join(" -> ")}.`);
                                        return false; // removed
                                    }
                                }
                            }

                            return true;
                        });
                    }

                    value.forEach((scope2, index) => {
                        index = +index;
                        if (!isObject(scope2))
                            return;
                        if (!Array.isArray(scope2.keys))
                            return;
                        if (!Array.isArray(scope2.actions))
                            return;

                        scope2.actions = updateActions.call(this, scope2.actions, "control_scripts", index, "actions");
                    });

                    return value;
                }

                return undefined;
            }),
            statistics: {
                edits_reviewed: {
                    total: this.sanitize([ "statistics", "edits_reviewed", "total" ], defaults.statistics.edits_reviewed.total),

                    thanked: this.sanitize([ "statistics", "edits_reviewed", "thanked" ], defaults.statistics.edits_reviewed.thanked),
                },
                recent_changes_reviewed: {
                    total: this.sanitize([ "statistics", "recent_changes_reviewed", "total" ], defaults.statistics.recent_changes_reviewed.total),
                },
                pending_changes_reviewed: {
                    total: this.sanitize([ "statistics", "pending_changes_reviewed", "total" ], defaults.statistics.pending_changes_reviewed.total),

                    accepted: this.sanitize([ "statistics", "pending_changes_reviewed", "accepted" ], defaults.statistics.pending_changes_reviewed.accepted),
                    rejected: this.sanitize([ "statistics", "pending_changes_reviewed", "rejected" ], defaults.statistics.pending_changes_reviewed.rejected),
                },
                watchlist_changes_reviewed: {
                    total: this.sanitize([ "statistics", "watchlist_changes_reviewed", "total" ], defaults.statistics.watchlist_changes_reviewed.total),
                },
                users_reviewed: {
                    total: this.sanitize([ "statistics", "users_reviewed", "total" ], defaults.statistics.users_reviewed.total),
                },
                abuselogs_reviewed: {
                    total: defaults.statistics.abuselogs_reviewed.total,
                },
                reverts_made: {
                    total: this.sanitize([ "statistics", "reverts_made", "total" ], defaults.statistics.reverts_made.total),
                    good_faith: this.sanitize([ "statistics", "reverts_made", "good_faith" ], defaults.statistics.reverts_made.good_faith),

                    from_recent_changes: this.sanitize([ "statistics", "reverts_made", "from_recent_changes" ], defaults.statistics.reverts_made.from_recent_changes),
                    from_pending_changes: this.sanitize([ "statistics", "reverts_made", "from_pending_changes" ], defaults.statistics.reverts_made.from_pending_changes),
                    from_watchlist: this.sanitize([ "statistics", "reverts_made", "from_watchlist" ], defaults.statistics.reverts_made.from_watchlist),
                    from_abuselogs: defaults.statistics.reverts_made.from_abuselogs,
                    from_loaded_edits: this.sanitize([ "statistics", "reverts_made", "from_loaded_edits" ], defaults.statistics.reverts_made.from_loaded_edits),
                },
                users_welcomed: {
                    total: this.sanitize([ "statistics", "users_welcomed", "total" ], defaults.statistics.users_welcomed.total),
                },
                warnings_issued: {
                    total: this.sanitize([ "statistics", "warnings_issued", "total" ], defaults.statistics.warnings_issued.total),

                    level_1: this.sanitize([ "statistics", "warnings_issued", "level_1" ], defaults.statistics.warnings_issued.level_1),
                    level_2: this.sanitize([ "statistics", "warnings_issued", "level_2" ], defaults.statistics.warnings_issued.level_2),
                    level_3: this.sanitize([ "statistics", "warnings_issued", "level_3" ], defaults.statistics.warnings_issued.level_3),
                    level_4: this.sanitize([ "statistics", "warnings_issued", "level_4" ], defaults.statistics.warnings_issued.level_4),
                    level_4im: this.sanitize([ "statistics", "warnings_issued", "level_4im" ], defaults.statistics.warnings_issued.level_4im),
                },
                reports_filed: {
                    total: this.sanitize([ "statistics", "reports_filed", "total" ], defaults.statistics.reports_filed.total),

                    AIV: this.sanitize([ "statistics", "reports_filed", "AIV" ], defaults.statistics.reports_filed.AIV),
                    UAA: this.sanitize([ "statistics", "reports_filed", "UAA" ], defaults.statistics.reports_filed.UAA),
                    RFPP: this.sanitize([ "statistics", "reports_filed", "RFPP" ], defaults.statistics.reports_filed.RFPP),

                    global_blocks: defaults.statistics.reports_filed.global_blocks,
                    global_locks: defaults.statistics.reports_filed.global_locks,
                },

                watchlist: {
                    watched: this.sanitize([ "statistics", "watchlist", "watched" ], defaults.statistics.watchlist.watched),
                    unwatched: this.sanitize([ "statistics", "watchlist", "unwatched" ], defaults.statistics.watchlist.unwatched),
                },

                items_whitelisted: {
                    total: this.sanitize([ "statistics", "items_whitelisted", "total" ], defaults.statistics.items_whitelisted.total),

                    users: this.sanitize([ "statistics", "items_whitelisted", "users" ], defaults.statistics.items_whitelisted.users),
                    pages: this.sanitize([ "statistics", "items_whitelisted", "pages" ], defaults.statistics.items_whitelisted.pages),
                    tags: this.sanitize([ "statistics", "items_whitelisted", "tags" ], defaults.statistics.items_whitelisted.tags),
                },
                items_highlighted: {
                    total: this.sanitize([ "statistics", "items_highlighted", "total" ], defaults.statistics.items_highlighted.total),

                    users: this.sanitize([ "statistics", "items_highlighted", "users" ], defaults.statistics.items_highlighted.users),
                    pages: this.sanitize([ "statistics", "items_highlighted", "pages" ], defaults.statistics.items_highlighted.pages),
                    tags: this.sanitize([ "statistics", "items_highlighted", "tags" ], defaults.statistics.items_highlighted.tags),
                },

                blocks_issued: {
                    total: this.sanitize([ "statistics", "blocks_issued", "total" ], defaults.statistics.blocks_issued.total),
                },
                pages_protected: {
                    total: this.sanitize([ "statistics", "pages_protected", "total" ], defaults.statistics.pages_protected.total),
                },

                actions_executed: {
                    total: this.sanitize([ "statistics", "actions_executed", "total" ], defaults.statistics.actions_executed.total),

                    successful: this.sanitize([ "statistics", "actions_executed", "successful" ], defaults.statistics.actions_executed.successful),
                },

                session_time: this.sanitize([ "statistics", "session_time" ], defaults.statistics.session_time),
            },
            highlight: {
                users: this.sanitize([ "highlight", "users" ], defaults.highlight.users),
                pages: this.sanitize([ "highlight", "pages" ], defaults.highlight.pages),
                tags: this.sanitize([ "highlight", "tags" ], defaults.highlight.tags),
            },
            whitelist: {
                users: this.sanitize([ "whitelist", "users" ], defaults.whitelist.users),
                pages: this.sanitize([ "whitelist", "pages" ], defaults.whitelist.pages),
                tags: this.sanitize([ "whitelist", "tags" ], defaults.whitelist.tags),
            },
            favorite: {
                warnings: this.sanitize([ "favorite", "warnings" ], defaults.favorite.warnings),
                reverts: this.sanitize([ "favorite", "reverts" ], defaults.favorite.reverts),
            }
        };
    }

    static validate() {
        const root = this.loadedData;
        this.restrictObject(root, );

        if (root?.version !== this.number)
            return void(this.loadedLogger.error(`Stored data version ${root?.version} does not match expected version ${this.number}.`)) ?? false;

        if (typeof root.changelog !== "string")
            this.reset("changelog");

        { // root.settings
            const scope = root.settings;
            this.restrictObject(scope, "settings");

            { // root.settings.performance
                const scope = root.settings.performance;
                this.restrictObject(scope, "settings", "performance");

                { // root.settings.performance.startup
                    const validValues = new Set([ "always_off", "adaptive", "always_on" ]);
                    const value = root.settings.performance.startup;

                    if (!validValues.has(value))
                        this.reset("settings", "performance", "startup");
                }
            }

            { // root.settings.namespaces
                const value = root.settings.namespaces;
                if (!Array.isArray(value))
                    this.reset("settings", "namespaces");

                root.settings.namespaces = [ ...new Set(root.settings.namespaces) ].filter(v => {
                    const valid = namespaces.some(ns => ns.id === v);
                    if (!valid)
                        this.loadedLogger.warn(`Removing invalid namespace ID [ ${v} ] from stored data.`);

                    return valid;
                });
            }

            { // root.settings.queue
                const scope = root.settings.queue;
                this.restrictObject(scope, "settings", "queue");

                { // root.settings.queue.max_size
                    const value = root.settings.queue.max_size;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0))
                        this.reset("settings", "queue", "max_size");
                }

                { // root.settings.queue.max_edits
                    const value = root.settings.queue.max_edits;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0))
                        this.reset("settings", "queue", "max_edits");
                }

                { // root.settings.queue.min_ores
                    const value = root.settings.queue.min_ores;
                    if (!(typeof value === "number" && value >= .0 && value <= 1.0))
                        this.reset("settings", "queue", "min_ores");
                }

                { // root.settings.queue.ores_bias
                    const value = root.settings.queue.ores_bias;
                    if (!(typeof value === "number" && value >= .0 && value <= 1.0))
                        this.reset("settings", "queue", "ores_bias");
                }

                [ "recent", "pending", "users", "watchlist", "abuselog" ].forEach((section, _, queues) => {
                    { // root.settings.queue[section]
                        const scope = root.settings.queue[section];
                        this.restrictObject(scope, "settings", "queue", section);

                        { // root.settings.queue[section].enabled
                            const value = root.settings.queue[section].enabled;
                            if (typeof value !== "boolean")
                                this.reset("settings", "queue", section, "enabled");
                        }

                        { // root.settings.queue[section].order
                            const value = root.settings.queue[section].order;
                            if (!(typeof value === "number" && Number.isInteger(value) && value >= 0 && value < queues.length))
                                this.reset("settings", "queue", section, "order");
                        }
                    }
                });
            }

            { // root.settings.username_highlighting
                const scope = root.settings.username_highlighting;
                this.restrictObject(scope, "settings", "username_highlighting");

                { // root.settings.username_highlighting.enabled
                    const value = root.settings.username_highlighting.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "username_highlighting", "enabled");
                }

                { // root.settings.username_highlighting.fuzzy
                    const value = root.settings.username_highlighting.fuzzy;
                    if (typeof value !== "boolean")
                        this.reset("settings", "username_highlighting", "fuzzy");
                }
            }

            { // root.settings.wikipedia_popups
                const scope = root.settings.wikipedia_popups;
                this.restrictObject(scope, "settings", "wikipedia_popups");

                { // root.settings.wikipedia_popups.enabled
                    const value = root.settings.wikipedia_popups.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "wikipedia_popups", "enabled");
                }
            }

            { // root.settings.auto_welcome
                const scope = root.settings.auto_welcome;
                this.restrictObject(scope, "settings", "auto_welcome");

                { // root.settings.auto_welcome.enabled
                    const value = root.settings.auto_welcome.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "auto_welcome", "enabled");
                }
            }

            { // root.settings.talk_page_thanks_for_temporary_users
                const scope = root.settings.talk_page_thanks_for_temporary_users;
                this.restrictObject(scope, "settings", "talk_page_thanks_for_temporary_users");

                { // root.settings.talk_page_thanks_for_temporary_users.enabled
                    const value = root.settings.talk_page_thanks_for_temporary_users.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "talk_page_thanks_for_temporary_users", "enabled");
                }
            }

            { // root.settings.expiry
                const scope = root.settings.expiry;
                this.restrictObject(scope, "settings", "expiry");

                { // root.settings.expiry.watchlist
                    const value = root.settings.expiry.watchlist;
                    if (!expiryRegex.test(value))
                        this.reset("settings", "expiry", "watchlist");
                }

                { // root.settings.expiry.whitelist
                    const scope = root.settings.expiry.whitelist;
                    this.restrictObject(scope, "settings", "expiry", "whitelist");

                    { // root.settings.expiry.whitelist.users
                        const value = root.settings.expiry.whitelist.users;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "whitelist", "users");
                    }

                    { // root.settings.expiry.whitelist.pages
                        const value = root.settings.expiry.whitelist.pages;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "whitelist", "pages");
                    }

                    { // root.settings.expiry.whitelist.tags
                        const value = root.settings.expiry.whitelist.tags;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "whitelist", "tags");
                    }
                }

                { // root.settings.expiry.highlight
                    const scope = root.settings.expiry.highlight;
                    this.restrictObject(scope, "settings", "expiry", "highlight");

                    { // root.settings.expiry.highlight.users
                        const value = root.settings.expiry.highlight.users;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "highlight", "users");
                    }

                    { // root.settings.expiry.highlight.pages
                        const value = root.settings.expiry.highlight.pages;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "highlight", "pages");
                    }

                    { // root.settings.expiry.highlight.tags
                        const value = root.settings.expiry.highlight.tags;
                        if (!expiryRegex.test(value))
                            this.reset("settings", "expiry", "highlight", "tags");
                    }
                }
            }

            { // root.settings.auto_report
                const scope = root.settings.auto_report;
                this.restrictObject(scope, "settings", "auto_report");

                { // root.settings.auto_report.enabled
                    const value = root.settings.auto_report.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "auto_report", "enabled");
                }

                { // root.settings.auto_report.for
                    const value = root.settings.auto_report.for;
                    if (!Array.isArray(value))
                        this.reset("settings", "auto_report", "for");

                    root.settings.auto_report.for = [ ...new Set(root.settings.auto_report.for) ].filter(v => {
                        const valid = v in warningsLookup;
                        if (!valid)
                            this.loadedLogger.warn(`Removing invalid auto-report reason [ ${v} ] from stored data.`);

                        return valid;
                    });
                }
            }

            { // root.settings.AI
                const scope = root.settings.AI;
                this.restrictObject(scope, "settings", "AI");

                { // root.settings.AI.enabled
                    const value = root.settings.AI.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "AI", "enabled");
                }

                { // root.settings.AI.provider
                    const value = root.settings.AI.provider;
                    if (value !== "Ollama")
                        this.reset("settings", "AI", "provider");
                }

                { // root.settings.AI.edit_analysis
                    const scope = root.settings.AI.edit_analysis;
                    this.restrictObject(scope, "settings", "AI", "edit_analysis");

                    { // root.settings.AI.edit_analysis.enabled
                        const value = root.settings.AI.edit_analysis.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "AI", "edit_analysis", "enabled");
                    }
                }

                { // root.settings.AI.username_analysis
                    const scope = root.settings.AI.username_analysis;
                    this.restrictObject(scope, "settings", "AI", "username_analysis");
                    { // root.settings.AI.username_analysis.enabled
                        const value = root.settings.AI.username_analysis.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "AI", "username_analysis", "enabled");
                    }
                }

                { // root.settings.AI.Ollama
                    const scope = root.settings.AI.Ollama;
                    this.restrictObject(scope, "settings", "AI", "Ollama");

                    { // root.settings.AI.Ollama.server
                        const value = root.settings.AI.Ollama.server;
                        if (!isURL(value))
                            this.reset("settings", "AI", "Ollama", "server");
                    }

                    { // root.settings.AI.Ollama.model
                        const value = root.settings.AI.Ollama.model;
                        if (typeof value !== "string")
                            this.reset("settings", "AI", "Ollama", "model");
                    }
                }
            }

            { // root.settings.audio
                const scope = root.settings.audio;
                this.restrictObject(scope, "settings", "audio");

                { // root.settings.audio.ores_alert
                    const scope = root.settings.audio.ores_alert;
                    this.restrictObject(scope, "settings", "audio", "ores_alert");

                    { // root.settings.audio.ores_alert.enabled
                        const value = root.settings.audio.ores_alert.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "audio", "ores_alert", "enabled");
                    }

                    { // root.settings.audio.ores_alert.threshold
                        const value = root.settings.audio.ores_alert.threshold;
                        if (!(typeof value === "number" && value >= .0 && value <= 1.0))
                            this.reset("settings", "audio", "ores_alert", "threshold");
                    }
                }

                { // root.settings.audio.volume
                    const scope = root.settings.audio.volume;
                    this.restrictObject(scope, "settings", "audio", "volume");

                    const volumeKeys = [
                        "master",
                        "master.startup",

                        "master.music",
                        "master.music.zen_mode",

                        "master.ui",
                        "master.ui.click",

                        "master.queue",
                        "master.queue.ores",
                        "master.queue.mention",

                        "master.notification",
                        "master.notification.alert",
                        "master.notification.message",
                        "master.notification.toast",

                        "master.action",
                        "master.action.default",
                        "master.action.failed",
                        "master.action.report",
                        "master.action.block",
                        "master.action.protect",
                    ];

                    for (const key of volumeKeys) {
                        const value = root.settings.audio.volume[key];
                        if (!(typeof value === "number" && value >= 0 && value <= 1))
                            this.reset("settings", "audio", "volume", key);
                    }
                }
            }

            { // root.settings.zen_mode
                const scope = root.settings.zen_mode;
                this.restrictObject(scope, "settings", "zen_mode");

                { // root.settings.zen_mode.enabled
                    const value = scope.enabled;
                    if (typeof value !== "boolean")
                        this.reset("settings", "zen_mode", "enabled");
                }

                { // root.settings.zen_mode.sound
                    const scope = root.settings.zen_mode.sound;
                    this.restrictObject(scope, "settings", "zen_mode", "sound");

                    { // root.settings.zen_mode.sound.enabled
                        const value = root.settings.zen_mode.sound.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "sound", "enabled");
                    }
                }
                { // root.settings.zen_mode.music
                    const scope = root.settings.zen_mode.music;
                    this.restrictObject(scope, "settings", "zen_mode", "music");

                    { // root.settings.zen_mode.music.enabled
                        const value = root.settings.zen_mode.music.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "music", "enabled");
                    }
                }

                { // root.settings.zen_mode.alerts
                    const scope = root.settings.zen_mode.alerts;
                    this.restrictObject(scope, "settings", "zen_mode", "alerts");

                    { // root.settings.zen_mode.alerts.enabled
                        const value = root.settings.zen_mode.alerts.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "alerts", "enabled");
                    }
                }
                { // root.settings.zen_mode.messages
                    const scope = root.settings.zen_mode.messages;
                    this.restrictObject(scope, "settings", "zen_mode", "messages");

                    { // root.settings.zen_mode.messages.enabled
                        const value = root.settings.zen_mode.messages.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "messages", "enabled");
                    }
                }
                { // root.settings.zen_mode.toasts
                    const scope = root.settings.zen_mode.toasts;
                    this.restrictObject(scope, "settings", "zen_mode", "toasts");
                    { // root.settings.zen_mode.toasts.enabled
                        const value = root.settings.zen_mode.toasts.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "toasts", "enabled");
                    }
                }

                { // root.settings.zen_mode.badges
                    const scope = root.settings.zen_mode.badges;
                    this.restrictObject(scope, "settings", "zen_mode", "badges");
                    { // root.settings.zen_mode.badges.enabled
                        const value = root.settings.zen_mode.badges.enabled;
                        if (typeof value !== "boolean")
                            this.reset("settings", "zen_mode", "badges", "enabled");
                    }
                }
            }

            { // root.settings.accessibility
                const scope = root.settings.accessibility;
                this.restrictObject(scope, "settings", "accessibility");

                { // root.settings.accessibility.colorblind
                    const value = root.settings.accessibility.colorblind;
                    if (typeof value !== "boolean")
                        this.reset("settings", "accessibility", "colorblind");
                }
                { // root.settings.accessibility.dyslexia
                    const value = root.settings.accessibility.dyslexia;
                    if (typeof value !== "boolean")
                        this.reset("settings", "accessibility", "dyslexia");
                }

                { // root.settings.accessibility.high_contrast
                    const value = root.settings.accessibility.high_contrast;
                    if (typeof value !== "boolean")
                        this.reset("settings", "accessibility", "high_contrast");
                }

                { // root.settings.accessibility.reduce_motion
                    const value = root.settings.accessibility.reduce_motion;
                    if (typeof value !== "boolean")
                        this.reset("settings", "accessibility", "reduce_motion");
                }
            }

            { // root.settings.repeat_control_scripts
                const value = root.settings.repeat_control_scripts;
                if (typeof value !== "boolean")
                    this.reset("settings", "repeat_control_scripts");
            }
        }

        { // root.UI
            const scope = root.UI;
            this.restrictObject(scope, "UI");

            { // root.UI.theme
                const scope = root.UI.theme;
                this.restrictObject(scope, "UI", "theme");

                { // root.UI.theme.app
                    const value = root.UI.theme.app;
                    if (![ "light", "dark", "auto" ].includes(value))
                        this.reset("UI", "theme", "app");
                }
                { // root.UI.theme.palette
                    const value = root.UI.theme.palette;
                    if (!(value in GUI.palettes))
                        this.reset("UI", "theme", "palette");
                }
            }

            { // root.UI.queue
                const scope = root.UI.queue;
                this.restrictObject(scope, "UI", "queue");

                { // root.UI.queue.width
                    const value = root.UI.queue.width;
                    if (!(typeof value === "string" && value.endsWith("vw")))
                        this.reset("UI", "queue", "width");

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30))
                        this.reset("UI", "queue", "width");
                }
            }

            { // root.UI.details
                const scope = root.UI.details;
                this.restrictObject(scope, "UI", "details");

                { // root.UI.details.width
                    const value = root.UI.details.width;
                    if (!(typeof value === "string" && value.endsWith("vw")))
                        this.reset("UI", "details", "width");

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30))
                        this.reset("UI", "details", "width");
                }
            }
        }

        { // root.control_scripts
            const scope = root.control_scripts;
            if (!Array.isArray(scope))
                this.reset("control_scripts");

            function sanitizeActions(actions, ...path) {
                return actions.filter((action, index) => {
                    index = +index;

                    if (!isObject(action))
                        return void(this.loadedLogger.warn(`Removing invalid action at path [ ${[ ...path, index ].join(" -> ")} ] from stored data.`)) ?? false;

                    if (action.name === "if" || action.name === "if not") {
                        const condition = action.condition;
                        if (!(condition.name in conditions))
                            return void(this.loadedLogger.warn(`Removing invalid condition [ ${condition.name} ] at path [ ${[ ...path, index, "condition" ].join(" -> ")} ] from stored data.`)) ?? false;

                        if (!Array.isArray(action.actions)) {
                            this.loadedLogger.warn(`Resetting invalid actions array at path [ ${[ ...path, index, "actions" ].join(" -> ")} ] in stored data.`);
                            action.actions = [ ];
                        }

                        const references = sortDependencies(conditions[condition.name].parameters?.() ?? [ ]);

                        const validIds = new Set();
                        for (const reference of references) {
                            const dependencies = { };
                            for (const dependent of reference.dependencies ?? [ ])
                                dependencies[dependent] = condition.params[dependent];

                            const _default = typeof reference.default === "function" ? reference.default(dependencies) : reference.default;

                            if (!(reference.id in condition.params))
                                if ("default" in reference) {
                                    this.loadedLogger.warn(`Resetting missing parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                    condition.params[reference.id] = _default;
                                }

                            validIds.add(reference.id);
                            if (!("default" in reference))
                                continue; // optional if no default value

                            switch (reference.type) {
                                case "choice": {
                                    const options = typeof reference.options === "function" ? reference.options(dependencies) : reference.options;

                                    if (!options.includes(condition.params[reference.id])) {
                                        this.loadedLogger.warn(`Resetting invalid choice parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        condition.params[reference.id] = _default;
                                    }
                                } break;
                                case "text": {
                                    if (typeof condition.params[reference.id] !== "string") {
                                        this.loadedLogger.warn(`Resetting invalid text parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        condition.params[reference.id] = _default;
                                    }
                                } break;
                                case "boolean": {
                                    if (typeof condition.params[reference.id] !== "boolean") {
                                        this.loadedLogger.warn(`Resetting invalid boolean parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        condition.params[reference.id] = _default;
                                    }
                                } break;
                                case "number": {
                                    if (!(typeof condition.params[reference.id] === "number")) {
                                        this.loadedLogger.warn(`Resetting invalid number parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        condition.params[reference.id] = _default;
                                    }
                                }
                            }
                        }

                        for (const paramKey of Object.keys(condition.params))
                            if (!validIds.has(paramKey)) {
                                this.loadedLogger.warn(`Removing invalid parameter [ ${paramKey} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] from stored data.`);
                                delete condition.params[paramKey];
                            }

                        action.actions = sanitizeActions.call(this, action.actions, ...path, index, "actions");
                    } else {
                        if (!(action.name in events))
                            return void(this.loadedLogger.warn(`Removing invalid action [ ${action.name} ] at path [ ${[ ...path, index, "name" ].join(" -> ")} ] from stored data.`)) ?? false;

                        if (!isObject(action.params)) {
                            this.loadedLogger.warn(`Resetting invalid params object at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                            action.params = { };
                        }

                        const references = sortDependencies(events[action.name].parameters?.() ?? [ ]);

                        const validIds = new Set();
                        for (const reference of references) {
                            const dependencies = { };
                            for (const dependent of reference.dependencies ?? [ ])
                                dependencies[dependent] = action.params[dependent];

                            const _default = typeof reference.default === "function" ? reference.default(dependencies) : reference.default;

                            if (!(reference.id in action.params))
                                if ("default" in reference) {
                                    this.loadedLogger.warn(`Resetting missing parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                    action.params[reference.id] = _default;
                                }

                            validIds.add(reference.id);
                            if (!("default" in reference))
                                continue; // optional if no default value

                            switch (reference.type) {
                                case "choice": {
                                    const options = typeof reference.options === "function" ? reference.options(dependencies) : reference.options;

                                    if (!options.includes(action.params[reference.id])) {
                                        this.loadedLogger.warn(`Resetting invalid choice parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        action.params[reference.id] = _default;
                                    }
                                } break;
                                case "text": {
                                    if (typeof action.params[reference.id] !== "string") {
                                        this.loadedLogger.warn(`Resetting invalid text parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        action.params[reference.id] = _default;
                                    }
                                } break;
                                case "boolean": {
                                    if (typeof action.params[reference.id] !== "boolean") {
                                        this.loadedLogger.warn(`Resetting invalid boolean parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        action.params[reference.id] = _default;
                                    }
                                } break;
                                case "duration": {
                                    if (typeof action.params[reference.id] !== "string" || !expiryRegex.test(action.params[reference.id])) {
                                        this.loadedLogger.warn(`Resetting invalid duration parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                        action.params[reference.id] = _default;
                                    }
                                } break;
                            }
                        }

                        for (const paramKey of Object.keys(action.params))
                            if (!validIds.has(paramKey)) {
                                this.loadedLogger.warn(`Removing invalid parameter [ ${paramKey} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] from stored data.`);
                                delete action.params[paramKey];
                            }
                    }

                    return true;
                });
            }

            root.control_scripts = root.control_scripts.filter((scope, index) => {
                index = +index;
                if (!isObject(scope))
                    return void(this.loadedLogger.warn(`Removing invalid control script at path [ ${[ "control_scripts", index ].join(" -> ")} ] from stored data.`)) ?? false;

                if (!Array.isArray(scope.keys)) {
                    this.loadedLogger.warn(`Removing invalid keys array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].keys = [ ];
                }

                if (!Array.isArray(scope.actions)) {
                    this.loadedLogger.warn(`Removing invalid actions array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].actions = [ ];
                }

                root.control_scripts[index].keys = scope.keys.filter(key => validateShortcut(key));
                root.control_scripts[index].actions = sanitizeActions.call(this, scope.actions, "control_scripts", index, "actions");

                return true;
            });
        }

        { // root.statistics
            const isValidStatistic = v => typeof v === "number" && Number.isInteger(v) && v >= 0;

            const scope = root.statistics;
            this.restrictObject(scope, "statistics");

            { // root.statistics.edits_reviewed
                const scope = root.statistics.edits_reviewed;
                this.restrictObject(scope, "statistics", "edits_reviewed");

                { // root.statistics.edits_reviewed.total
                    const value = root.statistics.edits_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "edits_reviewed", "total");
                }

                { // root.statistics.edits_reviewed.thanked
                    const value = root.statistics.edits_reviewed.thanked;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "edits_reviewed", "thanked");
                }
            }

            { // root.statistics.recent_changes_reviewed
                const scope = root.statistics.recent_changes_reviewed;
                this.restrictObject(scope, "statistics", "recent_changes_reviewed");

                { // root.statistics.recent_changes_reviewed.total
                    const value = root.statistics.recent_changes_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "recent_changes_reviewed", "total");
                }
            }
            { // root.statistics.pending_changes_reviewed
                const scope = root.statistics.pending_changes_reviewed;
                this.restrictObject(scope, "statistics", "pending_changes_reviewed");

                { // root.statistics.pending_changes_reviewed.total
                    const value = root.statistics.pending_changes_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "pending_changes_reviewed", "total");
                }

                { // root.statistics.pending_changes_reviewed.accepted
                    const value = root.statistics.pending_changes_reviewed.accepted;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "pending_changes_reviewed", "accepted");
                }
                { // root.statistics.pending_changes_reviewed.rejected
                    const value = root.statistics.pending_changes_reviewed.rejected;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "pending_changes_reviewed", "rejected");
                }
            }
            { // root.statistics.watchlist_changes_reviewed
                const scope = root.statistics.watchlist_changes_reviewed;
                this.restrictObject(scope, "statistics", "watchlist_changes_reviewed");

                { // root.statistics.watchlist_changes_reviewed.total
                    const value = root.statistics.watchlist_changes_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "watchlist_changes_reviewed", "total");
                }
            }
            { // root.statistics.users_reviewed
                const scope = root.statistics.users_reviewed;
                this.restrictObject(scope, "statistics", "users_reviewed");

                { // root.statistics.users_reviewed.total
                    const value = root.statistics.users_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "users_reviewed", "total");
                }
            }
            { // root.statistics.abuselogs_reviewed
                const scope = root.statistics.abuselogs_reviewed;
                this.restrictObject(scope, "statistics", "abuselogs_reviewed");

                { // root.statistics.abuselogs_reviewed.total
                    const value = root.statistics.abuselogs_reviewed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "abuselogs_reviewed", "total");
                }
            }

            { // root.statistics.reverts_made
                const scope = root.statistics.reverts_made;
                this.restrictObject(scope, "statistics", "reverts_made");

                { // root.statistics.reverts_made.total
                    const value = root.statistics.reverts_made.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "total");
                }
                { // root.statistics.reverts_made.good_faith
                    const value = root.statistics.reverts_made.good_faith;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "good_faith");
                }

                { // root.statistics.reverts_made.from_recent_changes
                    const value = root.statistics.reverts_made.from_recent_changes;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "from_recent_changes");
                }
                { // root.statistics.reverts_made.from_pending_changes
                    const value = root.statistics.reverts_made.from_pending_changes;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "from_pending_changes");
                }
                { // root.statistics.reverts_made.from_watchlist
                    const value = root.statistics.reverts_made.from_watchlist;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "from_watchlist");
                }
                { // root.statistics.reverts_made.from_abuselogs
                    const value = root.statistics.reverts_made.from_abuselogs;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "from_abuselogs");
                }
                { // root.statistics.reverts_made.from_loaded_edits
                    const value = root.statistics.reverts_made.from_loaded_edits;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reverts_made", "from_loaded_edits");
                }
            }

            { // root.statistics.users_welcomed
                const scope = root.statistics.users_welcomed;
                this.restrictObject(scope, "statistics", "users_welcomed");

                { // root.statistics.users_welcomed.total
                    const value = root.statistics.users_welcomed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "users_welcomed", "total");
                }
            }

            { // root.statistics.warnings_issued
                const scope = root.statistics.warnings_issued;
                this.restrictObject(scope, "statistics", "warnings_issued");

                { // root.statistics.warnings_issued.total
                    const value = root.statistics.warnings_issued.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "total");
                }

                { // root.statistics.warnings_issued.level_1
                    const value = root.statistics.warnings_issued.level_1;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "level_1");
                }
                { // root.statistics.warnings_issued.level_2
                    const value = root.statistics.warnings_issued.level_2;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "level_2");
                }
                { // root.statistics.warnings_issued.level_3
                    const value = root.statistics.warnings_issued.level_3;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "level_3");
                }
                { // root.statistics.warnings_issued.level_4
                    const value = root.statistics.warnings_issued.level_4;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "level_4");
                }
                { // root.statistics.warnings_issued.level_4im
                    const value = root.statistics.warnings_issued.level_4im;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "warnings_issued", "level_4im");
                }
            }

            { // root.statistics.reports_filed
                const scope = root.statistics.reports_filed;
                this.restrictObject(scope, "statistics", "reports_filed");

                { // root.statistics.reports_filed.total
                    const value = root.statistics.reports_filed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "total");
                }

                { // root.statistics.reports_filed.AIV
                    const value = root.statistics.reports_filed.AIV;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "AIV");
                }
                { // root.statistics.reports_filed.UAA
                    const value = root.statistics.reports_filed.UAA;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "UAA");
                }
                { // root.statistics.reports_filed.RFPP
                    const value = root.statistics.reports_filed.RFPP;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "RFPP");
                }
                { // root.statistics.reports_filed.global_blocks
                    const value = root.statistics.reports_filed.global_blocks;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "global_blocks");
                }
                { // root.statistics.reports_filed.global_locks
                    const value = root.statistics.reports_filed.global_locks;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "reports_filed", "global_locks");
                }
            }

            { // root.statistics.watchlist
                const scope = root.statistics.watchlist;
                this.restrictObject(scope, "statistics", "watchlist");

                { // root.statistics.watchlist.watched
                    const value = root.statistics.watchlist.watched;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "watchlist", "watched");
                }

                { // root.statistics.watchlist.unwatched
                    const value = root.statistics.watchlist.unwatched;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "watchlist", "unwatched");
                }
            }

            { // root.statistics.items_whitelisted
                const scope = root.statistics.items_whitelisted;
                this.restrictObject(scope, "statistics", "items_whitelisted");

                { // root.statistics.items_whitelisted.total
                    const value = root.statistics.items_whitelisted.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_whitelisted", "total");
                }

                { // root.statistics.items_whitelisted.users
                    const value = root.statistics.items_whitelisted.users;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_whitelisted", "users");
                }
                { // root.statistics.items_whitelisted.pages
                    const value = root.statistics.items_whitelisted.pages;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_whitelisted", "pages");
                }
                { // root.statistics.items_whitelisted.tags
                    const value = root.statistics.items_whitelisted.tags;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_whitelisted", "tags");
                }
            }
            { // root.statistics.items_highlighted
                const scope = root.statistics.items_highlighted;
                this.restrictObject(scope, "statistics", "items_highlighted");

                { // root.statistics.items_highlighted.total
                    const value = root.statistics.items_highlighted.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_highlighted", "total");
                }

                { // root.statistics.items_highlighted.users
                    const value = root.statistics.items_highlighted.users;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_highlighted", "users");
                }
                { // root.statistics.items_highlighted.pages
                    const value = root.statistics.items_highlighted.pages;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_highlighted", "pages");
                }
                { // root.statistics.items_highlighted.tags
                    const value = root.statistics.items_highlighted.tags;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "items_highlighted", "tags");
                }
            }

            { // root.statistics.actions_executed
                const scope = root.statistics.actions_executed;
                this.restrictObject(scope, "statistics", "actions_executed");

                { // root.statistics.actions_executed.total
                    const value = root.statistics.actions_executed.total;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "actions_executed", "total");
                }

                { // root.statistics.actions_executed.successful
                    const value = root.statistics.actions_executed.successful;
                    if (!isValidStatistic(value))
                        this.reset("statistics", "actions_executed", "successful");
                }
            }

            { // root.statistics.session_time
                const value = root.statistics.session_time;
                if (!(typeof value === "number" && value >= 0))
                    this.reset("statistics", "session_time");
            }
        }

        const isValidExpiryMap = root => {
            // [ username, [ timestamp, timestamp ] ]

            if (!(Array.isArray(root) && root.length === 2))
                return false;
            else if (typeof root[0] !== "string")
                return false;

            {
                const scope = root[1];
                if (!(Array.isArray(scope) && scope.length === 2))
                    return false;

                const isTimestamp = v => typeof v === "number" && Number.isInteger(v) && v >= 0;
                if (!(isTimestamp(scope[0]) && isTimestamp(scope[1])))
                    return false;
            }

            return true;
        }

        { // root.highlight
            const scope = root.highlight;
            this.restrictObject(scope, "highlight");

            { // root.highlight.users
                const value = root.highlight.users;
                if (!Array.isArray(value))
                    this.reset("highlight", "users");

                root.highlight.users = root.highlight.users.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.pages
                const value = root.highlight.pages;
                if (!Array.isArray(value))
                    this.reset("highlight", "pages");

                root.highlight.pages = root.highlight.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.tags
                const value = root.highlight.tags;
                if (!Array.isArray(value))
                    this.reset("highlight", "tags");

                root.highlight.tags = root.highlight.tags.filter(v => isValidExpiryMap(v));
            }
        }

        { // root.whitelist
            const scope = root.whitelist;
            this.restrictObject(scope, "whitelist");

            { // root.whitelist.users
                const value = root.whitelist.users;
                if (!Array.isArray(value))
                    this.reset("whitelist", "users");

                root.whitelist.users = root.whitelist.users.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.pages
                const value = root.whitelist.pages;
                if (!Array.isArray(value))
                    this.reset("whitelist", "pages");

                root.whitelist.pages = root.whitelist.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.tags
                const value = root.whitelist.tags;
                if (!Array.isArray(value))
                    this.reset("whitelist", "tags");

                root.whitelist.tags = root.whitelist.tags.filter(v => isValidExpiryMap(v));
            }
        }

        { // root.favorite
            const scope = root.favorite;
            this.restrictObject(scope, "favorite");

            { // root.favorite.warnings
                const value = root.favorite.warnings;
                if (!Array.isArray(value))
                    this.reset("favorite", "warnings");

                root.favorite.warnings = root.favorite.warnings.filter(v => {
                    const valid = v in warningsLookup;
                    if (!valid)
                        this.loadedLogger.warn(`Removing invalid favorite warning [ ${v} ] from stored data.`);

                    return valid;
                });
            }

            { // root.favorite.reverts
                const value = root.favorite.reverts;
                if (!Array.isArray(value)) {
                    this.reset("favorite", "reverts");
                }

                root.favorite.reverts = root.favorite.reverts.filter(v => {
                    const valid = v in warningsLookup;
                    if (!valid)
                        this.loadedLogger.warn(`Removing invalid favorite revert [ ${v} ] from stored data.`);

                    return valid;
                });
            }
        }

        return true;
    }

    static construct() {
        const root = this.loadedData;
        if (root?.version !== this.number)
            return void(this.loadedLogger.error(`Stored data version ${root?.version} does not match expected version ${this.number}.`)) ?? false;

        root.settings.auto_report.for = new Set(root.settings.auto_report.for);

        root.highlight.users = new Map(root.highlight.users);
        root.highlight.pages = new Map(root.highlight.pages);
        root.highlight.tags = new Map(root.highlight.tags);

        root.whitelist.users = new Map(root.whitelist.users);
        root.whitelist.pages = new Map(root.whitelist.pages);
        root.whitelist.tags = new Map(root.whitelist.tags);

        return root;
    }

    static deconstruct() {
        const root = this.loadedData;
        if (root?.version !== this.number)
            return void(this.loadedLogger.error(`Stored data version ${root?.version} does not match expected version ${this.number}.`)) ?? false;

        root.settings.auto_report.for = [ ...root.settings.auto_report.for ];

        root.highlight.users = [ ...root.highlight.users ];
        root.highlight.pages = [ ...root.highlight.pages ];
        root.highlight.tags = [ ...root.highlight.tags ];

        root.whitelist.users = [ ...root.whitelist.users ];
        root.whitelist.pages = [ ...root.whitelist.pages ];
        root.whitelist.tags = [ ...root.whitelist.tags ];

        const data = structuredClone(root); // stuctureClone is safe since we have to use JSON for storage anyway
        this.construct(); // reconstruct to restore Maps and Sets

        return data;
    }
}