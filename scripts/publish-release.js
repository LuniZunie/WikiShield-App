const { execSync } = require('child_process');
const { version } = require('../package.json');

const tag = `v${version}`;

console.log(`\n📦 Publishing version ${version}...`);

try {
    // Check if there are uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
        console.log('⚠️  You have uncommitted changes:');
        console.log(status);
        console.log('\nPlease commit or stash your changes first.');
        process.exit(1);
    }

    // Check if tag already exists locally
    try {
        execSync(`git rev-parse ${tag}`, { stdio: 'ignore' });
        console.log(`❌ Tag ${tag} already exists locally.`);
        console.log(`   Delete it first: git tag -d ${tag}`);
        process.exit(1);
    } catch {
        // Tag doesn't exist, which is good
    }

    // Generate release notes
    console.log(`✓ Generating release notes...`);
    execSync('node scripts/generate-release-notes.js', { stdio: 'inherit' });

    // Create the tag
    console.log(`✓ Creating tag ${tag}...`);
    execSync(`git tag ${tag}`, { stdio: 'inherit' });

    // Push the tag
    console.log(`✓ Pushing tag to GitHub...`);
    execSync('git push --tags', { stdio: 'inherit' });

    console.log(`\n✅ Success! Tag ${tag} has been pushed.`);
    console.log(`\n🚀 GitHub Actions will now build and publish for all platforms.`);
    console.log(`   Monitor progress at: https://github.com/LuniZunie/WikiShield-App/actions\n`);

} catch (error) {
    console.error('\n❌ Failed to publish:', error.message);
    process.exit(1);
}
