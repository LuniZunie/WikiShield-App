export const welcomesLookup = { };
export async function LoadWelcomes(servers) {
    const serverWelcomes = await Promise.all(servers.map(async server =>
        [
            server,
            await fetch(`https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/src/wikishield/lang/${server}/welcomes.js`)
            .then(res => res.text())
            .catch(error => {
                console.error(`[WikiShield] - Error loading welcomes for ${server}.`, error);
                return "const welcomes = { };";
            })
        ]
    ));

    for (const [ server, code ] of serverWelcomes) {
        const hijackedCode = `${code}\n\nreturn welcomes;`;
        try {
            welcomesLookup[server] = new Function(hijackedCode)();
        } catch (error) {
            console.error(`[WikiShield] - Error parsing welcomes for ${server}.`, error);
        }
    }
}