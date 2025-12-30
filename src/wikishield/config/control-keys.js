export const controls = new Set([
	"!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
	"1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
	"q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
	"a", "s", "d", "f", "g", "h", "j", "k", "l",
	"z", "x", "c", "v", "b", "n", "m",
	"-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "enter",
	"_", "+", "{", "}", "|", ":", "\"", "<", ">", "?", " ",
	"arrowleft", "arrowup", "arrowdown", "arrowright"
]);

export const buildShortcut = event => {
	const order = [ "ctrl", "shift", "alt" ];

	const parts = [ ];
	order.forEach(mod => {
		if (event[`${mod}Key`])
			parts.push(mod);
	});

	const key = event.key.toLowerCase();
	if (controls.has(key))
		parts.push(key === " " ? "space" : key);

	return parts.join("+");
};

export const validateShortcut = shortcut => {
	const parts = shortcut.toLowerCase().split("+");
	if (parts.length === 0)
		return false;

	const seen = new Set();
	for (const part of parts) {
		if (seen.has(part))
			return false;
		seen.add(part);
		if (part !== "ctrl" && part !== "shift" && part !== "alt" && !controls.has(part))
			return false;
	}
	return parts.some(part => part !== "ctrl" && part !== "shift" && part !== "alt");
}