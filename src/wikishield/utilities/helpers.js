import { truncate } from "../../../global/truncate/script.esm.js";

export const expiryRegex = /(infinity|^((?<years>[0-9]+)Y)?((?<months>[0-9]+)M)?((?<weeks>[0-9]+)W)?((?<days>[0-9]+)D)?((?<hours>[0-9]+)h)?((?<minutes>[0-9]+)m)?((?<seconds>[0-9]+)s)?)$/;

function hasApproxSubstring(a, b, alphabet = 256) {
	if (a.length === 0)
		return true;
	if (b.length === 0)
		return false;

	const maxError = Math.floor(Math.max(a.length, b.length) / 4);
	const minLength = Math.max(1, a.length - maxError);
	const maxLength = Math.min(b.length, a.length + maxError);

	for (let length = minLength; length <= maxLength; length++) {
		for (let start = 0; start + length <= b.length; start++) {
			const candidate = b.slice(start, start + length);
			const da = new Array(alphabet).fill(0);
			const d = new Array(a.length + 2).fill(0).map(() => new Array(candidate.length + 2).fill(0));

			const maxdist = a.length + candidate.length;
			d[0][0] = maxdist;
			for (let i = 0; i <= a.length; i++) {
				d[i + 1][0] = maxdist;
				d[i + 1][1] = i;
			}
			for (let j = 0; j <= candidate.length; j++) {
				d[0][j + 1] = maxdist;
				d[1][j + 1] = j;
			}

			for (let i = 1; i <= a.length; i++) {
				let db = 0;
				for (let j = 1; j <= candidate.length; j++) {
					const k = da[candidate.charCodeAt(j - 1)], l = db;

					let cost;
					if (a[i - 1] === candidate[j - 1]) {
						cost = 0;
						db = j;
					} else
						cost = 1;

					d[i + 1][j + 1] = Math.min(
						d[i][j] + cost, // substitution
						d[i + 1][j] + 1, // insertion
						d[i][j + 1] + 1, // deletion
						d[k][l] + (i - k - 1) + cost + (j - l - 1) // transposition
					);
				}

				da[a.charCodeAt(i - 1)] = i;
			}

			if (d[a.length + 1][candidate.length + 1] <= Math.floor(Math.max(a.length, candidate.length) / 4))
				return true;
		}
	}

	return false;
}

export class Utility {
	constructor(ws) {
		this.ws = ws;
	}

	escapeRegex(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}

	escape(text) {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	}

	utcString(date) {
		if (date === Infinity)
			return "indefinite";

		const pad = this.padString;
		return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}T${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`;
	}

	padString(str, len) {
		str = str.toString();
		while (str.length < len) {
			str = `0${str}`;
		}
		return str;
	}

	getMonth(n) {
		const monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
		return monthNames[n];
	}

	monthSectionName() {
		return `${this.getMonth(new Date().getUTCMonth())} ${new Date().getUTCFullYear()}`;
	}

	escape(str) {
		return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	textify(str) {
		const div = document.createElement("div");
		div.innerHTML = str;
		return div.textContent || div.innerText || "";
	}

	pageLink(title, usePhpString = false, encode = true) {
		return usePhpString ?
			`https://${this.ws.server}/w/index.php${title}` :
			`https://${this.ws.server}/wiki/${encode ? encodeURIComponent(title) : title}`;
	}

	truncate(text, length) {
		return truncate(text, length);
	}

	formatBytes(bytes) {
		const sizes = [ "B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB", "RiB", "QiB" ];
		if (bytes === 0) return "0 B";
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
	}

	getWarningLevelColor(level) {
		switch (level) {
			case "1": return "rgba(107, 163, 216, 1)";
			case "2": return "rgba(255, 193, 7, 1)";
			case "3": return "rgba(255, 87, 34, 1)";
			case "4": return "rgba(244, 67, 54, 1)";
			case "4im": return "rgba(178, 34, 34, 1)";
			default: return "rgba(255, 255, 255, .7)";
		}
	}

	getChangeColor(delta) {
		if (delta === 0)
			return "#888"; // Grey for no change
		if (delta > 0) {
			if (delta >= 1000) return "#00b894";
			if (delta >= 500) return "#00d4a1";
			if (delta >= 100) return "#26de81";
			return "#55efc4";
		} else {
			const absDelta = Math.abs(delta);
			if (absDelta >= 1000) return "#d63031";
			if (absDelta >= 500) return "#e74c3c";
			if (absDelta >= 100) return "#ff6b6b";
			return "#ff8787";
		}
	}

