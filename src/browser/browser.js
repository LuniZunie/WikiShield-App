const params = new URLSearchParams(window.location.search);
const serverHost = params.get("host") || "en.wikipedia.org";
class Tab {
    #loaded = false;

    constructor(browser, id, url) {
        this.browser = browser;
        this.id = id;
        this.url = url;
        this.title = "New Tab";
        this.failedUrl = null;

        this.#createElements();
        this.#attachWebviewListeners();
    }

    get isBlank() {
        return this.url === "about:blank" || this.url.includes("/about-blank/index.html");
    }

    get isError() {
        return this.url.includes("/error/index.html");
    }

    get displayUrl() {
        if (this.isError && this.failedUrl) return this.failedUrl;
        if (this.isBlank) return "";
        return this.url;
    }

    get loaded() {
        return this.#loaded;
    }

    #createElements() {
        this.$tab = document.createElement("div");
        this.$tab.className = "tab";
        this.$tab.dataset.tabId = this.id;

        this.$favicon = document.createElement("img");
        this.$favicon.className = "tab-favicon";
        this.$favicon.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='7' fill='%23667eea'/></svg>";

        this.$loadingSpinner = document.createElement("div");
        this.$loadingSpinner.className = "tab-loading";
        this.$loadingSpinner.style.display = "none";

        this.$title = document.createElement("span");
        this.$title.className = "tab-title";
        this.$title.textContent = this.title;

        this.$close = document.createElement("button");
        this.$close.className = "tab-close";
        this.$close.innerHTML = "<i class='fas fa-xmark'></i>";
        this.$close.addEventListener("click", (e) => {
            e.stopPropagation();
            this.browser.closeTab(this.id);
        });

        this.$tab.appendChild(this.$favicon);
        this.$tab.appendChild(this.$loadingSpinner);
        this.$tab.appendChild(this.$title);
        this.$tab.appendChild(this.$close);

        this.$tab.addEventListener("click", () => this.browser.switchTab(this.id));
        this.$tab.addEventListener("auxclick", (e) => {
            if (e.button === 1) {
                e.preventDefault();
                this.browser.closeTab(this.id);
            }
        });

        this.$webview = document.createElement("webview");
        this.$webview.dataset.tabId = this.id;
        this.$webview.setAttribute("allowpopups", "true");
        this.$webview.setAttribute("preload", "./preload.js");
        this.$webview.setAttribute("webpreferences", "backgroundThrottling=false, autoplayPolicy=no-user-gesture-required");
        this.$webview.setAttribute("partition", "persist:browser");

