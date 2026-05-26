const { execSync } = require("child_process");
const { version } = require("../package.json");

const tag = `v${version}`;

console.log(`\nPublishing version ${version}...`);

try {
    const status = execSync("git status --porcelain", { encoding: "utf8" });
    if (status.trim()) {
        console.log("You have uncommitted changes:");
        console.log(status);
        console.log("\nPlease commit or stash your changes first.");
        process.exit(1);
    }

    try {
        execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
        console.log(`Tag ${tag} already exists locally.`);
        console.log(`\tDelete it first: git tag -d ${tag}`);
        process.exit(1);
    } catch { }

    console.log(`Creating tag ${tag}...`);
    execSync(`git tag ${tag}`, { stdio: "inherit" });

    console.log(`Pushing tag to GitHub...`);
    execSync("git push --tags", { stdio: "inherit" });

    console.log(`\nSuccess! Tag ${tag} has been pushed.`);
    console.log(`\nGitHub Actions will now build and publish for all platforms.`);
    console.log(`\tMonitor progress at: https://github.com/LuniZunie/WikiShield-App/actions\n`);
} catch (err) {
    console.error("\nFailed to publish:", err.message);
    process.exit(1);
}
