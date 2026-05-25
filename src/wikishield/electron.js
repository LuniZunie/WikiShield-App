if (window.electron === undefined) {
    window.isElectron = false;

    window.electron = {
        localStorage: {
            get: key => localStorage.getItem(key),
            set: (key, value) => localStorage.setItem(key, value),
            delete: key => localStorage.removeItem(key),
        },

        menuEnabler: () => {},
        mwapiLoader: () => Promise.resolve(),
        mwapiLoaded: () => {},
        mwapi: () => Promise.reject(new Error("Not running in Electron environment")),
        eventstream: () => {},
    };
} else
    window.isElectron = true;

document.querySelectorAll("[data-electron]").forEach($el => {
    if ($el.dataset.electron === "false" && window.isElectron)
        $el.remove();
    else if ($el.dataset.electron === "true" && !window.isElectron)
        $el.remove();
});