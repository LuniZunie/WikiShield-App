const path = require('path');
const { spawn } = require('child_process');

class ORES {
    static enabled = false;

    static defaultModel = [ "damaging:true", "goodfaith:false" ];
    static servers = {
        "en.wikipedia.org": "enwiki",
        "test.wikipedia.org": "enwiki",
        "test2.wikipedia.org": "enwiki",
    }

    constructor(server, pythonPath) {
        this.server = ORES.servers[server] || "enwiki";
        if (pythonPath) {
            const parts = pythonPath.split(path.sep);
            this.pythonPath = parts[0];
            this.pythonArgs = parts.slice(1);
        } else {
            this.pythonPath = "py";
            this.pythonArgs = [ "-3.11" ];
        }
    }

    async score(revids, models) {
        models ??= ORES.defaultModel;
        if (!Array.isArray(revids) || revids.length === 0)
            return { };

        const input = revids.map(revid => JSON.stringify({ "rev_id": revid })).join("\n");

        const args = [
            ...this.pythonArgs,
            path.join(__dirname, "..", "py", "ores.py"),
            this.server,
            ...models.map(m => m.split(":")[0]),
        ];

        return new Promise((res, rej) => {
            const process = spawn(this.pythonPath, args, { stdio: [ "pipe", "pipe", "pipe" ], shell: true });

            let stdout = "", stderr = "";

            process.stdin.write(input);
            process.stdin.end();

            process.stdout.on("data", data => stdout += data.toString());
            process.stderr.on("data", data => stderr += data.toString());

            process.on("close", code => {
                if (code !== 0)
                    return rej(new Error(`ORES process exited with code ${code}: ${stderr.trim()}`));

                try {
                    const results = { };
                    const lines = stdout.trim().split("\n").filter(line => line.trim());

                    for (const line of lines)
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.revid && parsed.score)
                                results[parsed.revid] = parsed.score;
                        } catch (err) { }

                    res(results);
                } catch (err) { rej(err); }
            });
        });
    }

    extract(data, models) {
        models ??= ORES.defaultModel;

        const result = { };
        for (const [ revid, scores ] of Object.entries(data)) {
            const values = [ ];
            for (const model of models) {
                const [ name, field ] = model.split(":");

                const score = scores[name];
                if (!score) continue;

                let value = score.probability?.[field] ?? score[field];
                if (value === undefined && score.prediction !== undefined)
                    value = +score.prediction;

                if (value !== undefined && !isNaN(value))
                    values.push(value);
            }

            result[revid] = values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
        }

        return result;
    }
}

module.exports = { ORES };