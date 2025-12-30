const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const appUpdateYmlPath = path.join(context.appOutDir, 'resources', 'app-update.yml');

    // Check if app-update.yml exists
    if (!fs.existsSync(appUpdateYmlPath)) {
        console.log('⚠️  app-update.yml not found, creating it...');

        const yamlContent = `provider: github
owner: LuniZunie
repo: WikiShield-App
releaseType: release
`;

    } else {
        console.log('✓ app-update.yml exists');
    }
};
