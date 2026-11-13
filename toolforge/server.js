const net = require("node:net");
const { parseArgs } = require("node:util");

const http = require("http");
const cors = require("cors");
const express = require("express");

if (!(process.env.HOST === "localhost" || net.isIPv4(process.env.HOST)))
    throw new Error("Invalid HOST environment variable. Must be \"localhost\" or a valid IPv4 address.");
if (Number.isNaN(Number(process.env.PORT)))
    throw new Error("Invalid PORT environment variable. Must be a valid number.");

const { url } = (values => {
    switch (values.mode) {
        case "dev": {
            return { url: `http://${process.env.HOST}:${process.env.PORT}` };
        } break;
        case "prod": {
            return { url: "https://ws.toolforge.org" };
        } break;
        default: {
            throw new Error(`Invalid mode. Expected "dev" or "prod"; got "${values.mode}"`);
        } break;
    }
})(parseArgs({ options: { mode: { type: "string", short: "m", default: "dev" } } }).values);

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (typeof origin === "string") {
            if (/^https:\/\/[a-z0-9-]+\.wikipedia\.org$/.test(origin)) return callback(null, true);

            try {
                if (origin.startsWith(url)) return callback(null, true);
            } catch { /* ignore */ }

            if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
        }

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));

app.get("/oauth", (req, res) => {
    const { code, state } = req.query;
    const deepLink = `wikishield://callback?${code ? `code=${encodeURIComponent(code)}` : ''}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WikiShield - Opening App</title>
            <meta http-equiv="refresh" content="0; url=${deepLink}">
            <style>
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slide-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, .15); }
                    50% { box-shadow: 0 0 30px rgba(102, 126, 234, .25); }
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    padding: 0;

                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;

                    display: flex;
                    align-items: center;
                    justify-content: center;

                    width: 100vw;
                    min-height: 100vh;

                    overflow: hidden;

                    background: linear-gradient(135deg,
                        rgba(15, 12, 41, 1),
                        rgba(25, 22, 50, 1)
                    );

                    color: rgba(245, 247, 255, 1);

                    animation: fade-in .4s ease-out;
                }

                .container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;

                    max-width: 400px;
                    width: 100%;

                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, .05);

                    padding: 32px 24px;

                    text-align: center;

                    background: rgba(255, 255, 255, .02);
                    -webkit-backdrop-filter: blur(10px);
                            backdrop-filter: blur(10px);

                    animation: slide-up .5s ease-out .1s both;
                }

                .header-icon {
                    display: block;

                    margin-bottom: 4px;

                    font-size: 36px;

                    background: linear-gradient(135deg,
                        rgba(102, 126, 234, 1),
                        rgba(118, 75, 162, 1)
                    );
                    -webkit-background-clip: text;
                            background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .title {
                    margin: 0;

                    font-size: 16px;
                    font-weight: 600;

                    color: rgba(245, 247, 255, 1);
                }

                .spinner {
                    width: 32px;
                    height: 32px;

                    border: 3px solid rgba(255, 255, 255, .08);
                    border-top: 3px solid rgba(102, 126, 234, 1);
                    border-radius: 50%;

                    animation: spin 1s linear infinite;
                }

                .hint {
                    margin: 0;

                    font-size: 12px;
                    font-weight: 400;

                    color: rgba(200, 205, 220, .6);
                }

                .manual-link {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;

                    padding: 9px 20px;

                    border-radius: 8px;
                    border: 1px solid rgba(102, 126, 234, .4);

                    font-size: 13px;
                    font-weight: 600;
                    text-decoration: none;

                    background: rgba(102, 126, 234, .1);
                    color: rgba(102, 126, 234, 1);

                    transition: background .2s ease,
                                border-color .2s ease;
                }

                .manual-link:hover {
                    background: rgba(102, 126, 234, .2);
                    border-color: rgba(102, 126, 234, .6);

                    animation: glow-pulse 2s ease-in-out infinite;
                }

                .manual-link:active {
                    transform: scale(.97);
                }
            </style>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
        </head>
        <body>
            <div class="container">
                <span class="header-icon">
                    <i class="fas fa-user-circle"></i>
                </span>
                <p class="title">Opening WikiShield...</p>
                <div class="spinner"></div>
                <p class="hint">If the app doesn't open automatically:</p>
                <a href="${deepLink}" class="manual-link">Click here to open WikiShield</a>
            </div>
        </body>
        </html>
    `);
});

app.get("/health", (req, res) => res.status(200).send("ok"));
app.get("/popup", (req, res) => res.status(200).send("I'll add something here one day."));
app.get("/konami-easter-egg", (req, res) => res.status(301).redirect("https://youtu.be/QDia3e12czc"));
app.use((req, res) => res.status(404).send("404 Not Found"));

server.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Server running at ${url}`);
});