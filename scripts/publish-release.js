const { execSync } = require("child_process");
const { Octokit } = require("@octokit/rest");
const { readFileSync } = require("fs");
const { join } = require("path");
const { createHash } = require("crypto");
const { version } = require("../package.json");

const tag = `v${version}`;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
    console.error("Error: GITHUB_TOKEN environment variable not set");
    console.error("Set it with: $env:GITHUB_TOKEN = 'your_token_here'");
    process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function generateLatestYml(exePath) {
    const fileContent = readFileSync(exePath);
    const sha512 = createHash("sha512").update(fileContent).digest("hex");
    const size = fileContent.length;
    const fileName = exePath.split("\\").pop();

    return `version: ${version}
files:
  - url: ${fileName}
    sha512: ${sha512}
    size: ${size}
path: ${fileName}
sha512: ${sha512}
releaseDate: '${new Date().toISOString()}'
`;
}

async function publishRelease() {
    console.log(`\nPublishing version ${version}...`);

    try {
        // Check for uncommitted changes
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        if (status.trim()) {
            console.log("You have uncommitted changes:");
            console.log(status);
            console.log("\nPlease commit or stash your changes first.");
            process.exit(1);
        }

        // Check if tag exists
        try {
            execSync(`git rev-parse ${tag}`, { stdio: "ignore" });
            console.log(`Tag ${tag} already exists locally.`);
            console.log(`\tDelete it first: git tag -d ${tag}`);
            process.exit(1);
        } catch { }

        // Build the application
        console.log("\nBuilding application...");
        execSync("npm run build", { stdio: "inherit" });

        // Find the generated installer
        const distPath = join(__dirname, "..", "dist");
        const files = execSync(`Get-ChildItem "${distPath}" -Filter "*.exe" | Select-Object -ExpandProperty Name`, {
            encoding: "utf8",
            shell: "powershell"
        }).trim().split("\n").filter(f => f);

        if (files.length === 0) {
            console.error("No .exe files found in dist folder");
            process.exit(1);
        }

        const exeFile = files[0];
        const exePath = join(distPath, exeFile);
        console.log(`Found installer: ${exeFile}`);

        // Generate latest.yml
        console.log("Generating latest.yml...");
        const latestYml = await generateLatestYml(exePath);
        const ymlPath = join(distPath, "latest.yml");
        require("fs").writeFileSync(ymlPath, latestYml);

        // Create git tag
        console.log(`Creating tag ${tag}...`);
        execSync(`git tag ${tag}`, { stdio: "inherit" });

        // Push tag to GitHub
        console.log(`Pushing tag to GitHub...`);
        execSync("git push --tags", { stdio: "inherit" });

        // Create GitHub release
        console.log("Creating GitHub release...");
        const release = await octokit.repos.createRelease({
            owner: "LuniZunie",
            repo: "WikiShield-App",
            tag_name: tag,
            name: `WikiShield ${version}`,
            body: `Release of WikiShield v${version}`,
            draft: false,
            prerelease: false
        });

        // Upload installer file
        console.log(`Uploading ${exeFile}...`);
        const exeContent = readFileSync(exePath);
        await octokit.repos.uploadReleaseAsset({
            owner: "LuniZunie",
            repo: "WikiShield-App",
            release_id: release.data.id,
            name: exeFile,
            data: exeContent,
            headers: {
                "content-type": "application/octet-stream"
            }
        });

        // Upload latest.yml
        console.log("Uploading latest.yml...");
        const ymlContent = readFileSync(ymlPath);
        await octokit.repos.uploadReleaseAsset({
            owner: "LuniZunie",
            repo: "WikiShield-App",
            release_id: release.data.id,
            name: "latest.yml",
            data: ymlContent,
            headers: {
                "content-type": "text/yaml"
            }
        });

        console.log(`\n✓ Success! Release ${tag} published to GitHub`);
        console.log(`\nRelease URL: https://github.com/LuniZunie/WikiShield-App/releases/tag/${tag}`);
        console.log(`Auto-updater will now download updates from this release.\n`);

    } catch (err) {
        console.error("\nFailed to publish:", err.message);
        process.exit(1);
    }
}

publishRelease();