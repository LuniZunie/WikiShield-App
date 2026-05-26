const fs = require("fs");
const path = require("path");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = require(packageJsonPath);

const version = packageJson.version;

if (packageJson.config?.forge?.packagerConfig?.win32metadata) {
    packageJson.config.forge.packagerConfig.win32metadata.FileVersion = version;
    packageJson.config.forge.packagerConfig.win32metadata.ProductVersion = version;
}

if (packageJson.config?.forge?.packagerConfig) {
    packageJson.config.forge.packagerConfig.appVersion = version;
    packageJson.config.forge.packagerConfig.buildVersion = version;
}

if (packageJson.build?.nsis) {
    packageJson.build.nsis.artifactName = `WikiShield-Setup-${version}.exe`;
}

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

console.log(`Updated all version fields to ${version}`);

// Also update release files in .github to keep templates in sync
const releaseFiles = [
    path.join(__dirname, "..", "README.md"),
];

releaseFiles.forEach((filePath) => {
    try {
        if (!fs.existsSync(filePath)) return;
        let content = fs.readFileSync(filePath, "utf8");

        // Replace occurrences like v1.2.3 or 1.2.3 with the new version
        content = content.replace(/v?\d+\.\d+\.\d+/g, (match) => {
            return match.startsWith("v") ? `v${version}` : version;
        });

        fs.writeFileSync(filePath, content, "utf8");
        console.log(`Updated version strings in ${filePath}`);
    } catch (err) {
        console.error(`Failed to update ${filePath}:`, err);
    }
});