        if (this.url === "about:blank")
            this.$webview.src = `./about-blank/index.html?host=${serverHost}`;
        else {
            this.$webview.src = this.url;
            this.browser.history.add(this.url);
        }
    }

    #attachWebviewListeners() {
        this.$webview.addEventListener("page-favicon-updated", (e) => {
            if (e.favicons && e.favicons.length > 0)
                this.$favicon.src = e.favicons[0];
        });

        this.$webview.addEventListener("page-title-updated", (e) => {
            this.title = e.title;
            this.$title.textContent = e.title;
            if (this.browser.activeTabId === this.id)
                document.title = e.title;
        });

        this.$webview.addEventListener("did-navigate", (e) => this.#handleNavigation(e));
        this.$webview.addEventListener("did-navigate-in-page", (e) => this.#handleNavigation(e));

        this.$webview.addEventListener("did-start-loading", () => this.#onStartLoading());
        this.$webview.addEventListener("did-stop-loading", () => this.#onStopLoading());
        this.$webview.addEventListener("dom-ready", () => {
            this.#loaded = true;
            if (this.browser.activeTabId === this.id) {
                this.browser.navigation.updateButtons();
                this.browser.hideLoadingOverlay();
            }
        });

        this.$webview.addEventListener("did-fail-load", (e) => this.#handleLoadError(e));

        this.$webview.addEventListener("ipc-message", (event) => this.#handleIPCMessage(event));

        this.$webview.addEventListener("context-menu", (e) => e.preventDefault());
    }

    #handleNavigation(e) {
        this.url = e.url;
        if (this.browser.activeTabId === this.id) {
            this.browser.navigation.updateUrlBar(this);
            this.browser.navigation.updateButtons();
            if (!this.isBlank && !this.isError)
                this.browser.history.add(e.url);
        }
    }

    #onStartLoading() {
        this.$loadingSpinner.style.display = "block";
        this.$favicon.style.display = "none";

        if (this.failedUrl && !this.isError)
            this.failedUrl = null;
    }

    #onStopLoading() {
        this.$loadingSpinner.style.display = "none";
        this.$favicon.style.display = "block";

        if (this.browser.activeTabId === this.id)
            this.browser.elements.$refreshBtn.classList.remove("loading");
    }

    #handleLoadError(e) {
        // Ignore certain errors
        if (e.errorCode === -3 || e.isMainFrame === false || e.validatedURL.includes("/about-blank/index.html"))
            return;

        this.failedUrl = e.validatedURL;

        const errorCode = Browser.getErrorCodeString(e.errorCode);
        const errorUrl = encodeURIComponent(e.validatedURL);
        const errorDesc = encodeURIComponent(e.errorDescription);

        this.$webview.src = `./error/index.html?code=${errorCode}&url=${errorUrl}&desc=${errorDesc}`;
    }

    #handleIPCMessage(event) {
        if (event.channel === "open-in-new-tab")
            return void this.browser.createTab(event.args[0]);

        if (this.browser.activeTabId !== this.id)
            return;

        const actions = {
            "close-tab": () => this.browser.closeTab(this.id),
            "new-tab": () => this.browser.createTab("about:blank"),
            "next-tab": () => this.browser.switchToNextTab(),
            "prev-tab": () => this.browser.switchToPrevTab(),
            "refresh": () => this.reload(),
            "focus-url-bar": () => this.browser.navigation.focusUrlBar(),
        };

        actions[event.channel]?.();
    }

    reload() {
        this.browser.elements.$refreshBtn.classList.add("loading");
        this.#loaded = false;
        this.$webview.reload();
    }

    goBack() {
        if (this.$webview.canGoBack())
            this.$webview.goBack();
    }

    goForward() {
        if (this.$webview.canGoForward())
            this.$webview.goForward();
    }

    canGoBack() {
        try {
            return this.$webview.canGoBack();
        } catch {
            return false;
        }
    }

    canGoForward() {
        try {
            return this.$webview.canGoForward();
        } catch {
            return false;
        }
    }

    navigateTo(url) {
        this.#loaded = false;
        this.$webview.src = url;
    }

    destroy() {
        this.$tab.remove();
        this.$webview.remove();
    }
}

/**
 * HistoryManager class - Manages browsing history and URL suggestions
 */
class HistoryManager {
    constructor(maxSize = 100) {
        this.items = [];
        this.maxSize = maxSize;
    }

    add(url) {
        if (!url.startsWith("http") || url.includes("/about-blank/index.html"))
            return;

        // Remove duplicates
        this.items = this.items.filter(item => item.url !== url);

        // Add to beginning
        this.items.unshift({
            url: url,
            title: this.#getHostname(url),
            timestamp: Date.now()
        });

        // Limit size
        if (this.items.length > this.maxSize)
            this.items = this.items.slice(0, this.maxSize);
    }

    search(query) {
        if (!query) return [];

        const lowerQuery = query.toLowerCase();
        const matches = this.items.filter(item =>
            item.url.toLowerCase().includes(lowerQuery) ||
            item.title.toLowerCase().includes(lowerQuery)
        );

        // Remove duplicates
        const seen = new Set();
        return matches.filter(item => {
            if (seen.has(item.url))
                return false;
            seen.add(item.url);
            return true;
        }).slice(0, 4);
    }

    #getHostname(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
}

/**
 * SuggestionsProvider class - Provides search suggestions from Google
 */
class SuggestionsProvider {
    constructor() {
        this.cache = new Map();
        this.apiUrl = "https://suggestqueries.google.com/complete/search";
    }

