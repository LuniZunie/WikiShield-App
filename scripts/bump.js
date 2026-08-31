const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = require(packageJsonPath);

const level = process.argv[2] || "--patch";
if (level.startsWith("--V")) {
    const newVersion = level.slice(3); // Remove "--V"
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
        console.error("Invalid version format. Please use 'major', 'minor', 'patch' or '--V<version>'.");
        process.exit(1);
    }
    packageJson.version = newVersion;
} else {
    const levelIndex = [ "--major", "--minor", "--patch" ].indexOf(level);
    if (levelIndex === -1) {
        console.error("Invalid version format. Please use 'major', 'minor', 'patch' or '--V<version>'.");
        process.exit(1);
    }

    packageJson.version = packageJson.version.split(".").map((v, i) => {
    if (i === levelIndex)
        return parseInt(v) + 1;
    return v;
    }).join(".");
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
execSync("npm run sync-version", { stdio: "inherit" });