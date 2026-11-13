const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const fetch = require("node-fetch");

const { app, BrowserWindow, screen, nativeImage } = require("electron/main");
const Logger = require("electron-log");

class Server {
    static get PENDING_AUTH_PATH() {
        return path.join(app.getPath("userData"), "oauth-pending.json");
    }

    static savePendingAuth(auth) {
        fs.writeFileSync(Server.PENDING_AUTH_PATH, JSON.stringify(auth), { mode: 0o600 });
        fs.chmodSync(Server.PENDING_AUTH_PATH, 0o600);
    }

    static getPendingAuth() {
        try {
            return JSON.parse(fs.readFileSync(Server.PENDING_AUTH_PATH, "utf8"));
        } catch (err) {
            if (err.code !== "ENOENT")
                Logger.error("Failed to read pending OAuth authorization:", err);
            return null;
        }
    }

    static clearPendingAuth() {
        try {
            fs.unlinkSync(Server.PENDING_AUTH_PATH);
        } catch (err) {
            if (err.code !== "ENOENT")
                Logger.error("Failed to clear pending OAuth authorization:", err);
        }
    }

    static parseCallback(url, state) {
        const parsed = new URL(url);
        if (parsed.protocol !== "wikishield:" || parsed.hostname !== "callback")
            throw new Error("Invalid authorization callback URL");

        const secure = parsed.searchParams.get("state");
        if (!secure || secure !== state)
            throw new Error("Potential CSRF attack");

        const code = parsed.searchParams.get("code");
        if (!code)
            throw new Error("User denied authorization");

        return code;
    }

    static async exchangeCode(code, verifier) {
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: MediaWikiOAuth2.CLIENT,
            code,
            redirect_uri: "https://ws.toolforge.org/oauth",
            code_verifier: verifier
        });

        const tokenResponse = await fetch("https://meta.wikimedia.org/w/rest.php/oauth2/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });
        if (!tokenResponse.ok)
            throw new Error(`Token request failed with status ${tokenResponse.status}`);

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token || !tokenData.refresh_token)
            throw new Error("Missing access token or refresh token in response");

        return {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expires: new Date(Date.now() + tokenData.expires_in * 1000)
        };
    }

    static async completePendingCallback(url) {
        const pending = Server.getPendingAuth();
        if (!pending || !pending.state || !pending.verifier || !pending.createdAt) {
            Server.clearPendingAuth();
            throw new Error("No pending authorization was found for this callback");
        }

        if (Date.now() - pending.createdAt > Server.TIMEOUT) {
            Server.clearPendingAuth();
            throw new Error("Authorization timed out");
        }

        const code = Server.parseCallback(url, pending.state);
        try {
            return await Server.exchangeCode(code, pending.verifier);
        } finally {
            Server.clearPendingAuth();
        }
    }

    static generatePKCE() {
        const base64url = str => str.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

        const verifier = base64url(crypto.randomBytes(32));
        const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

        return { verifier, challenge };
    }

    static get TIMEOUT() { return 5 * 60 * 1000; } // 5 minutes

    static start(glob, abortSignal) {
        const state = crypto.randomBytes(16).toString("hex");
        const { verifier, challenge } = Server.generatePKCE();
        Server.savePendingAuth({ state, verifier, createdAt: Date.now() });

        let authWindow = null;
        return new Promise((resolve, reject) => {
            let handled = false;
            let timeout;
            const cleanup = () => {
                clearTimeout(timeout);
                app.removeListener("open-url", onOpenUrl);
                abortSignal?.removeEventListener("abort", onAbort);
            };
            const fail = err => {
                if (handled)
                    return;
                handled = true;
                cleanup();
                Server.clearPendingAuth();
                reject(err);
            };
            const onOpenUrl = (event, url) => {
                let parsed;
                try {
                    parsed = new URL(url);
                } catch (err) {
                    return;
                }
                if (parsed.protocol !== "wikishield:" || parsed.hostname !== "callback")
                    return;

                event.preventDefault();
                if (handled)
                    return;

                let code;
                try {
                    code = Server.parseCallback(url, state);
                } catch (err) {
                    return fail(err);
                }

                handled = true;
                cleanup();
                authWindow?.close?.();
                Server.exchangeCode(code, verifier).then(resolve).catch(err => {
                    Logger.error("Error handling OAuth2 callback:", err);
                    reject(err);
                }).finally(Server.clearPendingAuth);
            };
            const onAbort = () => {
                fail(new Error("Authorization aborted"));
                authWindow?.close?.();
            };

            try {
                app.on("open-url", onOpenUrl);
            } catch (err) {
                Server.clearPendingAuth();
                reject(err);
                return;
            }

            const params = new URLSearchParams({
                response_type: "code",
                client_id: MediaWikiOAuth2.CLIENT,
                redirect_uri: `https://ws.toolforge.org/oauth`,
                state: state,
                code_challenge: challenge,
                code_challenge_method: "S256"
            });

            const primaryDisplay = screen.getPrimaryDisplay();
            const windowWidth = Math.floor(primaryDisplay.workAreaSize.width * .8);
            const windowHeight = Math.floor(primaryDisplay.workAreaSize.height * .8);
            const parentBounds = glob.windows.authorize.getBounds();

            authWindow = new BrowserWindow({
                parent: glob.windows.authorize,
                modal: true,
                show: true,
                minimizable: false,
                maximizable: false,
                width: windowWidth,
                height: windowHeight,
                icon: nativeImage.createFromPath(path.join(__dirname, "..", "assets", "icon.png")),
                x: Math.floor(parentBounds.x + (parentBounds.width - windowWidth) / 2),
                y: Math.floor(parentBounds.y + (parentBounds.height - windowHeight) / 2),
                backgroundColor: "#1e1e1e",
                webPreferences: {
                    contextIsolation: true,
                    sandbox: true,
                    nodeIntegration: false,
                }
            });
            authWindow.setMenuBarVisibility(false);
            authWindow.loadURL(`https://meta.wikimedia.org/w/rest.php/oauth2/authorize?${params.toString()}`);
            authWindow.on("closed", () => {
                fail(new Error("Authorization window was closed by user"));
            });

            timeout = setTimeout(() => {
                fail(new Error("Authorization timed out"));
                authWindow?.close?.();
            }, Server.TIMEOUT);

            abortSignal?.addEventListener("abort", onAbort, { once: true });
            if (abortSignal?.aborted)
                onAbort();
        });
    }
}

