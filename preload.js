const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('electronAPI', {
    openExternal: (url) => ipcRenderer.send('open-external', url),

    setBadgeCount: (count) => ipcRenderer.send('set-badge-count', count),
    notify: (options, click) => ipcRenderer.invoke('send-notification', options, click),

    getServer: () => ipcRenderer.invoke('get-server'),
    loadAccounts: () => ipcRenderer.invoke('load-accounts'),

    saveAccount: (account) => ipcRenderer.send('save-account', account),
    setActiveAccount: (username) => ipcRenderer.send('set-active-account', username),
    getActiveAccount: () => ipcRenderer.invoke('get-active-account'),
    deleteAccount: (username) => ipcRenderer.send('delete-account', username),

    copyToClipboard: text => ipcRenderer.send('copy-to-clipboard', text),
    getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),

    log: (message) => ipcRenderer.send('log', message, 'debug'),
    info: (message) => ipcRenderer.send('log', message, 'info'),
    warn: (message) => ipcRenderer.send('log', message, 'warn'),
    error: (message) => ipcRenderer.send('log', message, 'error'),

    errorbox: (message, detail) => ipcRenderer.send('error', message, detail),

    saveAccount: (username, data) => ipcRenderer.send('save-account-data', username, data),
    quit: () => ipcRenderer.send('quit'),

    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback),

    onImportSettingsFromFile: (callback) => ipcRenderer.on('import-settings-from-file', callback),
    onImportSettingsFromClipboard: (callback) => ipcRenderer.on('import-settings-from-clipboard', callback),
    onImportSettingsFromInput: (callback) => ipcRenderer.on('import-settings-from-input', callback),

    onExportSettingsToFile: (callback) => ipcRenderer.on('export-settings-to-file', callback),
    onExportSettingsToClipboard: (callback) => ipcRenderer.on('export-settings-to-clipboard', callback),
})