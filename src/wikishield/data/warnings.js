export const warningTemplateColors = {
	"0": "grey",
	"1": "#4169e1",
	"2": "#ff8c00",
	"3": "#ff4500",
	"4": "#b22222",
	"4im": "#000000"
};

export const warningsTree = { };
export const warningsLookup = { };
export async function LoadWarnings(servers) {
	const serverWarnings = await Promise.all(servers.map(async server =>
		[
			server,
			await fetch(`https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/src/wikishield/lang/${server}/warnings.js`)
			.then(res => res.text())
			.catch(error => {
				console.error(`[WikiShield] - Error loading warnings for ${server}.`, error);
				return "const warnings = { };";
			})
		]
	));

	for (const [ server, code ] of serverWarnings) {
		const hijackedCode = `${code}\n\nreturn warnings;`;
		try {
			warningsTree[server] = new Function(hijackedCode)();

			const serverLookup = warningsLookup[server] = { };
			for (const [ , category ] of Object.entries(warningsTree[server]))
				for (let i = category.warnings.length - 1; i >= 0; i--) {
					const warning = category.warnings[i];
					serverLookup[warning.title] = warning;
				}
		} catch (error) {
			console.error(`[WikiShield] - Error parsing warnings for ${server}.`, error);
		}
	}
}