class Throttle {
    #start;
    #count = 0;

    constructor(delay) {
        this.#start = Date.now();

        this.delay = delay;
        this.last = 0;
    }

    get count() {
        return this.#count;
    }

    per(divisor = 1) {
        return Math.floor(this.#count / ((Date.now() - this.#start) / divisor)) || 0;
    }

    call(fn, bypass = false) {
        this.#count++;

        const now = Date.now();
        const wait = Math.max(0, this.last + this.delay - now);
        this.last = now + wait;

        if (bypass || wait === 0)
            return fn();
        else
            return new Promise(resolve => setTimeout(async () => resolve(await fn()), wait));
    }
}

class MediaWikiOAuth2 {
    static get CLIENT() { return "e7fb2202e068e7ea6cc94530a0b4c626"; }
    // it actually does not matter that this is public, see https://phabricator.wikimedia.org/T323855, since the client is not confidential, we can ship the secret
    static get SECRET() { return "8a47e8dfee1818c1ce61c74e76dd61a06d2ac824"; }

    static async completeAuthorizationCallback(url) {
        return await Server.completePendingCallback(url);
    }

    constructor(userAgent) {
        this.userAgent = userAgent;
        this.accessToken = null;
        this.refreshToken = null;
        this.expires = null;

        this.throttle = new Throttle(0); // no delay by default
    }