	getChangeString(delta) {
		return delta > 0 ? "+" + delta : (delta === 0 ? "0" : `&ndash;${Math.abs(delta).toString()}`);
	}

	formatNotificationTime(date, now = new Date()) {
		const seconds = Math.floor((now - date) / 1000);
		if (seconds <= 0)
			return "Now";
		else if (seconds < 60)
			return `${seconds}s ago`;
		else if (seconds < 3600)
			return `${Math.floor(seconds / 60)}m ago`;
		else if (seconds < 86400)
			return `${Math.floor(seconds / 3600)}h ago`;
		else if (seconds < 2592000)
			return `${Math.floor(seconds / 86400)}d ago`;
		else if (seconds < 31536000)
			return `${Math.floor(seconds / 2592000)}mo ago`;
		else
			return `${Math.floor(seconds / 31536000)}y ago`;
	}

	formatDuration(date, now = new Date()) {
		const seconds = Math.floor((now - date) / 1000);
		if (seconds <= 0)
			return "0s";
		else if (seconds < 60)
			return `${seconds}s`;
		else if (seconds < 3600)
			return `${Math.floor(seconds / 60)}m`;
		else if (seconds < 86400)
			return `${Math.floor(seconds / 3600)}h`;
		else if (seconds < 2592000)
			return `${Math.floor(seconds / 86400)}d`;
		else if (seconds < 31536000)
			return `${Math.floor(seconds / 2592000)}mo`;
		else
			return `${Math.floor(seconds / 31536000)}y`;
	}

	match(needle, haystack) {
		if (this.ws.store.settings.username_highlighting.fuzzy) {
			return hasApproxSubstring(needle, haystack);
		} else {
			return haystack.toLowerCase().includes(needle.toLowerCase());
		}
	}

	isIPv4Address(address) {
		const byte = "(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|0?[0-9]{1,2})";
		const regex = new RegExp(`^(${byte}\\.){3}${byte}$`);
		return regex.test(address);
	}
	isIPv6Address(address) {
		const regex = new RegExp('^(?::(?::|(?::[0-9A-Fa-f]{1,4}){1,7})|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}::|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){7})$');
		if (regex.test(address))
			return true;

		return new RegExp('^[0-9A-Fa-f]{1,4}(?:::?[0-9A-Fa-f]{1,4}){1,6}$').test(address) && /::/.test(address) && !/::.*::/.test(address);
	}
	isIPAddress(address) {
		return this.isIPv4Address(address) || this.isIPv6Address(address);
	}
	isTempAccount(username) {
		return /^~[0-9]{4,}(-[0-9A-Fa-f]{5})*(-[0-9A-Fa-f]{1,5})$/.test(username);
	}

	expiryToDate(string) {
		if (string === "infinity")
			return Infinity;

		const now = new Date();

		const match = expiryRegex.exec(string);
		if (!match)
			return now;

		return new Date(
			now.getFullYear() + (parseInt(match.groups.years) || 0),
			now.getMonth() + (parseInt(match.groups.months) || 0),
			now.getDate() + (parseInt(match.groups.weeks) || 0) * 7 + (parseInt(match.groups.days) || 0),
			now.getHours() + (parseInt(match.groups.hours) || 0),
			now.getMinutes() + (parseInt(match.groups.minutes) || 0),
			now.getSeconds() + (parseInt(match.groups.seconds) || 0)
		);
	}

	getPageSections(content) { // split into [ { title, level, content }, ... ]
		const lines = content.split("\n");
		const sections = [ ];
		let currentSection = { title: "", heading: "", level: 0, content: "" };
		for (const line of lines) {
			const match = /^(=+)\s*(.*?)\s*\1\s*$/.exec(line);
			if (match) {
				if (currentSection.title !== "")
					sections.push(currentSection);
				currentSection = { title: match[2], heading: match[0], level: match[1].length, content: "" };
			} else {
				if (currentSection.content !== "")
					currentSection.content += "\n";
				currentSection.content += line;
			}
		}
		if (currentSection.content !== "" || currentSection.title !== "")
			sections.push(currentSection);

		return sections;
	}
}