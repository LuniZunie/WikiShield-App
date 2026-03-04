const fs = require("fs");
const path = require("path");

const { fullTrim } = require("../global/full-trim/script.com.js");

exports.default = async function(context) {
    console.log(`\nAfter-pack hook running for ${context.electronPlatformName}...`);
    console.log(`\tOutput directory: ${context.appOutDir}`);

    const appUpdateYmlPath = path.join(context.appOutDir, "resources", "app-update.yml");
    console.log(`\tChecking for app-update.yml at: ${appUpdateYmlPath}`);

    if (!fs.existsSync(appUpdateYmlPath)) {
        console.log("\tapp-update.yml not found, creating it...");

        const yamlContent = fullTrim(`
            owner: LuniZunie
            repo: WikiShield-App
            provider: github
            releaseType: release
            updaterCacheDirName: wikishield-updater
        `);

        const resourcesDir = path.join(context.appOutDir, "resources");
        if (!fs.existsSync(resourcesDir))
            void(console.log("\tCreated resources directory")) ?? fs.mkdirSync(resourcesDir, { recursive: true });

        fs.writeFileSync(appUpdateYmlPath, yamlContent, "utf8");
        console.log("\tapp-update.yml created successfully");
    } else {
        console.log("\tapp-update.yml already exists");

        const content = fs.readFileSync(appUpdateYmlPath, "utf8");
        console.log("\tContents:", content.split("\n").join("\n\t"));
    }
};