    get() {
        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expires: this.expires
        };
    }
    set(accessToken, refreshToken, expires) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expires = expires;
    }

    async refresh() {
        if (!this.refreshToken)
            throw new Error("No refresh token available");

        const params = new URLSearchParams({
            client_id: MediaWikiOAuth2.CLIENT,
            client_secret: MediaWikiOAuth2.SECRET,

            refresh_token: this.refreshToken,
            grant_type: "refresh_token",
        });
        const data = await fetch("https://meta.wikimedia.org/w/rest.php/oauth2/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString()
        }).then(res => res.json());

        if (data.error)
            throw new Error(`Error refreshing access token: ${data.error} - ${data.error_description || ""}`);

        if (!data.access_token || !data.refresh_token)
            throw new Error("Missing access token or refresh token in response");

        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.expires = new Date(Date.now() + data.expires_in * 1000);

        return {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expires: this.expires
        };
    }

    async authorize(glob, abortSignal) {
        try {
            const data = await Server.start(glob, abortSignal);
            this.accessToken = data.accessToken;
            this.refreshToken = data.refreshToken;
            this.expires = data.expires;

            return data;
        } catch (err) { throw new Error(`OAuth2 authorization failed: ${err.message}`); }
    }

    async get(url, params = { }, signal = null, method = "POST", bypass) {
        if (!this.accessToken)
            throw new Error("No access token available");
        else if (this.expires && Date.now() >= (this.expires.getTime() - 30 * 60 * 1000)) // refresh 30 minutes before expiry
            await this.refresh();

        return [
            url,
            {
                method,
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": this.userAgent
                },
                body: method === "GET" ? undefined : new URLSearchParams(params).toString(),
                ...(bypass ? { priority: "high" } : { }),
                signal
            }
        ];
    }

    async fetch(url, params = { }, signal = null, method = "POST", bypass) {
        if (!this.accessToken)
            throw new Error("No access token available");
        else if (this.expires && Date.now() >= (this.expires.getTime() - 30 * 60 * 1000)) // refresh 30 minutes before expiry
            await this.refresh();

        if (this.throttle.count % 100 === 0)
            Logger.info(`OAuth2 request count: ${this.throttle.count}, rate: ${this.throttle.per(60 * 1000)} rpm`);

        try {
            const folder = path.join(app.getPath("userData"), "logs");
            const file = path.join(folder, "requests.txt");
            fs.mkdir(folder, { recursive: true }, err => {
                if (err) return;

                fs.appendFile(file, `[${new Date().toISOString()}] ${method} ${url + (method === "GET" ? "" : `?${new URLSearchParams(params).toString()}`)}\n`, err => {
                    if (err) return;
                });
            });
        } catch (err) {
            Logger.error("Failed to log OAuth2 request:", err);
        }

        return await this.throttle.call(async () => {
            return await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${this.accessToken}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": this.userAgent
                },
                body: method === "GET" ? undefined : new URLSearchParams(params).toString(),
                ...(bypass ? { priority: "high" } : { }),
                signal
            }).then(async res => {
                const text = await res.text();
                try {
                    return JSON.parse(text);
                } catch (err) {
                    const folder = path.join(app.getPath("userData"), "logs", "oauth2-responses");
                    const file = path.join(folder, `${Date.now()}.txt`);
                    try {
                        fs.mkdir(folder, { recursive: true }, err => {
                            if (err) return;

                            fs.writeFile(file, text, err => {
                                if (err) return;

                                Logger.error(`Failed to parse OAuth2 response, saved to ${file} (rpm: ${this.throttle.per(60 * 1000)})`);
                                fs.readdir(folder, (err, files) => {
                                    if (err) return;
                                    const sortedFiles = files.map(f => {
                                        try {
                                            return { name: f, time: fs.statSync(path.join(folder, f)).mtime.getTime() };
                                        } catch (err) { return null; }
                                    }).filter(f => f !== null)
                                        .sort((a, b) => b.time - a.time);
                                    for (let i = 100; i < sortedFiles.length; i++)
                                        fs.unlink(path.join(folder, sortedFiles[i].name), () => { });
                                });
                            });
                        });
                    } catch (err) { }

                    throw err;
                }
            }).catch(err => {
                Logger.error(`Fetch failed: ${err.message}`);
                throw err;
            });
        }, bypass);
    }
}

module.exports = { MediaWikiOAuth2 };