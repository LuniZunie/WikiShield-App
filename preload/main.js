const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
    areExternalServicesAllowed: () => ipcRenderer.sendSync("are-external-services-allowed"),

    getAccount: () => ipcRenderer.invoke("get-account"),

    mwapiLoader: () => ipcRenderer.invoke("mwapi-loader"),
    mwapiLoaded: callback => ipcRenderer.on("mwapi-loaded", (event, server, username, pendingChangesServers) => callback(server, username, pendingChangesServers)),
    mwapi: (action, ...args) => ipcRenderer.invoke("mwapi", action, ...args),

    menuEnabler: opts => ipcRenderer.send("menu-enabler", opts),

    setBadgeCount: count => ipcRenderer.send("set-badge-count", count),
    sendNotification: (options, url) => ipcRenderer.invoke("send-notification", options, url),

    copyToClipboard: text => ipcRenderer.send("copy-to-clipboard", text),
    getClipboardText: () => ipcRenderer.invoke("get-clipboard-text"),

    log: message => ipcRenderer.send("log", message, "debug"),
    info: message => ipcRenderer.send("log", message, "info"),
    warn: message => ipcRenderer.send("log", message, "warn"),
    error: message => ipcRenderer.send("log", message, "error"),
    errorbox: (message, detail) => ipcRenderer.send("error", message, detail),

    onOpenBrowser: callback => ipcRenderer.on("open-browser", () => callback()),
    onOpenUrl: callback => ipcRenderer.on("open-url", (event, url) => callback(url)),
    onOpenNotification: callback => ipcRenderer.on("open-notification", (event, link) => callback(link)),
    onOpenSettings: callback => ipcRenderer.on("open-settings", () => callback()),
    onOpenChangelog: callback => ipcRenderer.on("open-changelog", () => callback()),

    onImportSettingsFromClipboard: callback => ipcRenderer.on("import-settings-from-clipboard", () => callback()),
    onImportSettingsFromInput: callback => ipcRenderer.on("import-settings-from-input", () => callback()),

    onExportSettingsToClipboard: callback => ipcRenderer.on("export-settings-to-clipboard", () => callback()),

    closePopup: id => ipcRenderer.send("close-popup", id),
    openExternal: url => ipcRenderer.send("open-external", url),
    openInBrowser: url => ipcRenderer.invoke("open-in-browser", url),
    onPopupClosed: callback => ipcRenderer.on("popup-closed", (event, popupId) => callback(popupId)),

    onBeforeunload: callback => ipcRenderer.on("beforeunload", () => callback()),
    unloaded: () => ipcRenderer.send("unloaded"),
    saveAccount: (username, data) => ipcRenderer.send("save-account", username, data),

    disable: (title, message) => ipcRenderer.send("disable-app", title, message),
    quit: () => ipcRenderer.send("quit"),
});