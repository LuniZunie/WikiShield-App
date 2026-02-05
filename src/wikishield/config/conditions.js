import { Queue } from "../core/queue.js";

export const conditions = {
	"true": {
		title: "True",
		check: (ws, item, params) => true
	},
	"false": {
		title: "False",
		check: (ws, item, params) => false
	},

	"account-admin": {
		title: "You are an admin",
		check: (ws, item, params) => ws.groups.sysop === true
	},

	"user-registered": {
		title: "Selected user is registered",
		check: (ws, item, params) => item.user.anon === false
	},
	"user-ip": {
		title: "Selected user is an IP address",
		check: (ws, item, params) => item.user.ip === true
	},
	"user-temp": {
		title: "Selected user is a temporary account",
		check: (ws, item, params) => item.user.temp === true
	},
	"user-empty-talk": {
		title: "Selected user's talk page is empty",
		check: (ws, item, params) => item.user.talk === undefined
	},
	"user-blocked": {
		title: "Selected user is blocked",
		check: (ws, item, params) => item.user.blocked === true
	},
	"user-edit-count": {
		title: "Selected user's edit count is",
		parameters: (ws, item) => [
			{
				id: "condition",
				title: "Condition",

				"type": "choice",
				"options": [
					"<",
					"≤",
					"=",
					"≥",
					">",
				],
				"default": "=",
			},
			{
				id: "count",
				title: "Edit count",

				"type": "number",
				"default": 0,
			},
		],
		check: (ws, item, params) => {
			const count = item.user.editcount === -1 ? Infinity : item.user.editcount || 0;
			const target = Number(params.count);
			switch (params.condition) {
				case "<": return count < target;
				case "≤": return count <= target;
				case "=": return count === target;
				case "≥": return count >= target;
				case ">": return count > target;
				default: return false;
			}
		},
	},
	"user-final-warning": {
		title: "Selected user at final warning level",
		check: (ws, item, params) => item.user.warning === "4" || item.user.warning === "4im"
	},
	"user-has-warnings": {
		title: "Selected user has no warnings",
		check: (ws, item, params) => {
			return item.user.warning !== "0";
		}
	},

	"edit-pending": {
		title: "Edit is pending",
		check: (ws, item, params) => ws.queue.pending.has(item?.id)
	},
	"edit-minor": {
		title: "Edit is marked as minor",
		check: (ws, item, params) => item.minor === true
	},
	"edit-size": {
		title: "Edit size is",
		parameters: (ws, item) => [
			{
				id: "condition",
				title: "Condition",

				"type": "choice",
				"options": [
					"<",
					"≤",
					"=",
					"≥",
					">",
				],
				"default": "=",
			},
			{
				id: "size",
				title: "Size",

				"type": "number",
				"default": 0,
			},
		],
		check: (ws, item, params) => {
			const size = item.sizediff || 0;
			const target = Number(params.size);
			switch (params.condition) {
				case "<": return size < target;
				case "≤": return size <= target;
				case "=": return size === target;
				case "≥": return size >= target;
				case ">": return size > target;
				default: return false;
			}
		},
	},
	"abs-edit-size": {
		title: "Absolute edit size is",
		parameters: (ws, item) => [
			{
				id: "condition",
				title: "Condition",

				"type": "choice",
				"options": [
					"<",
					"≤",
					"=",
					"≥",
					">",
				],
				"default": "=",
			},
			{
				id: "size",
				title: "Size",

				"type": "number",
				"min": 0,
				"default": 0,
			},
		],
		check: (ws, item, params) => {
			const size = Math.abs(item.sizediff || 0);
			const target = Number(params.size);
			switch (params.condition) {
				case "<": return size < target;
				case "≤": return size <= target;
				case "=": return size === target;
				case "≥": return size >= target;
				case ">": return size > target;
				default: return false;
			}
		},
	},
	"edit-ores-score": {
		title: "Edit ORES score is",
		parameters: (ws, item) => [
			{
				id: "condition",
				title: "Condition",

				"type": "choice",
				"options": [
					"<",
					"≤",
					"=",
					"≥",
					">",
				],
				"default": "=",
			},
			{
				id: "score",
				title: "Score",

				"type": "number",
				"min": 0,
				"max": 1,
				"default": 0,
			},
		],
		check: (ws, item, params) => {
			const score = item.ores_score || 0;
			const target = Number(params.score);
			switch (params.condition) {
				case "<": return score < target;
				case "≤": return score <= target;
				case "=": return score === target;
				case "≥": return score >= target;
				case ">": return score > target;
				default: return false;
			}
		},
	},

	"user-highlighted": {
		title: "Selected user is highlighted",
		check: (ws, item, params) => ws.store.highlight.users.has(item.user.name)
	},
	"user-whitelisted": {
		title: "Selected user is whitelisted",
		check: (ws, item, params) => ws.store.whitelist.users.has(item.user.name)
	},

	"page-highlighted": {
		title: "Selected page is highlighted",
		check: (ws, item, params) => ws.store.highlight.pages.has(item.page.title)
	},
	"page-whitelisted": {
		title: "Selected page is whitelisted",
		check: (ws, item, params) => ws.store.whitelist.pages.has(item.page.title)
	},
	"page-watched": {
		title: "Selected page is watched",
		check: (ws, item, params) => item.page.watched === true
	},

	"tag-highlighted": {
		title: "Selected edit has a highlighted tag",
		check: (ws, item, params) => {
			for (const tag of item.tags) {
				if (ws.store.highlight.tags.has(tag))
					return true;
			}
			return false;
		}
	},
	"tag-whitelisted": {
		title: "Selected edit has a whitelisted tag",
		check: (ws, item, params) => {
			for (const tag of item.tags) {
				if (ws.store.whitelist.tags.has(tag))
					return true;
			}
			return false;
		}
	},

	"item-selected": {
		title: "An item is selected",
		check: (ws, item, params) => item !== null
	},
	"edit-selected": {
		title: "An edit is selected",
		check: (ws, item, params) => Queue.groups[item?.type] === "edit"
	},
	"logevent-selected": {
		title: "A logentry is selected",
		check: (ws, item, params) => Queue.groups[item?.type] === "logevent"
	},

	"in-recent-queue": {
		title: "In recent changes queue",
		check: (ws, item, params) => ws.queue.current.type === "recent"
	},
	"in-pending-queue": {
		title: "In pending changes queue",
		check: (ws, item, params) => ws.queue.current.type === "pending"
	},
	"in-user-queue": {
		title: "In user creations queue",
		check: (ws, item, params) => ws.queue.current.type === "users"
	},
	"in-watchlist-queue": {
		title: "In watchlist queue",
		check: (ws, item, params) => ws.queue.current.type === "watchlist"
	},
};