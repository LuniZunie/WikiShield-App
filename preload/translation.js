const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
    close: () => ipcRenderer.send("close-translation-window"),

    onSetTranslation: callback => ipcRenderer.on("set-translation", (event, obj) => callback(event, obj)),
});