const { EventSource } = require('eventsource');

class EventStream {
    static url = "https://stream.wikimedia.org/v2/stream/recentchange";

    constructor(...servers) {
        this.servers = servers;
        this.connected = false;

        this.callbacks = new Set();
    }

    connect() {
        if (this.connected)
            return;
        this.source = new EventSource(EventStream.url);
        this.source.onerror = error => {
            this.disconnect();
        };

        this.source.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.meta.domain === "canary")
                return;
            if (this.servers.length > 0 && !this.servers.includes(data.server_name))
                return;
            for (const callback of this.callbacks)
                callback(data);
        };

        this.connected = true;
    }
    disconnect() {
        if (!this.connected)
            return;
        this.source.close();
        this.connected = false;
    }

    listen(callback) {
        this.callbacks.add(callback);
    }
    unlisten(callback) {
        this.callbacks.delete(callback);
    }
}

module.exports = { EventStream };