const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    console.log(`\n📦 After-pack hook running for ${context.electronPlatformName}...`);
    console.log(`   Output directory: ${context.appOutDir}`);

    const appUpdateYmlPath = path.join(context.appOutDir, 'resources', 'app-update.yml');
    console.log(`   Checking for app-update.yml at: ${appUpdateYmlPath}`);

    // Check if app-update.yml exists
    if (!fs.existsSync(appUpdateYmlPath)) {
        console.log('   ⚠️  app-update.yml not found, creating it...');

        const yamlContent = `owner: LuniZunie
repo: WikiShield-App
provider: github
releaseType: release
updaterCacheDirName: wikishield-updater
`;

        // Ensure resources directory exists
        const resourcesDir = path.join(context.appOutDir, 'resources');
        if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
            console.log('   Created resources directory');
        }

        // Write the file
        fs.writeFileSync(appUpdateYmlPath, yamlContent, 'utf8');
        console.log('   ✅ app-update.yml created successfully');
    } else {
        console.log('   ✅ app-update.yml already exists');
        // Log the contents for verification
        const content = fs.readFileSync(appUpdateYmlPath, 'utf8');
        console.log('   Contents:', content.split('\n').join('\n   '));
    }
};
