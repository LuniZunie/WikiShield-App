const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");
const { version } = require("../package.json");

const tag = `v${version}`;
const token = process.env.GH_TOKEN;

if (!token) {
    console.error("\nError: GH_TOKEN environment variable not set.");
    console.error("Set it with: $env:GH_TOKEN = 'your_token'");
    process.exit(1);
}

const octokit = new Octokit({ auth: token });

async function publishRelease() {
    try {
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        if (status.trim()) {
            console.log("You have uncommitted changes:");
            console.log(status);
            console.log("\nPlease commit or stash your changes first.");
            process.exit(1);
        }

        console.log(`\nBuilding version ${version}...`);
        execSync("npm run build", { stdio: "inherit" });

        console.log(`\nCreating git tag ${tag}...`);
        try {
            execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
            console.log(`Tag ${tag} already exists. Skipping tag creation.`);
        } catch {
            execSync(`git tag ${tag}`, { stdio: "inherit" });
            console.log(`Pushing tag to GitHub...`);
            execSync("git push --tags", { stdio: "inherit" });
        }

        console.log(`\nCreating GitHub release...`);
        const release = await octokit.repos.createRelease({
            owner: "LuniZunie",
            repo: "WikiShield-App",
            tag_name: tag,
            name: `WikiShield ${version}`,
            body: `Release ${version}`,
            draft: false,
            prerelease: false,
        });

        console.log(`Release created: ${release.data.html_url}`);

        console.log(`\nUploading artifacts...`);
        const distPath = path.join(__dirname, "../dist");
        const files = fs.readdirSync(distPath).filter(
            (f) => f.endsWith(".exe") || f.endsWith(".yml")
        );

        for (const file of files) {
            const filePath = path.join(distPath, file);
            const fileData = fs.readFileSync(filePath);

            console.log(`Uploading ${file}...`);
            await octokit.repos.uploadReleaseAsset({
                owner: "LuniZunie",
                repo: "WikiShield-App",
                release_id: release.data.id,
                name: file,
                data: fileData,
            });
        }

        console.log(`\n✓ Success! Release ${version} published with all artifacts.`);
        console.log(`View at: ${release.data.html_url}\n`);
    } catch (err) {
        console.error("\nFailed to publish:", err.message);
        process.exit(1);
    }
}

publishRelease();
