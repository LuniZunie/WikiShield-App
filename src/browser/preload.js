const { ipcRenderer } = require("electron");

document.addEventListener("auxclick", e => {
    if (e.button === 1) {
        const $link = e.target.closest("a[href]");
        if ($link?.href) {
            e.preventDefault();
            ipcRenderer.sendToHost("open-in-new-tab", $link.href);
        }
    }
}, true);

document.addEventListener("keydown", e => {
    let cancel = true;
    switch (true) {
        case (e.ctrlKey || e.metaKey) && e.key === "w": {
            ipcRenderer.sendToHost("close-tab");
        } break;
        case (e.ctrlKey || e.metaKey) && e.key === "t": {
            ipcRenderer.sendToHost("new-tab");
        } break;
        case (e.ctrlKey && e.key === "Tab" && !e.shiftKey) || (e.ctrlKey && e.key === "PageDown"): {
            ipcRenderer.sendToHost("next-tab");
        } break;
        case (e.ctrlKey && e.key === "Tab" && e.shiftKey) || (e.ctrlKey && e.key === "PageUp"): {
            ipcRenderer.sendToHost("prev-tab");
        } break;
        case ((e.ctrlKey || e.metaKey) && e.key === "r") || e.key === "F5": {
            ipcRenderer.sendToHost("refresh");
        } break;
        case ((e.ctrlKey || e.metaKey) && e.key === "l") || (e.altKey && e.key === "d"): {
            ipcRenderer.sendToHost("focus-url-bar");
        } break;
        default: {
            cancel = false;
        } break;
    }

    if (cancel)
        e.preventDefault();
}, true);
