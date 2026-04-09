const { contextBridge, ipcRenderer } = require("electron/renderer");

contextBridge.exposeInMainWorld("electron", {
    ready: () => ipcRenderer.send("signin-ready"),
    onFocusWindow: callback => ipcRenderer.on("signin-focus-window", callback),
    onBlurWindow: callback => ipcRenderer.on("signin-blur-window", callback),

    getOauthVersion: () => ipcRenderer.invoke("get-oauth-version"),
    getAccounts: () => ipcRenderer.invoke("get-accounts"),
    setRememberAccounts: remember => ipcRenderer.send("set-remember-accounts", remember),

    signin: username => ipcRenderer.send("signin", username),
    deleteAccount: username => ipcRenderer.send("delete-account", username),

    authorize: () => ipcRenderer.invoke("authorize"),
    onAuthorizationFailed: callback => ipcRenderer.on("authorization-failed", callback),

    close: () => ipcRenderer.send("close-signin-window"),
});