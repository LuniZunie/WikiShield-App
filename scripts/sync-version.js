const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = require(packageJsonPath);

// Ensure all version fields match the main version
const version = packageJson.version;

// Update win32metadata versions
if (packageJson.config?.forge?.packagerConfig?.win32metadata) {
    packageJson.config.forge.packagerConfig.win32metadata.FileVersion = version;
    packageJson.config.forge.packagerConfig.win32metadata.ProductVersion = version;
}

// Update packagerConfig versions
if (packageJson.config?.forge?.packagerConfig) {
    packageJson.config.forge.packagerConfig.appVersion = version;
    packageJson.config.forge.packagerConfig.buildVersion = version;
}

// Update electron-builder Windows versions
if (packageJson.build?.win) {
    packageJson.build.win.fileVersion = version;
    packageJson.build.win.productVersion = version;
}

// Write back to file
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

console.log(`✓ Updated all version fields to ${version}`);
