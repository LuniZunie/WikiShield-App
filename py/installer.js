const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");

const Logger = require("electron-log");

class PythonInstaller {
    constructor(appData) {
        this.appData = appData;

        this.pythonDir = path.join(this.appData, "python");
        this.pythonPath = null;

        this.venvPath = path.join(this.pythonDir, "venv");
    }

    async check() {
        try {
            const configPath = path.join(this.pythonDir, "config.json");
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
                if (fs.existsSync(config.pythonPath)) {
                    this.pythonPath = config.pythonPath;
                    if (await this.checkORESInstalled())
                        return void(Logger.debug("Python and ORES already configured")) ?? true;
                }
            }

            const systemPython = await this.findSystemPython();
            if (systemPython) {
                this.pythonPath = systemPython;
                const installed = await this.checkORESInstalled();
                if (installed)
                    return void(Logger.debug("Found system Python with ORES installed")) ?? void(this.saveConfig()) ?? true;
            }

            return false;
        } catch (err) { return void(Logger.error("Error checking Python:", err)) ?? false; }
    }

    async findSystemPython() {
        const candidates = [];

        if (process.platform === "win32")
            candidates.push(
                "py -3.11",
                "python3.11",
                "python3",
                "python"
            );
        else if (process.platform === "darwin")
            candidates.push(
                "python3.11",
                "python3",
                "/usr/local/bin/python3.11",
                "/opt/homebrew/bin/python3.11"
            );
        else
            candidates.push(
                "python3.11",
                "python3",
                "/usr/bin/python3.11"
            );

        for (const candidate of candidates)
            try {
                if ((await this.checkPythonVersion(candidate))?.startsWith("3.11"))
                    return void(Logger.debug(`Found Python 3.11: ${candidate}`)) ?? candidate;
            } catch (err) { }

        return null;
    }

    checkPythonVersion(pythonCmd) {
        return new Promise((res, rej) => {
            const args = pythonCmd.split(" ");
            const cmd = args.shift();
            args.push("--version");

            const proc = spawn(cmd, args, {
                shell: true,
                stdio: [ "ignore", "pipe", "pipe" ]
            });

            let output = "";
            proc.stdout.on("data", (data) => output += data.toString());
            proc.stderr.on("data", (data) => output += data.toString());

            proc.on("close", code => {
                if (code === 0)
                    res(output.match(/Python (\d+\.\d+)/)?.[1] ?? null);
                else
                    rej(new Error(`Python version check failed with code ${code}`));
            });
            proc.on("error", rej);
        });
    }

    async checkORESInstalled() {
        return new Promise(res => {
            const args = this.pythonPath.split(" ");
            const cmd = args.shift();
            args.push("-c", "\"import ores; print(ores.__version__)\"");

            const proc = spawn(cmd, args, {
                shell: true,
                stdio: [ "ignore", "pipe", "pipe" ]
            });

            let success = false;
            proc.stdout.on("data", () => success = true);

            proc.on("close", () => res(success));
            proc.on("error", () => res(false));
        });
    }

    async install() {
        Logger.debug("Installing Python 3.11...");
        if (!fs.existsSync(this.pythonDir))
            fs.mkdirSync(this.pythonDir, { recursive: true });

        switch (process.platform) {
            case "win32":
                return await this.installWindowsPython();
            case "darwin":
                return await this.installMacPython();
            default:
                return await this.installLinuxPython();
        }
    }

    async installWindowsPython() {
        const pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip";
        const zipPath = path.join(this.pythonDir, "python.zip");
        const extractPath = path.join(this.pythonDir, "embed");

        Logger.debug("Downloading Python embeddable package...");
        await this.downloadFile(pythonUrl, zipPath);

        Logger.debug("Extracting Python...");
        await this.extractZip(zipPath, extractPath);

        this.pythonPath = path.join(extractPath, "python.exe");
        await this.installPip();

        this.saveConfig();
        return true;
    }

    async installMacPython() {
        throw new Error("Please install Python 3.11 from https://www.python.org/downloads/ or using Homebrew: brew install python@3.11");
    }

    async installLinuxPython() {
        throw new Error("Please install Python 3.11 using your package manager: sudo apt install python3.11 (Ubuntu/Debian) or sudo dnf install python3.11 (Fedora)");
    }

    downloadFile(url, dest) {
        return new Promise((res, rej) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301)
                    return this.downloadFile(response.headers.location, dest).then(res).catch(rej);

                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    res();
                });
            }).on("error", (err) => {
                fs.unlinkSync(dest);
                rej(err);
            });
        });
    }

    async extractZip(zipPath, destPath) {
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }

        return new Promise((res, rej) => {
            const cmd = `powershell -command "Expand-Archive -Path "${zipPath}" -DestinationPath "${destPath}" -Force"`;

            const proc = spawn(cmd, [], { shell: true });

            proc.on("close", code => {
                if (code === 0)
                    res();
                else
                    rej(new Error("Extract failed"));
            });

            proc.on("error", rej);
        });
    }

    async installPip() {
        const getPipUrl = "https://bootstrap.pypa.io/get-pip.py";
        const getPipPath = path.join(this.pythonDir, "get-pip.py");

        Logger.debug("Downloading get-pip.py...");
        await this.downloadFile(getPipUrl, getPipPath);

        Logger.debug("Installing pip...");
        return new Promise((res, rej) => {
            const proc = spawn(this.pythonPath, [ getPipPath ], {
                shell: true,
                stdio: "inherit"
            });

            proc.on("close", code => {
                if (code === 0)
                    res();
                else
                    rej(new Error("pip installation failed"));
            });

            proc.on("error", rej);
        });
    }

    async installORES() {
        Logger.debug("Installing ORES...");

        const args = this.pythonPath.split(" ");
        const cmd = args.shift();
        args.push("-m", "pip", "install", "ores==0.3.1");

        return new Promise((res, rej) => {
            const proc = spawn(cmd, args, {
                shell: true,
                stdio: "inherit"
            });

            proc.on("close", code => {
                if (code === 0)
                    void(Logger.debug("ORES installed successfully")) ?? res();
                else
                    rej(new Error("ORES installation failed"));
            });

            proc.on("error", rej);
        });
    }

    saveConfig() {
        if (!fs.existsSync(this.pythonDir))
            fs.mkdirSync(this.pythonDir, { recursive: true });

        const configPath = path.join(this.pythonDir, "config.json");
        fs.writeFileSync(configPath, JSON.stringify({
            pythonPath: this.pythonPath,
            version: "3.11",
            oresVersion: "0.3.1"
        }, null, 2));
    }

    async setup() {
        try {
            const exists = await this.check();
            if (exists)
                return this.pythonPath;

            const systemPython = await this.findSystemPython();
            if (systemPython) {
                this.pythonPath = systemPython;

                const oresInstalled = await this.checkORESInstalled();
                if (!oresInstalled)
                    await this.installORES();

                this.saveConfig();
                return this.pythonPath;
            }

            if (process.platform === "win32") {
                await this.install() && await this.installORES();
                return this.pythonPath;
            } else
                throw new Error("Python 3.11 not found. Please install it manually.");
        } catch (err) {
            Logger.error("Python setup failed:", err);
            throw err;
        }
    }
}

module.exports = { PythonInstaller };