import { truncate } from "../../../global/truncate/script.esm.js";

export const expiryRegex = /(infinity|^((?<years>[0-9]+)Y)?((?<months>[0-9]+)M)?((?<weeks>[0-9]+)W)?((?<days>[0-9]+)D)?((?<hours>[0-9]+)h)?((?<minutes>[0-9]+)m)?((?<seconds>[0-9]+)s)?)$/;

function hasApproxSubstring(needle, haystack, k) {
	const n = needle.length;
	const m = haystack.length;
	if (n === 0) return true;
	if (m === 0) return n <= k;

	let prev = new Array(m + 1).fill(0);
	let curr = new Array(m + 1).fill(0);

	for (let j = 0; j <= m; j++) prev[j] = 0;

	for (let i = 1; i <= n; i++) {
		curr[0] = i;

		let rowMin = curr[0];

		for (let j = 1; j <= m; j++) {
			const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;

			const del = prev[j] + 1;
			const ins = curr[j - 1] + 1;
			const sub = prev[j - 1] + cost;

			const d = Math.min(del, ins, sub);
			curr[j] = d;
			if (d < rowMin) rowMin = d;

			if (i === n && d <= k) return true;
		}

		if (rowMin > k) return false;

		[ prev, curr ] = [ curr, prev ];
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

	getChangeColor(delta) {
		if (delta === 0) return "#888"; // Gray for no change
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
		if (now <= date)
			return "Now";

		if (now.getFullYear() !== date.getFullYear())
			return `${now.getFullYear() - date.getFullYear()}y ago`;
		else if (now.getMonth() !== date.getMonth())
			return `${now.getMonth() - date.getMonth()}mo ago`;
		else if (now.getDate() !== date.getDate())
			return `${now.getDate() - date.getDate()}d ago`;
		else if (now.getHours() !== date.getHours())
			return `${now.getHours() - date.getHours()}h ago`;
		else if (now.getMinutes() !== date.getMinutes())
			return `${now.getMinutes() - date.getMinutes()}m ago`;
		else if (now.getSeconds() !== date.getSeconds())
			return `${now.getSeconds() - date.getSeconds()}s ago`;
		return "Now";
	}

	match(needle, haystack) {
		if (this.ws.store.settings.username_highlighting.fuzzy) {
			return hasApproxSubstring(needle, haystack, 2);
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
		const sections = [];
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