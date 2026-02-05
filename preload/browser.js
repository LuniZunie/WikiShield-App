const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
    openExternal: url => ipcRenderer.send("open-external", url),
    onOpenLinkInNewTab: callback => ipcRenderer.on("open-link-in-new-tab", (event, url) => callback(url)),

    close: () => ipcRenderer.send("close-browser-window"),
});