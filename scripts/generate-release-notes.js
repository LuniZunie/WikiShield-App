const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version and tag from package.json
const packageJson = require('../package.json');
const version = packageJson.version;
const tag = `v${version}`;

// Read the release template
const templatePath = path.join(__dirname, '..', '.github', 'RELEASE_TEMPLATE.md');
let template = fs.readFileSync(templatePath, 'utf8');

// Replace version placeholders in the template
template = template.replace(/1\.0\.0-dev3/g, version);
template = template.replace(/v1\.0\.0-dev3/g, tag);

// Get git commit messages since last tag to generate changelog
let changelog = '';
try {
    const lastTag = execSync('git describe --tags --abbrev=0 HEAD^', { encoding: 'utf8' }).trim();
    const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s"`, { encoding: 'utf8' }).trim();
    if (commits) {
        changelog = '\n### Changes\n' + commits + '\n';
    }
} catch (e) {
    // No previous tag or error getting commits
    changelog = '\n### Changes\n- Initial release\n';
}

// Insert changelog into template
template = template.replace('<!-- Add your release notes here -->', changelog);

// Save to a temporary file
const outputPath = path.join(__dirname, '..', 'README.md');
fs.writeFileSync(outputPath, template, 'utf8');

console.log(`✓ Generated release notes for ${tag}`);
console.log(`  Saved to: ${outputPath}`);
