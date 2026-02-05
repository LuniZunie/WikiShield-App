const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electronAPI", {
    ready: () => ipcRenderer.send("signin-ready"),
    onFocusWindow: callback => ipcRenderer.on("signin-focus-window", callback),
    onBlurWindow: callback => ipcRenderer.on("signin-blur-window", callback),

    getAccounts: () => ipcRenderer.invoke("get-accounts"),

    signin: username => ipcRenderer.send("signin", username),
    deleteAccount: username => ipcRenderer.send("delete-account", username),

    authorize: () => ipcRenderer.invoke("authorize"),
    onAuthorizationFailed: callback => ipcRenderer.on("authorization-failed", callback),

    close: () => ipcRenderer.send("close-signin-window"),
});