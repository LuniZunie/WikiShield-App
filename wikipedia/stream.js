const { EventSource } = require('eventsource');

class EventStream {
    static url = "https://stream.wikimedia.org/v2/stream/recentchange";

    constructor(...servers) {
        this.servers = servers;
        this.connected = false;
    }

    connect() {
        if (this.connected)
            return;
        this.source = new EventSource(EventStream.url);
        this.source.onerror = error => {
            console.error("EventSource failed:", error);
            this.disconnect();
        };
    }
    disconnect() {
        if (!this.connected)
            return;
        this.source.close();
        this.connected = false;
    }

    message(callback) {
        this.source.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.meta.domain === "canary")
                return;
            if (this.servers.length > 0 && !this.servers.includes(data.server_name))
                return;
            callback(data);
        };
    }
}

const stream = new EventStream("en.wikipedia.org", "de.wikipedia.org");
stream.connect();

stream.message(data => {
    console.log(data);
});