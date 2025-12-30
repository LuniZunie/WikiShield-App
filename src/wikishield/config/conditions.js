export const conditions = {
	"operatorNonAdmin": {
		desc: "You are not an admin",
		check: (ws) => !ws.rights.block
	},
	"operatorAdmin": {
		desc: "You are an admin",
		check: (ws) => ws.rights.block
	},
	"userIsHighlighted": {
		desc: "User is highlighted",
		check: (ws, edit) => ws.store.highlight.users.has(edit.user.name)
	},
    "pageIsWatchlisted": {
        desc: "Page is on watchlist",
        check: (ws, edit) => {
            return edit.page.watched;
        }
    },
    "pageIsNotWatchlisted": {
        desc: "Page is not on watchlist",
        check: (ws, edit) => {
            return !edit.page.watched;
        }
    },
	"pageIsHighlighted": {
		desc: "Page is highlighted",
		check: (ws, edit) => ws.store.highlight.pages.has(edit.page.title)
	},
	"userIsWhitelisted": {
		desc: "User is whitelisted",
		check: (ws, edit) => ws.store.whitelist.users.has(edit.user.name)
	},
	"pageIsWhitelisted": {
		desc: "Page is whitelisted",
		check: (ws, edit) => ws.store.whitelist.pages.has(edit.page.title)
	},
	"userIsAnon": {
		desc: "User is anonymous (temporary account)",
		check: (ws, edit) => mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name)
	},
    "userIsIP": {
        desc: "User is an IP address",
        check: (ws, edit) => mw.util.isIPAddress(edit.user.name)
    },
    "userIsTemp": {
        desc: "User is a temporary account",
        check: (ws, edit) => mw.util.isTemporaryUser(edit.user.name)
    },
	"userIsRegistered": {
		desc: "User is registered (not temporary account)",
		check: (ws, edit) => !(mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name))
	},
	"userHasEmptyTalkPage": {
		desc: "User has an empty talk page",
		check: (ws, edit) => edit.user.talk === undefined
	},
	"editIsMinor": {
		desc: "Edit is marked as minor",
		check: (ws, edit) => edit.minor
	},
	"editIsMajor": {
		desc: "Edit is not marked as minor",
		check: (ws, edit) => !edit.minor
	},
	"editSizeNegative": {
		desc: "Edit removes content (negative bytes)",
		check: (ws, edit) => (edit.sizediff || 0) < 0
	},
	"editSizePositive": {
		desc: "Edit adds content (positive bytes)",
		check: (ws, edit) => (edit.sizediff || 0) > 0
	},
	"editSizeLarge": {
		desc: "Edit is large (>1000 bytes change)",
		check: (ws, edit) => Math.abs(edit.sizediff || 0) > 1000
	},
	"userEditCountLow": {
		desc: "User has less than 10 edits",
		check: (ws, edit) => edit.user.editCount < 10 && edit.user.editCount >= 0
	},
	"userEditCountHigh": {
		desc: "User has 100 or more edits",
		check: (ws, edit) => edit.user.editCount >= 100
	},
	"atFinalWarning": {
		desc: "User already has a final warning (before any new warnings)",
		check: (ws, edit) => {
			const original = edit.user.warning.toString() || "0";
			const result = ["4", "4im"].includes(original);
			return result;
		}
	},
	"userHasWarnings": {
		desc: "User has received warnings (level 1+)",
		check: (ws, edit) => {
			const level = edit.user.warning?.toString() || "0";
			return !["0", ""].includes(level);
		}
	},
	"userNoWarnings": {
		desc: "User has no warnings (level 0)",
		check: (ws, edit) => {
			const level = edit.user.warning?.toString() || "0";
			return ["0", ""].includes(level);
		}
	}
};