const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const {
    app, BrowserWindow, Menu, Tray, Notification, nativeImage,
    screen, ipcMain, dialog, globalShortcut, clipboard, crashReporter
} = require("electron/main");
const Store = require("electron-store");
const Logger = require("electron-log");
const { autoUpdater } = require("electron-updater");

const { generateRandomUUID } = require("./global/UUID/script.com.js");
const { Security } = require("./app/security.js");
const { Translator } = require("./app/translate.js");
const { CreateBadgeIcon } = require("./app/badge.js");
const { MediaWikiOAuth2 } = require("./wikipedia/oauth2.js");
const { MediaWikiAPI } = require("./wikipedia/api.js");

// constants
const __dev__ = process.env.NODE_ENV === "development" || process.env.ELECTRON_ENV === "development" || !app.isPackaged;
const __servers__ = require("./servers.js");
const __userAgent__ = `WikiShield-Bot/${app.getVersion()} (https://en.wikipedia.org/wiki/Wikipedia:WikiShield; lunizunie@gmail.com)`;

// global references
const glob = {
    quitting: false,

    windows: {
        main: null,
        signin: null,
        authorize: null,
        translation: null
    },

    window: {
        width: null,
        height: null,
        isMaximized: true,
        isFullScreen: false
    },

    server: null,

    accounts: [ ],
    account: null,
    rememberAccounts: false,

    notifications: true,

    python: null,
    mwapi: null,
};

// single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock)
    app.quit();

// process
if (process.platform === "win32")
    app.setAppUserModelId("me.luni.wikishield");

// squirrel
if (process.platform === "win32") {
    if (process.argv.length === 1)
        app.quit();

    const updateExe = path.resolve(path.resolve(process.execPath, "..", "..", "Update.exe"));
    const spawner = (command, args) => {
        try {
            return spawn(command, args, { detached: true });
        } catch (e) { }
    };
    const spawnerUpdate = args => spawner(updateExe, args);

    const exeName = path.basename(process.execPath);
    switch (process.argv[1]) {
        case "--squirrel-install":
        case "--squirrel-updated": {
            spawnerUpdate([ "--createShortcut", exeName ]);
            setTimeout(() => {
                glob.quitting = true;
                app.quit();
            }, 1000);
        } break;
        case "--squirrel-uninstall": {
            spawnerUpdate([ "--removeShortcut", exeName ]);
            setTimeout(() => {
                glob.quitting = true;
                app.quit();
            }, 1000);
        } break;
        case "--squirrel-obsolete": {
            glob.quitting = true;
            app.quit();
        } break;
    }
}

// GPU / media flags for smooth video playback in webviews
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-features", "VaapiVideoDecoder,VaapiVideoEncoder,CanvasOopRasterization");
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// listen for custom protocol (wikishield://)
if (process.defaultApp) {
    if (process.argv.length >= 2)
        app.setAsDefaultProtocolClient("wikishield", process.execPath, [ path.resolve(process.argv[1]) ]);
} else
    app.setAsDefaultProtocolClient("wikishield");

app.on("second-instance", (event, argv) => {
    const url = argv.find(arg => arg.startsWith("wikishield://"));
    if (url) {
        app.emit("open-url", event, url);
        event.preventDefault();
    }

    if (glob.windows.main && !glob.windows.main.isDestroyed()) {
        if (glob.windows.main.isMinimized())
            glob.windows.main.restore();
        if (!glob.windows.main.isVisible())
            glob.windows.main.show();
        glob.windows.main.focus();
        glob.windows.main.moveTop();
    } else if (glob.windows.signin && !glob.windows.signin.isDestroyed()) {
        glob.windows.signin.focus();
        glob.windows.signin.moveTop();
    }
});

// storage
const store = new Store({
    clearInvalidConfig: true,
    defaults: {
        window: {
            width: null,
            height: null,
            isMaximized: true,
            isFullScreen: false
        },

        server: __servers__[0].host,

        accounts: { },
        account: null,
        rememberAccounts: false,

        notifications: true,
    }
});

glob.window = store.get("window", { width: null, height: null, isMaximized: true, isFullScreen: false });

glob.server = store.get("server", __servers__[0].host);

glob.notifications = store.get("notifications", true);
glob.rememberAccounts = store.get("rememberAccounts", false);

// crash reporter
crashReporter.start({ uploadToServer: false });

// logging
Logger.transports.file.file = path.join(app.getPath("userData"), "logs", "wikishield.log");
Logger.transports.file.level = __dev__ ? "debug" : "info";
Logger.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}";

