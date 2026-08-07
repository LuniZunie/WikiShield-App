const { contextBridge, ipcRenderer } = require("electron/renderer");

let _getTabUrlsCallback = null;

contextBridge.exposeInMainWorld("electron", {
    openExternal: url => ipcRenderer.send("open-external", url),
    onOpenLinkInNewTab: callback => ipcRenderer.on("open-link-in-new-tab", (event, url) => callback(url)),

    close: () => ipcRenderer.send("close-browser-window"),

    onGetTabUrls: callback => { _getTabUrlsCallback = callback; },
});

ipcRenderer.on("get-tab-urls", () => {
    const urls = _getTabUrlsCallback ? _getTabUrlsCallback() : [ ];
    ipcRenderer.send("tab-urls-reply", urls);
});