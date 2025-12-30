export class Notifications {
    constructor(ws) {
        this.ws = ws;

        this.alert = [ ];
		this.message = [ ];

        this.load("alert");
        this.load("message");
    }

    async load(type) {
        try {
            const response = (await this.ws.api.continuous({
                action: "query",
                meta: "notifications",
                notlimit: "max",
                notprop: "list",
                notfilter: "!read",
                notsections: type,
                notformat: "model"
            })).responses.flatMap(response => response.query?.notifications?.list || []);
            await Promise.all(response.map(async n => {
                return this.ws.api.parse(n["*"].body).then(parsed => { return void (n["*"].parsed = parsed) ?? n; });
            }));

            let update = false;
            for (const n of response) {
                if (!this[type].some(existing => existing.id === n.id && existing.read === n.read)) {
                    this[type].unshift(n);
                    update = true;
                }
            }

            if (update) {
                const zen = this.ws.store.settings.zen_mode;
                if (!zen.enabled || zen[`${type}s`].enabled)
                    this.ws.audio.playSound([ "notification", type ]);

                this.update(type);
            }
        } finally {
            window.setTimeout(() => this.load(type), 10 * 1000);
        }
    }

    update(type) {
        this.count();

        const notifications = this[type];
        const unread = notifications.filter(n => !n.read);
        unread.forEach(n => window.electronAPI.notify({
            title: this.ws.util.textify(n["*"].header),
            body: this.ws.util.textify(n["*"].body),
        }, n["*"].links.primary.url));

        const $count = document.querySelector(`#${type}s-count`);
        const $list = document.querySelector(`#${type}s-list`);

        $count.textContent = unread.length;
        $count.classList.toggle("hidden", unread.length === 0);

        if (notifications.length === 0)
            $list.innerHTML = `<div class="notifications-empty">No new ${type}s</div>`;
        else {
            $list.innerHTML = "";
            notifications.forEach(notification => {
                const model = notification["*"];

                { // create element
                    const $notification = document.createElement("div");
                    $notification.classList.add("notification");
                    $notification.classList.add(notification.read ? "read" : "unread");
                    $notification.addEventListener("click", () => {
                        this.read(type, notification);
                        this.ws.open(model.links.primary.url);
                    });

                    { // icon
                        const $icon = document.createElement("div");
                        $icon.classList.add("notification-icon");
                        $icon.innerHTML = `<img src="${new URL(model.iconUrl, `https://${this.ws.server}/`).toString()}" alt="icon">`;
                        $notification.appendChild($icon);
                    }

                    { // content
                        const $content = document.createElement("div");
                        $content.classList.add("notification-content");
                        $notification.appendChild($content);

                        { // header
                            const $header = document.createElement("div");
                            $header.classList.add("notification-header");
                            $header.innerHTML = this.ws.util.truncate(model.header, 100);
                            $content.appendChild($header);
                        }

                        { // body
                            const $body = document.createElement("div");
                            $body.classList.add("notification-body");
                            $body.innerHTML = model.body;
                            $content.appendChild($body);

                            $body.querySelectorAll("a").forEach(link => {
                                link.target = "_blank";
                            });
                        }

                        { // links
                            const $links = document.createElement("div");
                            $links.classList.add("notification-links");

                            model.links.secondary.forEach(link => {
                                const $link = document.createElement("a");
                                $link.href = link.url;
                                $link.target = "_blank";
                                $link.textContent = link.label;
                                $links.appendChild($link);
                            });

                            $content.appendChild($links);
                        }
                    }

                    { // right
                        const $right = document.createElement("div");
                        $right.classList.add("notification-right");
                        $notification.appendChild($right);

                        if (!notification.read) {
                            { // unread indicator
                                const $unread = document.createElement("div");
                                $unread.classList.add("notification-unread-indicator");

                                $unread.addEventListener("click", (e) => {
                                    e.stopPropagation();
                                    this.read(type, notification);
                                });

                                $right.appendChild($unread);
                            }
                        }

                        { // time
                            const $time = document.createElement("div");
                            $time.classList.add("notification-timestamp");
                            $time.dataset.time = notification.timestamp.utciso8601;
                            $time.dataset.timeFormat = "notification";
                            $time.textContent = this.ws.util.formatNotificationTime(new Date(notification.timestamp.utciso8601));
                            $right.appendChild($time);
                        }
                    }

                    $list.appendChild($notification);
                }
            });
        }
    }

    seen(type) {
        this.ws.api.postWithToken({
            action: "echomarkseen",
            type
        });
    }
    read(type, notification) {
        if (notification)
            this.ws.api.postWithToken({
                action: "echomarkread",
                sections: type,
                list: notification.id
            }).then(() => {
                notification.read = true;
                this.update(type);
            });
        else
            this.ws.api.postWithToken({
                action: "echomarkread",
                sections: type,
                all: true
            }).then(() => {
                this[type].forEach(n => n.read = true);
                this.update(type);
            });
    }

    count() {
        const zen = this.ws.store.settings.zen_mode;

        let unread = 0;
        if (!zen.enabled || zen.alerts.enabled)
            unread += this.alert.filter(n => !n.read).length;
        if (!zen.enabled || zen.messages.enabled)
            unread += this.message.filter(n => !n.read).length;

        window.electronAPI.setBadgeCount(unread);
        if (unread > 0)
            document.title = `(${unread}) WikiShield`;
        else
            document.title = `WikiShield`;
    }
}