// Auto-updater
autoUpdater.logger = Logger;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => Logger.debug("Checking for updates..."));
autoUpdater.on("update-available", info => {
    Logger.debug(`Update available: version ${info.version}`);
    NotificationHandler.send({
        title: "Update Available",
        body: `Version ${info.version} is available and will be downloaded automatically.`,
    });
});
autoUpdater.on("update-not-available", () => Logger.debug("No updates available."));
autoUpdater.on("download-progress", progressObj =>
    Logger.debug(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`)
);
autoUpdater.on("error", err => {
    Logger.error(`Auto-updater error: ${err == null ? "unknown" : (err.stack || err).toString()}`);
    if (!(err.message.includes("net::") || err.message.includes("ENOTFOUND")))
        dialog.showErrorBox("Update Error", `An error occurred while updating: ${err.message}`);
});
autoUpdater.on("update-downloaded", info =>
    NotificationHandler.send({
        title: "Update Ready to Install",
        body: `Version ${info.version} has been downloaded and will be installed on quit.`,
    })
);

// windows
function UpdateMenu(options = { }) {
    const __mac__ = process.platform === "darwin";
    const template = [
        {
            label: glob.account ? `${glob.account.username}@${glob.server}` : "Logged out",
            submenu: [
                {
                    label: "Servers",
                    type: "submenu",
                    submenu: __servers__.map(server => server.name === "seperator" ? { type: "separator" } : {
                        label: server.name,
                        type: "checkbox",
                        click: () => {
                            glob.server = server.host;
                            store.set("server", server.host);

                            if (glob.windows.main)
                                glob.windows.main.reload();

                            UpdateMenu(options);
                        },
                        checked: glob.server === server.host
                    })
                },
                { type: "separator" },
                ...Object.entries(glob.accounts)
                    .sort(([ , a ], [ , b ]) => new Date(a.lastUsed || 0) < new Date(b.lastUsed || 0) ? 1 : -1)
                    .map(([ username, account ]) => ({
                        label: `${username}${account.valid ? "" : " (signed out)"}`,
                        type: "submenu",
                        submenu: [
                            {
                                label: "Switch to account",
                                click: () => {
                                    glob.account = account;
                                    if (glob.rememberAccounts)
                                        store.set("account", username);

                                    if (glob.windows.main)
                                        glob.windows.main.reload();

                                    UpdateMenu(options);
                                },
                                enabled: glob.account !== account && account.valid
                            },
                            {
                                label: "Remove account",
                                click: () => {
                                    delete glob.accounts[username];
                                    if (glob.rememberAccounts)
                                        store.set("accounts", Security.encryptAccounts(glob.accounts));

                                    if (glob.account === account) {
                                        glob.account = null;
                                        if (glob.rememberAccounts)
                                            store.set("account", null);

                                        if (glob.windows.main)
                                            glob.windows.main.close();

                                        BuildWindow.signin();
                                    }

                                    UpdateMenu(options);
                                },
                            }
                        ]
                    })),
                { type: "separator" },
                {
                    label: "Logout",
                    click: () => {
                        glob.account = null;
                        delete glob.accounts[glob.account.username];
                        if (glob.rememberAccounts) {
                            store.set("account", null);
                            store.set("accounts", Security.encryptAccounts(glob.accounts));
                        }

                        if (glob.windows.main)
                            glob.windows.main.close();

                        BuildWindow.signin();
                    }
                },
                {
                    label: "Account Manager",
                    click: () => BuildWindow.signin()
                }
            ]
        },
        {
            label: 'Settings',
            submenu: [
                {
                    label: 'Notifications',
                    type: 'checkbox',
                    click() {
                        glob.notifications = !glob.notifications;
                        store.set("notifications", glob.notifications);
                    },
                    checked: glob.notifications
                },
                { type: 'separator' },
                {
                    label: 'Preferences',
                    click() {
                        if (glob.windows.main)
                            glob.windows.main.webContents.send("open-settings");
                    },
                    enabled: options?.settings?.preferences ?? false
                },
                { type: 'separator' },
                {
                    label: 'Import',
                    submenu: [
                        {
                            label: 'From Clipboard',
                            click() {
                                if (glob.windows.main)
                                    glob.windows.main.webContents.send("import-settings-from-clipboard");
                            }
                        },
                        {
                            label: 'From Input',
                            click() {
                                if (glob.windows.main)
                                    glob.windows.main.webContents.send("import-settings-from-input");
                            }
                        }
                    ],
                },
                {
                    label: 'Export',
                    submenu: [
                        {
                            label: 'To Clipboard',
                            click() {
                                if (glob.windows.main)
                                    glob.windows.main.webContents.send("export-settings-to-clipboard");
                            }
                        }
                    ],
                }
            ]
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "selectAll" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "pasteAndMatchStyle" },
                { type: "separator" },
                ...(__mac__ ? [
                    {
                        label: "Typing",
                        submenu: [
                            { role: "showSubstitutions" },
                            { role: "toggleSmartQuotes" },
                            { role: "toggleSmartDashes" },
                            { role: "toggleTextReplacement" },
                            { role: "toggleSpellChecker" }
                        ]
                    }
                ] : [
                    { role: "toggleSpellChecker" }
                ])
            ]
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forcereload" },
                { type: "separator" },
                { role: "resetzoom" },
                { role: "zoomin" },
                { role: "zoomout" },
                { type: "separator" },
                { role: "minimize" },
                { role: "togglefullscreen" }
            ]
        },
        {
            label: "Browser",
            click() {
                if (glob.windows.main)
                    glob.windows.main.webContents.send("open-browser");
            },
            enabled: options?.browser ?? false
        },
        {
            label: "Email",
            submenu: [
                {
                    label: "Email oversight",
                    click() {
                        if (glob.windows.main)
                            glob.windows.main.webContents.send("open-url", "https://en.wikipedia.org/wiki/Special:EmailUser/Oversight");
                    }
                },
                {
                    label: "Email emergency",
                    click() {
                        if (glob.windows.main)
                            glob.windows.main.webContents.send("open-url", "https://en.wikipedia.org/wiki/Special:EmailUser/Emergency");
                    }
                }
            ],
            enabled: options?.browser ?? false
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "WikiShield",
                    click() {
                        if (glob.windows.main)
                            glob.windows.main.webContents.send("open-url", "https://en.wikipedia.org/wiki/Wikipedia:WikiShield");
                    }
                },
                {
                    label: "Changelog",
                    click: () => {
                        if (glob.windows.main)
                            glob.windows.main.webContents.send("open-changelog");
                    }
                },
                { type: "separator" },
                {
                    label: "Check for Updates...",
                    click: () => {
                        autoUpdater
                            .checkForUpdates()
                            .then(result => {
                                if (!result || result.updateInfo.version === app.getVersion())
                                    dialog.showMessageBox({
                                        type: "info",
                                        title: "No Updates",
                                        message: `Latest version running (${app.getVersion()})`,
                                        buttons: [ "OK" ]
                                    });
                            })
                            .catch(err => dialog.showErrorBox("Update Check Failed", `Failed to check for updates: ${err.message}`));
                    }
                },
                { type: "separator" },
                ...(__dev__ ? [
                    { role: "toggleDevTools" },
                    { type: "separator" }
                ] : []),
                { type: "separator" },
                { role: "about" },
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function BuildTray() { // TODO
    const tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")));
    tray.setToolTip("WikiShield");

    tray.on("click", () => {
        if (glob.windows.main.isVisible())
            glob.windows.main.minimize();
        else {
            glob.windows.main.restore();
            glob.windows.main.focus();
        }
    });

    const contextMenu = Menu.buildFromTemplate([
        {
            label: "Quit WikiShield",
            click: () => {
                glob.quitting = true;
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);

    return tray;
}

class BuildWindow {
    static main() {
        if (glob.quitting) return;
        if (glob.account === null)
            return BuildWindow.signin();
        else if (glob.windows.main)
            glob.windows.main.close();

        if (glob.windows.signin) {
            glob.windows.signin.close();
            glob.windows.signin = null;
        }

        const primary = screen.getPrimaryDisplay();
        glob.windows.main = new BrowserWindow({
            width: glob.window.width ?? primary.workAreaSize.width,
            height: glob.window.height ?? primary.workAreaSize.height,
            show: false,
            backgroundColor: "#1e1e1e",
            icon: nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")),
            webPreferences: {
                preload: path.join(__dirname, "preload", "main.js"),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                sandbox: true,
                v8CacheOptions: "code",
                disableBlinkFeatures: "Auxclick",
                backgroundThrottling: false
            }
        });

        UpdateMenu({ });

        glob.windows.main.webContents.on("context-menu", (event, params) => {
            const contextMenu = Menu.buildFromTemplate([
                ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                { type: "separator" },
                { role: "selectAll" },
                ...(params.selectionText ? [
                    { type: "separator" },
                    {
                        label: "Translate",
                        click: async () => {
                            BuildWindow.translation(glob.windows.main);
                            const result = await Translator.translate(glob, params.selectionText);
                            if (result && glob.windows.translation)
                                glob.windows.translation.webContents.send("set-translation", {
                                    before: params.selectionText,
                                    after: result.text,
                                    language: result.language,
                                    target: result.target
                                });
                            else
                                dialog.showErrorBox("Translation Error", "An error occurred while translating the selected text.");
                        }
                    }
                ] : [ ]),
                ...(__dev__ ? [
                    { type: "separator" },
                    {
                        label: "Inspect Element",
                        click: () => {
                            glob.windows.main.webContents.inspectElement(params.x, params.y);
                        }
                    }
                ] : [ ])
            ]);
            contextMenu.popup(glob.windows.main, params.x, params.y);
        });

        glob.windows.main.webContents.executeJavaScript(`
            document.addEventListener("auxclick", event => {
                if (event.button === 1) {
                    const $link = event.target.closest("a[href]");
                    if ($link) {
                        event.preventDefault();
                        electron.openInBrowser($link.href);
                    }
                }
            }, true);
        `);

        glob.windows.main.loadFile(path.join(__dirname, "src", "wikishield", "index.html"));

        glob.windows.main.once("ready-to-show", () => {
            if (!glob.windows.main)
                return;

            if (glob.window.isMaximized)
                glob.windows.main.maximize();
            if (glob.window.isFullScreen)
                glob.windows.main.setFullScreen(true);
            glob.windows.main.show();
        });

        glob.windows.main.on("close", event => {
            if (!glob.windows.main)
                return;

            glob.windows.main.webContents.send("beforeunload");

            const [ width, height ] = glob.windows.main.getSize();
            glob.window.width = width;
            glob.window.height = height;
            glob.window.isMaximized = glob.windows.main.isMaximized();
            glob.window.isFullScreen = glob.windows.main.isFullScreen();
            store.set("window", glob.window);

            event.preventDefault();

            ipcMain.once("unloaded", () => {
                if (!glob.windows.main)
                    return;

                glob.windows.main.destroy();
                glob.windows.main = null;
            });
            setTimeout(() => {
                if (!glob.windows.main)
                    return;

                glob.windows.main.destroy();
                glob.windows.main = null;
            }, 250);
        });

        return glob.windows.main;
    }
    static signin() {
        if (glob.quitting) return;
        if (glob.windows.signin)
            glob.windows.signin.close();
        if (glob.windows.main)
            glob.windows.main.close();
        if (glob.windows.authorize) {
            glob.windows.authorize.close();
            glob.windows.authorize = null;
        }

        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        const vmin = Math.min(width, height);

        glob.windows.signin = new BrowserWindow({
            modal: true,
            show: false,
            width: Math.floor(vmin * 0.9),
            height: Math.floor(vmin * 0.7),
            frame: false,
            resizable: false,
            maximizable: false,
            minimizable: false,
            backgroundColor: "#1e1e1e",
            icon: nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")),
            webPreferences: {
                preload: path.join(__dirname, "preload", "signin.js"),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                sandbox: true,
                v8CacheOptions: "code",
                disableBlinkFeatures: "Auxclick",
                backgroundThrottling: false
            }
        });

        glob.windows.signin.webContents.on("context-menu", (event, params) => {
            const contextMenu = Menu.buildFromTemplate([
                ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                { type: "separator" },
                { role: "selectAll" },
                ...(__dev__ ? [
                    { type: "separator" },
                    {
                        label: "Inspect Element",
                        click: () => {
                            glob.windows.signin.webContents.inspectElement(params.x, params.y);
                        }
                    }
                ] : [ ])
            ]);
            contextMenu.popup(glob.windows.signin, params.x, params.y);
        });

        glob.windows.signin.loadFile(path.join(__dirname, "src", "signin", "index.html"));
        glob.windows.signin.setMenuBarVisibility(false);

        glob.windows.signin.once("ready-to-show", () => glob.windows.signin.show());

        glob.windows.signin.on("close", () => {
            if (glob.windows.authorize) {
                glob.windows.authorize.close();
                glob.windows.authorize = null;
            }

            glob.windows.signin = null;
            if (glob.account === null)
                app.quit();
        });

        return glob.windows.signin;
    }
    static authorize() {
        if (glob.quitting) return;
        if (glob.windows.authorize)
            glob.windows.authorize.close();

        if (glob.windows.main)
            glob.windows.main.close();

        glob.windows.authorize = new BrowserWindow({
            parent: glob.windows.signin || null,
            modal: true,
            show: false,
            frame: false,
            resizable: false,
            maximizable: false,
            minimizable: false,
            backgroundColor: "#1e1e1e",
            icon: nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")),
            webPreferences: {
                preload: path.join(__dirname, "preload", "authorize.js"),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                sandbox: true,
                v8CacheOptions: "code",
                disableBlinkFeatures: "Auxclick",
                backgroundThrottling: false
            }
        });

        glob.windows.authorize.webContents.on("context-menu", (event, params) => {
            const contextMenu = Menu.buildFromTemplate([
                ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                { type: "separator" },
                { role: "selectAll" },
                ...(__dev__ ? [
                    { type: "separator" },
                    {
                        label: "Inspect Element",
                        click: () => {
                            glob.windows.authorize.webContents.inspectElement(params.x, params.y);
                        }
                    }
                ] : [ ])
            ]);
            contextMenu.popup(glob.windows.authorize, params.x, params.y);
        });

        glob.windows.authorize.loadFile(path.join(__dirname, "src", "authorize", "index.html"));
        glob.windows.authorize.setMenuBarVisibility(false);

        glob.windows.authorize.once("ready-to-show", () => {
            glob.windows.authorize.show();
            glob.windows.signin.webContents.send("signin-blur-window");
        });

        return glob.windows.authorize;
    }

    static translation(parent) {
        if (glob.quitting) return;

        if (glob.windows.translation)
            glob.windows.translation.close();

        glob.windows.translation = new BrowserWindow({
            parent: parent || null,
            autoHideMenuBar: true,
            titleBarStyle: "hidden",
            resizable: false,
            maximizable: false,
            minimizable: false,
            backgroundColor: "#1e1e1e",
            icon: nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")),
            webPreferences: {
                preload: path.join(__dirname, "preload", "translation.js"),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                sandbox: true,
                v8CacheOptions: "code",
                disableBlinkFeatures: "Auxclick",
                backgroundThrottling: false
            }
        });

        glob.windows.translation.loadFile(path.join(__dirname, "src", "translation", "index.html"));
        glob.windows.translation.setMenuBarVisibility(false);

        glob.windows.translation.webContents.on("context-menu", (event, params) => {
            const contextMenu = Menu.buildFromTemplate([
                ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                { type: "separator" },
                { role: "selectAll" },
                ...(__dev__ ? [
                    { type: "separator" },
                    {
                        label: "Inspect Element",
                        click: () => {
                            glob.windows.translation.webContents.inspectElement(params.x, params.y);
                        }
                    }
                ] : [ ])
            ]);
            contextMenu.popup(glob.windows.translation, params.x, params.y);
        });

        glob.windows.translation.once("closed", () => {
            glob.windows.translation = null;
        });

        return glob.windows.translation;
    }
}

class Popup {
    static windows = new Map();

    static create(url) {
        const id = generateRandomUUID();
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;

        const popup = new BrowserWindow({
            parent: glob.windows.main,
            width: Math.floor(width * 0.8),
            height: Math.floor(height * 0.8),
            autoHideMenuBar: true,
            titleBarStyle: "hidden",
            resizable: false,
            maximizable: false,
            minimizable: false,
            backgroundColor: "#1e1e1e",
            icon: nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png")),
            webPreferences: {
                preload: path.join(__dirname, "preload", "browser.js"),
                contextIsolation: true,
                nodeIntegration: false,
                enableRemoteModule: false,
                webviewTag: true,
                sandbox: false,
                v8CacheOptions: "code",
                disableBlinkFeatures: "Auxclick",
                backgroundThrottling: false
            }
        });
        Popup.windows.set(id, popup);

        popup.webContents.on("did-attach-webview", (event, webContents) => {
            webContents.setBackgroundThrottling(false);
            webContents.on("context-menu", (e, params) => {
                const contextMenu = Menu.buildFromTemplate([
                    ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                    ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                    ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                    { type: "separator" },
                    { role: "selectAll" },
                    ...(params.linkURL ? [
                        { type: "separator" },
                        { role: "copyLinkAddress" },
                        {
                            label: "Open Link in New Tab",
                            click: () => popup.webContents.send("open-link-in-new-tab", params.linkURL)
                        },
                        {
                            label: "Open Link in Browser",
                            click: () => Security.openExternal(params.linkURL)
                        },
                    ] : [ ]),
                    ...(params.selectionText ? [
                        { type: "separator" },
                        {
                            label: "Translate",
                            click: async () => {
                                BuildWindow.translation(popup);
                                const result = await Translator.translate(glob, params.selectionText);
                                if (result && glob.windows.translation)
                                    glob.windows.translation.webContents.send("set-translation", {
                                        before: params.selectionText,
                                        after: result.text,
                                        language: result.language,
                                        target: result.target
                                    });
                                else
                                    dialog.showErrorBox("Translation Error", "An error occurred while translating the selected text.");
                            }
                        }
                    ] : [ ]),
                    ...(__dev__ ? [
                        { type: "separator" },
                        {
                            label: "Inspect Element",
                            click: () => popup.webContents.inspectElement(params.x, params.y)
                        }
                    ] : [ ])
                ]);
                contextMenu.popup();
            });
        });
        popup.webContents.on("context-menu", (e, params) => {
            const contextMenu = Menu.buildFromTemplate([
                ...(params.editFlags.canCopy ? [ { role: "copy" } ] : [ ]),
                ...(params.editFlags.canCut ? [ { role: "cut" } ] : [ ]),
                ...(params.editFlags.canPaste ? [ { role: "paste" } ] : [ ]),
                { type: "separator" },
                { role: "selectAll" },
                ...(params.linkURL ? [
                    { type: "separator" },
                    { role: "copyLinkAddress" },
                    {
                        label: "Open Link in New Tab",
                        click: () => popup.webContents.send("open-link-in-new-tab", params.linkURL)
                    },
                    {
                        label: "Open Link in Browser",
                        click: () => Security.openExternal(params.linkURL)
                    },
                ] : [ ]),
                ...(params.selectionText ? [
                    { type: "separator" },
                    {
                        label: "Translate",
                        click: async () => {
                            BuildWindow.translation(popup);
                            const result = await Translator.translate(glob, params.selectionText);
                            if (result && glob.windows.translation)
                                glob.windows.translation.webContents.send("set-translation", {
                                    before: params.selectionText,
                                    after: result.text,
                                    language: result.language,
                                    target: result.target
                                });
                            else
                                dialog.showErrorBox("Translation Error", "An error occurred while translating the selected text.");
                        }
                    }
                ] : [ ]),
                ...(__dev__ ? [
                    { type: "separator" },
                    {
                        label: "Inspect Element",
                        click: () => popup.webContents.inspectElement(params.x, params.y)
                    }
                ] : [ ])
            ]);
            contextMenu.popup(popup, params.x, params.y);
        });

        const browser = path.join(__dirname, "src", "browser", "index.html");
        popup.loadFile(browser, { query: { url: url, host: glob.server } });

        const attached = new Set();
        popup.webContents.on("did-attach-webview", (event, webContents) => {
            attached.add(webContents);
            webContents.on("destroyed", () => attached.delete(webContents));

            webContents.setWindowOpenHandler(({ url }) => {
                popup.webContents.send("open-link-in-new-tab", url);
                return { action: "deny" };
            });
        });

        popup.on("close", () => {
            for (const webContents of attached)
                if (!webContents.isDestroyed() && webContents.isDevToolsOpened())
                    webContents.closeDevTools();
            attached.clear();

            if (!popup.webContents.isDestroyed() && popup.webContents.isDevToolsOpened())
                popup.webContents.closeDevTools();
        });
        popup.on("closed", () => {
            Popup.windows.delete(id);
            if (glob.windows.main?.webContents && !glob.windows.main.isDestroyed())
                glob.windows.main.webContents.send("popup-closed", id);
        });

        return id;
    }
}

class NotificationHandler {
    static garbage = new Set();

    static send(options, url, force = false) {
        if (!glob.notifications && !force)
            return;

        if (Notification.isSupported()) {
            let icon = options.icon || nativeImage.createFromPath(path.join(__dirname, "assets", "icon.png"));
            if (!icon.isEmpty() && process.platform === "win32")
                icon = icon.resize({ width: 256, height: 256 });

            const notification = new Notification({ ...options, icon });
            NotificationHandler.garbage.add(notification);

            if (typeof url === "string")
                notification.on("click", () => {
                    if (glob.windows.main) {
                        if (glob.windows.main.isMinimized())
                            glob.windows.main.restore();
                        glob.windows.main.focus();
                        glob.windows.main.webContents.send("open-notification", url);
                    } else
                        Security.openExternal(url);
                });

            notification.on("close", () => NotificationHandler.garbage.delete(notification));

            notification.show();
            return notification;
        }
    }
}

// API
async function CreateAPI(username = null, api = true) {
    const active = username ?? glob.account?.username ?? null;
    if (active === null)
        return null;

    const oauth = glob.accounts[active];
    if (!oauth)
        return null;

    const mw = new MediaWikiOAuth2(__userAgent__);
    mw.set(oauth.accessToken, oauth.refreshToken, new Date(oauth.expires));
    try {
        const { accessToken, refreshToken, expires } = await mw.refresh();
        oauth.accessToken = accessToken;
        oauth.refreshToken = refreshToken;
        oauth.expires = expires.toISOString();
        oauth.lastUsed = new Date().toISOString();
        oauth.valid = true;
        if (glob.rememberAccounts)
            store.set("accounts", Security.encryptAccounts(glob.accounts));
    } catch (err) {
        oauth.valid = false;
        if (glob.rememberAccounts)
            store.set("accounts", Security.encryptAccounts(glob.accounts));
        return null;
    }

    if (glob.mwapi && MediaWikiAPI.controller)
        MediaWikiAPI.controller.abort();

    if (!api)
        return null;

    glob.mwapi = new MediaWikiAPI(glob, mw, glob.server, active);
    return glob.mwapi;
}

// app setup
app.whenReady().then(async () => {
    glob.accounts = Security.decryptAccounts(store.get("accounts", { }));
    glob.account = glob.accounts[store.get("account", null)] ?? null;

    const hasUpdateFile = fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
    if (!__dev__ && app.isPackaged && hasUpdateFile) {
        const update = autoUpdater.checkForUpdates().catch(err => Logger.error(`Auto-updater initial check failed: ${err == null ? "unknown" : (err.stack || err).toString()}`));

        setTimeout(update, 3000); // after 3 seconds
        setInterval(update, 10 * 60 * 1000); // every 10 minutes
    }

    ipcMain.on("open-external", (event, url) => Security.openExternal(url));

    ipcMain.handle("get-language", async () => __servers__.find(server => server.host === glob.server) ?? __servers__[0]);

    ipcMain.handle("get-account", async () => glob.account);
    ipcMain.handle("get-accounts", async () => [
        glob.rememberAccounts,
        Object.entries(glob.accounts).map(([ username, account ]) => ({
            username, valid: account.valid, lastUsed: account.lastUsed
        }))
    ]);
    ipcMain.on("set-remember-accounts", (event, remember) => {
        glob.rememberAccounts = remember;
        store.set("rememberAccounts", remember);
        if (remember) {
            store.set("accounts", Security.encryptAccounts(glob.accounts));
            if (glob.account)
                store.set("account", glob.account.username);
        } else {
            store.delete("account");
            store.delete("accounts");
        }
    });

    ipcMain.on("signin", (event, username) => {
        glob.account = glob.accounts[username];
        glob.account.lastUsed = new Date().toISOString();
        if (glob.rememberAccounts) {
            store.set("account", username);
            store.set("accounts", Security.encryptAccounts(glob.accounts));
        }

        glob.windows.signin.close();
        glob.windows.signin = null;

        BuildWindow.main();
    });
    ipcMain.on("delete-account", (event, username) => {
        delete glob.accounts[username];
        if (glob.rememberAccounts)
            store.set("accounts", Security.encryptAccounts(glob.accounts));
    });

    ipcMain.handle("authorize", async () => {
        BuildWindow.authorize();

        glob.windows.authorize.once("closed", () => {
            glob.windows.authorize = null;

            if (glob.windows.signin && !glob.windows.signin.isDestroyed())
                glob.windows.signin.webContents.send("signin-focus-window");
            else if (glob.account === null)
                BuildWindow.signin();
        });
    });
    ipcMain.handle("handle-authorization", async () => {
        try {
            const oauth = new MediaWikiOAuth2(__userAgent__);

            const controller = new AbortController();
            glob.windows.authorize.once("closed", () => controller.abort());

            const data = await oauth.authorize(glob, controller.signal);

            const username = await MediaWikiAPI.getUsername(oauth, glob.server);
            glob.accounts[username] = {
                username,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expires: data.expires.toISOString(),
                valid: true,
                lastUsed: new Date().toISOString()
            };

            glob.account = glob.accounts[username];
            if (glob.rememberAccounts) {
                store.set("account", username);
                store.set("accounts", Security.encryptAccounts(glob.accounts));
            }

            glob.windows.signin.close();
            glob.windows.signin = null;

            BuildWindow.main();
        } catch (err) {
            glob.windows.authorize.close();
            glob.windows.authorize = null;

            if (glob.windows.signin && !glob.windows.signin.isDestroyed())
                glob.windows.signin.webContents.send("authorization-failed", err?.message ?? "An unknown error occurred during authorization.");
            else
                BuildWindow.signin();

            return;
        }
    });

    ipcMain.on('copy-to-clipboard', (event, text) => clipboard.writeText(text));
    ipcMain.handle('get-clipboard-text', async () => clipboard.readText());

    ipcMain.on("log", (event, message, level) => Logger[level ?? "info"]?.(message));
    ipcMain.on("error", (event, message, detail) => dialog.showErrorBox(message, detail?.toString() ?? "No additional details provided."));
    ipcMain.handle("send-notification", async (event, options, url) => void(NotificationHandler.send(options, url)));
    ipcMain.handle("local-storage", async (event, action, key, value) => {
        switch (action) {
            case "get": return store.get(key);
            case "set": return store.set(key, value);
            case "delete": return store.delete(key);
            default: throw new Error("Invalid local storage action");
        }
    });

    ipcMain.on("menu-enabler", (event, options) => { UpdateMenu(options); });
    ipcMain.on("set-badge-count", async(event, count) => {
        switch (process.platform) {
            case "win32": {
                if (!glob.windows.main)
                    return;

                try {
                    const icon = await CreateBadgeIcon(glob.windows.main, count);
                    if (!glob.windows.main)
                        return;

                    if (!icon?.isEmpty())
                        glob.windows.main.setOverlayIcon(icon, `You have ${count} unread notifications`);
                    else
                        glob.windows.main.setOverlayIcon(null, "");
                } catch (err) {
                    Logger.error(`Failed to set badge count on Windows: ${err.stack || err}`);
                    glob.windows.main.setOverlayIcon(null, "");
                }
            } break;
            case "darwin": {
                let text = "";
                if (count > 0) text = count > 99 ? "99+" : count.toString();
                app.dock.setBadge(text);
            } break;
            default: {
                let text = "";
                if (count > 0) text = count > 99 ? "99+" : count.toString();
                app.setBadgeCount(text);
            } break;
        }
    });

    ipcMain.handle("mwapi-loader", async event => {
        const username = glob.account?.username ?? null;
        if (username === null) {
            if (glob.windows.main)
                glob.windows.main.close();

            BuildWindow.signin();
            return;
        }

        try {
            if (await CreateAPI(username)) {
                if (glob.windows.main)
                    glob.windows.main.webContents.send("mwapi-loaded", glob.server, username, MediaWikiAPI.pendingChangesServers);
            } else {
                if (glob.windows.main)
                    glob.windows.main.close();

                BuildWindow.signin();
                return;
            }

        } catch (err) {
            Logger.error(`Failed to create MediaWikiAPI for ${username ?? glob.account?.username ?? "unknown"}: ${err.stack || err}`);
            throw err;
        }
    });
    ipcMain.handle("mwapi", async (event, method, ...args) => {
        try {
            return await glob.mwapi[method](...args);
        } catch (err) {
            Logger.error(`MediaWikiAPI method ${method} failed: ${err.stack || err}`);
            throw err;
        }
    });

    { // save account
        const promises = [ ];
        ipcMain.on("save-account", async (event, username, data) => {
            const promise = (async () => {
                try {
                    const result = await glob.mwapi.postWithToken({ action: "options", optionname: "userjs-wikishield-storage", optionvalue: data });
                    if (result?.options === "success")
                        Logger.debug(`Successfully saved account data for ${username}`);
                    else
                        Logger.error(`Failed to save account data for ${username}: unexpected API response`);
                } catch (err) { Logger.error(`Failed to save account data for ${username}: ${err.stack || err}`); }
            })();
            promises.push(promise);
            promise.finally(() => {
                const index = promises.indexOf(promise);
                if (index !== -1)
                    promises.splice(index, 1);
            });
        });
        app.on("before-quit", async event => {
            if (promises.length > 0) {
                event.preventDefault();
                await Promise.allSettled(promises);
            }

            app.exit(0);
        });
    }

    { // disabler
        let disabled = false;
        ipcMain.on("disable-app", (event, title, message) => {
            if (disabled)
                return;
            disabled = true;

            dialog.showErrorBox(title, message);

            glob.quitting = true;
            app.quit();
        })
    }

    ipcMain.on("close-popup", async (event, id) => {
        const popup = Popup.windows.get(id);
        if (popup && !popup.isDestroyed())
            popup.close();
    });
    ipcMain.handle("open-in-browser", async (event, url) => {
        if (Popup.windows.size > 0) {
            const first = Popup.windows.values().next().value;
            if (first && !first.isDestroyed()) {
                first.webContents.send("open-link-in-new-tab", url);
                first.focus();
                return;
            }
        }

        return Popup.create(url);
    });

    ipcMain.on("close-signin-window", () => {
        if (glob.windows.signin) {
            glob.windows.signin.close();
            glob.windows.signin = null;
        }
    });
    ipcMain.on("close-authorization-window", () => {
        if (glob.windows.authorize) {
            glob.windows.authorize.close();
            glob.windows.authorize = null;
        }
    });
    ipcMain.on("close-translation-window", () => {
        if (glob.windows.translation) {
            glob.windows.translation.close();
            glob.windows.translation = null;
        }
    });
    ipcMain.on("close-browser-window", () => {
        Popup.windows.forEach(popup => {
            if (popup && !popup.isDestroyed())
                popup.close();
        });
    });

    ipcMain.on("quit", () => {
        glob.quitting = true;
        app.quit();
    });

    globalShortcut.register("escape", () => {
        if (glob.windows.signin?.isFocused()) {
            glob.windows.signin.close();
            glob.windows.signin = null;
        } else if (glob.windows.authorize?.isFocused()) {
            glob.windows.authorize.close();
            glob.windows.authorize = null;
        } else if (glob.windows.translation?.isFocused()) {
            glob.windows.translation.close();
            glob.windows.translation = null;
        }
    });

    BuildTray();
    BuildWindow.main();
});

app.on("window-all-closed", () => {
    if (!glob.quitting)
        app.quit();
});