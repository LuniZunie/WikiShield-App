const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electron", {
    close: () => ipcRenderer.send("close-translation-window"),

    onSetTranslation: callback => ipcRenderer.on("set-translation", (event, obj) => callback(event, obj)),
});