    async get(query) {
        if (this.cache.has(query))
            return this.cache.get(query);

        try {
            const suggestions = await this.#fetchFromGoogle(query);
            this.cache.set(query, suggestions);
            return suggestions;
        } catch (error) {
            console.error("Failed to fetch search suggestions:", error);
            return [];
        }
    }

    async #fetchFromGoogle(query) {
        const script = document.createElement("script");
        const callbackName = `googleSuggestCallback_${Date.now()}`;

        const promise = new Promise((resolve) => {
            window[callbackName] = (data) => {
                delete window[callbackName];
                script.remove();
                resolve(data);
            };

            script.src = `${this.apiUrl}?client=firefox&q=${encodeURIComponent(query)}&callback=${callbackName}`;
            document.head.appendChild(script);

            setTimeout(() => {
                if (window[callbackName]) {
                    delete window[callbackName];
                    script.remove();
                    resolve([query, []]);
                }
            }, 3000);
        });

        const data = await promise;
        return (data[1] || []).slice(0, 4).map(term => ({
            url: `https://www.google.com/search?q=${encodeURIComponent(term)}`,
            title: term,
            isSearch: true,
            timestamp: Date.now()
        }));
    }
}

/**
 * NavigationManager class - Handles navigation controls and URL bar
 */
class NavigationManager {
    constructor(browser) {
        this.browser = browser;
        this.#attachListeners();
    }

    #attachListeners() {
        const { $backBtn, $forwardBtn, $refreshBtn, $homeBtn, $urlBar, $externalLinkBtn, $closeBrowserBtn } = this.browser.elements;

        $closeBrowserBtn.addEventListener("click", () => electron.close());
        $backBtn.addEventListener("click", () => this.goBack());
        $forwardBtn.addEventListener("click", () => this.goForward());
        $refreshBtn.addEventListener("click", () => this.refresh());
        $homeBtn.addEventListener("click", () => this.goHome());
        $externalLinkBtn.addEventListener("click", () => {
            const activeTab = this.browser.getActiveTab();
            if (activeTab) {
                this.browser.closeTab(activeTab.id);
                electron.openExternal(activeTab.url);
            }
        });

        $urlBar.addEventListener("keypress", (e) => {
            if (e.key === "Enter")
                this.navigateToUrl($urlBar.value);
        });

