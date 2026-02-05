const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const packageJson = require("../package.json");
const version = packageJson.version;
const tag = `v${version}`;

const templatePath = path.join(__dirname, "..", ".github", "RELEASE_TEMPLATE.md");
let template = fs.readFileSync(templatePath, "utf8");

template = template.replace(/1\.0\.0-dev3/g, version);
template = template.replace(/v1\.0\.0-dev3/g, tag);

let changelog = "";
try {
    const lastTag = execSync("git describe --tags --abbrev=0 HEAD^", { encoding: "utf8" }).trim();
    const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s"`, { encoding: "utf8" }).trim();
    if (commits)
        changelog = "\n### Changes\n" + commits + "\n";
} catch (err) {
    changelog = "\n### Changes\n- Initial release\n";
}

template = template.replace("<!-- Add your release notes here -->", changelog);

const outputPath = path.join(__dirname, "..", ".github", "RELEASE_NOTES.md");
fs.writeFileSync(outputPath, template, "utf8");

console.log(`Generated release notes for ${tag}`);
console.log(`\tSaved to: ${outputPath}`);
