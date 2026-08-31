class Throttle {
    #start;
    #count = 0;

    constructor(delay) {
        this.#start = Date.now();

        this.delay = delay;
        this.last = 0;
    }

    get count() {
        return this.#count;
    }

    per(divisor = 1) {
        return Math.floor(this.#count / ((Date.now() - this.#start) / divisor)) || 0;
    }

    call(fn, bypass = false) {
        this.#count++;

        const now = Date.now();
        const wait = Math.max(0, this.last + this.delay - now);
        this.last = now + wait;

        if (bypass || wait === 0)
            return fn();
        else
            return new Promise(resolve => setTimeout(async () => resolve(await fn()), wait));
    }
}

export class MediaWikiOAuth2 {
    constructor(userAgent) {
        this.userAgent = userAgent;

        this.throttle = new Throttle(0);
        this.api = new mw.Api();
    }

    getOrigin(url) {
        const origin = `${location.protocol}//${location.host}`;

        try {
            const apiUrl = new URL(url);
            const apiOrigin = `${apiUrl.protocol}//${apiUrl.host}`;
            if (apiOrigin === origin)
                return undefined;
        } catch { }

        return origin;
    }

    async get(url, params = { }, signal = null, method = "POST", bypass) {
        const origin = this.getOrigin(url);
        if (origin)
            url += (url.includes("?") ? "&" : "?") + `origin=${encodeURIComponent(origin)}`;

        return [
            url,
            {
                method,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: method === "GET" ? undefined : new URLSearchParams(params).toString(),
                ...(bypass ? { priority: "high" } : { }),
                signal,
                ...(origin ? { credentials: "include" } : { })
            }
        ]
    }

    async fetch(url, params = { }, signal = null, method = "POST", bypass) {
        return await this.throttle.call(async () => {
            const origin = this.getOrigin(url);
            if (origin)
                url += (url.includes("?") ? "&" : "?") + `origin=${encodeURIComponent(origin)}`;

            return await this.api.ajax({ ...params, origin }, { url, method, ...(origin ? { xhrFields: { withCredentials: true } } : { }) })
                .catch(error => {
                    console.error(`[WikiShield] Failed to parse "OAuth2" response (rpm: ${this.throttle.per(6e4)}):`, error);
                    throw error;
                });
        }, bypass);
    }
}