        $urlBar.addEventListener("click", () => $urlBar.select());
    }

    goBack() {
        const activeTab = this.browser.getActiveTab();
        if (activeTab)
            activeTab.goBack();
    }

    goForward() {
        const activeTab = this.browser.getActiveTab();
        if (activeTab)
            activeTab.goForward();
    }

    refresh() {
        const activeTab = this.browser.getActiveTab();
        if (activeTab)
            activeTab.reload();
    }

    goHome() {
        const activeTab = this.browser.getActiveTab();
        if (activeTab)
            activeTab.navigateTo(`./about-blank/index.html?host=${serverHost}`);
    }

    updateButtons() {
        const activeTab = this.browser.getActiveTab();
        const { $backBtn, $forwardBtn } = this.browser.elements;

        if (!activeTab) {
            $backBtn.disabled = true;
            $forwardBtn.disabled = true;
            return;
        }

        $backBtn.disabled = !activeTab.canGoBack();
        $forwardBtn.disabled = !activeTab.canGoForward();
    }

    updateUrlBar(tab) {
        this.browser.elements.$urlBar.value = tab.displayUrl;
    }

    navigateToUrl(input) {
        const activeTab = this.browser.getActiveTab();
        if (!activeTab) return;

        const trimmedInput = input.trim();
        if (!trimmedInput) return;

        // Handle about:blank
        if (trimmedInput.toLowerCase() === "about:blank") {
            this.browser.elements.$urlBar.value = "";
            activeTab.navigateTo("./about-blank/index.html");
            return;
        }

        // Check if input is a URL
        if (this.isUrl(trimmedInput)) {
            let url = trimmedInput;
            if (!url.match(/^https?:\/\//i))
                url = `http://${url}`;
            activeTab.navigateTo(url);
            this.browser.history.add(url);
        } else {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmedInput)}`;
            activeTab.navigateTo(searchUrl);
            this.browser.history.add(searchUrl);
        }

        this.browser.autocomplete.hide();
    }

    focusUrlBar() {
        const { $urlBar } = this.browser.elements;
        $urlBar.focus();
        $urlBar.select();
    }

    isUrl(string) {
        const urlPattern = /^(https?:\/\/)?(([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}(\:[0-9]+)?(\/[-a-z\d%_.~+]*)*$/i;
        const localhostPattern = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i;
        return urlPattern.test(string) || localhostPattern.test(string) || string.includes(".");
    }
}

/**
 * AutocompleteManager class - Manages URL bar autocomplete dropdown
 */
class AutocompleteManager {
    #debounceTimer = null;

    constructor(browser) {
        this.browser = browser;
        this.#attachListeners();
    }

    #attachListeners() {
        const { $urlBar } = this.browser.elements;

        $urlBar.addEventListener("input", (e) => {
            const query = e.target.value.trim();
            clearTimeout(this.#debounceTimer);

            if (!query)
                return void this.hide();

            this.#debounceTimer = setTimeout(() => this.show(query), 150);
        });

        $urlBar.addEventListener("focus", () => {
            const query = $urlBar.value.trim();
            if (query)
                this.show(query);
        });

        $urlBar.addEventListener("blur", () => {
            setTimeout(() => this.hide(), 200);
        });
    }

    async show(query) {
        const suggestions = await this.#getSuggestions(query);

        if (suggestions.length === 0)
            return void(this.hide());

        const { $autocompleteDropdown, $urlBar } = this.browser.elements;
        $autocompleteDropdown.innerHTML = "";

        suggestions.forEach((item) => {
            const $suggestion = this.#createSuggestionElement(item);
            $autocompleteDropdown.appendChild($suggestion);
        });

        $autocompleteDropdown.style.display = "block";
    }

    hide() {
        this.browser.elements.$autocompleteDropdown.style.display = "none";
    }

    #createSuggestionElement(item) {
        const $suggestion = document.createElement("div");
        $suggestion.className = "autocomplete-item";
        $suggestion.dataset.url = item.url;

        const $icon = document.createElement("i");
        $icon.className = item.isSearch ? "fas fa-magnifying-glass" : "fas fa-globe";

        const $text = document.createElement("div");
        $text.className = "autocomplete-text";

        const $title = document.createElement("div");
        $title.className = "autocomplete-title";
        $title.textContent = item.title;

        const $url = document.createElement("div");
        $url.className = "autocomplete-url";
        $url.textContent = item.isSearch ? "Search Google" : item.url;

        $text.appendChild($title);
        $text.appendChild($url);
        $suggestion.appendChild($icon);
        $suggestion.appendChild($text);

        $suggestion.addEventListener("click", () => {
            const { $urlBar } = this.browser.elements;
            $urlBar.value = item.isSearch ? item.title : item.url;
            this.browser.navigation.navigateToUrl($urlBar.value);
            this.hide();
        });

        return $suggestion;
    }

    async #getSuggestions(query) {
        const historyMatches = this.browser.history.search(query);

        let searchSuggestions = [];
        if (!this.browser.navigation.isUrl(query))
            searchSuggestions = await this.browser.suggestionsProvider.get(query);

        return [...historyMatches, ...searchSuggestions].slice(0, 8);
    }
}

class Browser {
    constructor() {
        this.tabs = new Map();
        this.activeTabId = null;
        this.tabIdCounter = 0;

        this.history = new HistoryManager();
        this.suggestionsProvider = new SuggestionsProvider();

        this.elements = {
            $tabsContainer: document.getElementById("tabs-container"),
            $webviewsContainer: document.getElementById("webviews-container"),
            $closeBrowserBtn: document.getElementById("close-browser"),
            $backBtn: document.getElementById("nav-backward"),
            $forwardBtn: document.getElementById("nav-forward"),
            $refreshBtn: document.getElementById("nav-refresh"),
            $homeBtn: document.getElementById("nav-home"),
            $externalLinkBtn: document.getElementById("nav-external"),
            $urlBar: document.getElementById("url-bar"),
            $autocompleteDropdown: document.getElementById("autocomplete-dropdown"),
            $newTabBtn: document.getElementById("new-tab"),
        };

        this.$loadingOverlay = document.createElement("div");
        this.$loadingOverlay.id = "webview-loading-overlay";
        this.elements.$webviewsContainer.appendChild(this.$loadingOverlay);

        this.navigation = new NavigationManager(this);
        this.autocomplete = new AutocompleteManager(this);

        this.#attachListeners();
        this.#initialize();
    }

    showLoadingOverlay() {
        this.$loadingOverlay.classList.remove("hidden");
    }

    hideLoadingOverlay() {
        this.$loadingOverlay.classList.add("hidden");
    }

    #attachListeners() {
        this.elements.$newTabBtn.addEventListener("click", () => this.createTab("about:blank"));

        electron.onOpenLinkInNewTab((url) => this.createTab(url));
    }

    #initialize() {
        const urlParams = new URLSearchParams(window.location.search);
        const initialUrl = urlParams.get("url") || "";
        this.createTab(initialUrl.trim() || "about:blank");
    }

    createTab(url) {
        const tabId = ++this.tabIdCounter;
        const tab = new Tab(this, tabId, url);

        this.elements.$tabsContainer.insertBefore(tab.$tab, this.elements.$newTabBtn);
        this.elements.$webviewsContainer.appendChild(tab.$webview);

        this.tabs.set(tabId, tab);
        this.switchTab(tabId);

        return tabId;
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;

        const currentIndex = Array.from(this.tabs.keys()).indexOf(tabId);

        tab.destroy();
        this.tabs.delete(tabId);

        if (this.tabs.size === 0)
            return void(electron.close());

        if (tabId === this.activeTabId) {
            const tabIds = Array.from(this.tabs.keys());
            const newTabId = tabIds[Math.min(currentIndex, tabIds.length - 1)] || tabIds[0];
            this.switchTab(newTabId);
        }
    }

    switchTab(tabId) {
        const newTab = this.tabs.get(tabId);
        if (!newTab)
            return;

        this.activeTabId = tabId;

        this.tabs.forEach((tab, id) => {
            const isActive = id === tabId;
            tab.$tab.classList.toggle("active", isActive);
            tab.$webview.classList.toggle("active", isActive);
        });

        if (newTab.loaded)
            this.hideLoadingOverlay();
        else
            this.showLoadingOverlay();

        this.elements.$refreshBtn.classList.remove("loading");

        this.navigation.updateUrlBar(newTab);
        this.navigation.updateButtons();
        document.title = newTab.title;
    }

    switchToNextTab() {
        const tabIds = Array.from(this.tabs.keys());
        const currentIndex = tabIds.indexOf(this.activeTabId);
        if (currentIndex !== -1) {
            const nextIndex = (currentIndex + 1) % tabIds.length;
            this.switchTab(tabIds[nextIndex]);
        }
    }

    switchToPrevTab() {
        const tabIds = Array.from(this.tabs.keys());
        const currentIndex = tabIds.indexOf(this.activeTabId);
        if (currentIndex !== -1) {
            const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
            this.switchTab(tabIds[prevIndex]);
        }
    }

    getActiveTab() {
        return this.tabs.get(this.activeTabId);
    }

    static getErrorCodeString(errorCode) {
        const errorMap = {
            "-105": "ERR_NAME_NOT_RESOLVED",
            "-102": "ERR_CONNECTION_REFUSED",
            "-118": "ERR_CONNECTION_TIMED_OUT",
            "-106": "ERR_INTERNET_DISCONNECTED",
            "-202": "ERR_CERT_AUTHORITY_INVALID",
            "-201": "ERR_CERT_DATE_INVALID",
            "-107": "ERR_SSL_PROTOCOL_ERROR",
            "-3": "ERR_ABORTED",
            "-2": "ERR_FAILED"
        };

        return errorMap[errorCode.toString()] || "ERR_FAILED";
    }
}

const browser = new Browser();
