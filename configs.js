const configLookup = { };
async function LoadConfig(servers) {
    const serverConfig = await Promise.all(servers.map(async server =>
        [
            server,
            await fetch(`https://raw.githubusercontent.com/LuniZunie/WikiShield-App/refs/heads/main/src/wikishield/lang/${server}/config.json`)
            .then(res => res.json())
            .catch(error => {
                console.error(`[WikiShield] - Error loading config for ${server}.`, error);
                return { };
            })
        ]
    ));

    for (const [ server, json ] of serverConfig)
        configLookup[server] = json;
}

module.exports = { configLookup, LoadConfig };