const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
    handleAuthorization: () => ipcRenderer.invoke("handle-authorization"),

    close: () => ipcRenderer.send("close-authorization-window"),
});