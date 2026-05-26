import { MediaWikiAPI } from "./web-port/api.js";

if (window.electron === undefined) {
    window.isElectron = false;

    window.electron = {
        mwapiLoader: async () => {
            window.dispatchEvent(new CustomEvent("mwapi-loaded", {
                detail: {
                    server: window.location.host,
                    username: mw.user.getName(),
                    pendingChangesServers: MediaWikiAPI.pendingChangesServers,
                    dev: false,
                }
            }));
        },
        mwapiLoaded: callback => window.addEventListener("mwapi-loaded", event => {
            const { server, username, pendingChangesServers, dev } = event.detail;
            callback(server, username, pendingChangesServers, dev);
        }),
        mwapi: () => Promise.reject(new Error("Not running in Electron environment")),

        menuEnabler: () => { },

        setBadgeCount: () => { },
        sendNotification: () => { },
        localStorage: {
            get: key => localStorage.getItem(key),
            set: (key, value) => localStorage.setItem(key, value),
            delete: key => localStorage.removeItem(key),
        },

        copyToClipboard: async text => {
            if (navigator.clipboard && navigator.clipboard.writeText)
                await navigator.clipboard.writeText(text);
            else {
                const $textarea = document.createElement("textarea");
                $textarea.value = text;

                document.body.appendChild($textarea);
                $textarea.select();

                document.execCommand("copy");

                document.body.removeChild($textarea);
            }

            return;
        },

        log: message => console.debug(message),
        info: message => console.info(message),
        warn: message => console.warn(message),
        error: message => console.error(message),
        errorbox: (message, detail) => alert(`${message}\n\n${detail}`),

        onOpenBrowser: () => { },
        onOpenUrl: () => { },
        onOpenNotification: () => { },
        onOpenChangelog: () => { },

        closePopup: popup => popup.close(),
        openExternal: url => window.open(url, "_blank"),
        openInBrowser: async url => {
            const w = window.screen.availWidth * .8, h = window.screen.availHeight * .8;
            const x = window.screenX + (window.outerWidth - w) / 2, y = window.screenY + (window.outerHeight - h) / 2;

            const popup = window.open(url, "myPopup", `width=${w},height=${h},left=${x},top=${y},resizable=false,scrollbars=true,menubar=false,toolbar=false,location=false,status=false`);
            popup.focus();

            popup.addEventListener("beforeunload", () => {
                if (popup.closed)
                    window.dispatchEvent(new CustomEvent("popup-closed", { detail: popup }));
            });

            return popup;
        },
        onPopupClosed: callback => window.addEventListener("popup-closed", event => callback(event.detail)),

        onBeforeunload: () => { },
        unloaded: () => { },
        saveAccount: () => { },

        disable: (title, message) => {
            alert(`${title}\n\n${message}`);
            location.reload();
        }
    };
} else {
    window.isElectron = true;

    document.querySelectorAll("[data-electron]").forEach($el => {
        if ($el.dataset.electron === "false" && window.isElectron)
            $el.style.display = "none !important";
        else if ($el.dataset.electron === "true" && !window.isElectron)
            $el.style.display = "none !important";
    });
}