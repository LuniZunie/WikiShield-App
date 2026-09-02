const killswitch = { ID: 0n };
const access = { ID: 0n };
const notifications = { ID: 0n };

self.onmessage = event => {
    const { type, body } = event.data;
    if (type !== "post")
        return;

    const { command, data } = body;
    switch (command) {
        case "killswitch": {
            const ID = ++killswitch.ID;

            let { retries } = data;
            const { interval, expected, fetchKillswitch } = data;

            const check = async () => {
                const start = performance.now();
                if (ID !== killswitch.ID)
                    return;

                try {
                    const response = await fetch(...fetchKillswitch)
                        .then(response => response.json())
                        .then(data => data.query?.pages || { })
                        .catch(error => {
                            if (retries++ < 3) {
                                self.postMessage({ body: { command: "killswitch-resync", data: { retries } } });
                                return null;
                            } else
                                throw error;
                        });

                    if (response === null || ID !== killswitch.ID)
                        return;
                    retries = 0;

                    const content = Object.values(response)?.[0]?.revisions?.[0]?.slots?.main?.content || "";
                    const data = JSON.parse(content)?.WikiShield;
                    if (!data)
                        throw new Error("No killswitch found");
                    else if (data.disabled)
                        self.postMessage({ body: { command: "killswitch", data: { event: "kill" } } });
                    else {
                        const soft = data.reload?.soft ?? 0;
                        const hard = data.reload?.hard ?? 0;

                        if (hard > expected.hard)
                            self.postMessage({ body: { command: "killswitch", data: { event: "force-update" } } });
                        else if (soft > expected.soft)
                            self.postMessage({ body: { command: "killswitch", data: { event: "update", soft } } });
                        else
                            self.postMessage({ body: { command: "killswitch", data: { event: "okay" } } });
                    }
                } catch (error) {
                    console.error(`[WikiShield] Killswitch worker error:`, error);
                    self.postMessage({ body: { command: "killswitch", data: { event: "unsafe" } } });
                } finally {
                    if (ID === killswitch.ID)
                        setTimeout(() => check(), Math.max(0, interval - (performance.now() - start)));
                }
            };

            check();
        } break;
        case "access": {
            const ID = ++access.ID;

            let { retries } = data;
            const { interval, fetchAccount, fetchGlobal } = data;

            const check = async () => {
                const start = performance.now();
                if (ID !== access.ID)
                    return;

                try {
                    const [ account, global ] = await Promise.all([
                        fetch(...fetchAccount)
                            .then(response => response.json())
                            .then(data => data.query?.userinfo || { })
                            .catch(error => {
                                if (retries++ < 3) {
                                    self.postMessage({ body: { command: "access-resync", data: { retries } } });
                                    return null;
                                } else
                                    throw error;
                            }),
                        fetch(...fetchGlobal)
                            .then(response => response.json())
                            .then(data => data.query?.globaluserinfo || { })
                            .catch(error => {
                                if (retries++ < 3) {
                                    self.postMessage({ body: { command: "access-resync", data: { retries } } });
                                    return null;
                                } else
                                    throw error;
                            })
                    ]);

                    if (account === null || global === null || ID !== access.ID)
                        return;
                    retries = 0;

                    const rights = account.rights.reduce((acc, right) => ({ ...acc, [right]: true }), { });
				    const groups = account.groups.reduce((acc, group) => ({ ...acc, [group]: true }), { });

                    rights.rollback ||= global.rights.includes("rollback");

                    self.postMessage({ body: { command: "access", data: { rights, groups } } });
                } catch (error) {
                    console.error(`[WikiShield] Access worker error:`, error);
                } finally {
                    if (ID === access.ID)
                        setTimeout(() => check(), Math.max(0, interval - (performance.now() - start)));
                }
            };

            check();
        } break;
        case "notifications": {
            const ID = ++notifications.ID;

            let { retries } = data;
            const { interval, fetchParse, fetches } = data;

            const check = async () => {
                const start = performance.now();
                if (ID !== notifications.ID)
                    return;

                try {
                    const results = await Promise.all(fetches.map(async fetchConfig => {
                        let cont = null;

                        const responses = [ ];
                        do {
                            const fetchBody = new URLSearchParams(fetchConfig[1]?.body || "");
                            if (cont)
                                fetchBody.set("notcontinue", cont);

                            const data = (await fetch(fetchConfig[0], { ...(fetchConfig[1] || {}), body: fetchBody.toString() }, ...fetchConfig.slice(2))
                                .then(response => response.json()))?.query?.notifications;
                            responses.push(data);

                            cont = data.continue || null;
                        } while (cont);

                        const list = responses.flatMap(response => response?.list || [ ]);

                        await Promise.all(list.map(async notification => {
                             const fetchParseBody = new URLSearchParams(fetchParse[1]?.body || "");
                             if (fetchParseBody)
                                 fetchParseBody.set("text", notification["*"].body);

                             const parsed = (await fetch(fetchParse[0], { ...(fetchParse[1] || {}), body: fetchParseBody.toString() }, ...fetchParse.slice(2))
                                 .then(response => response.json()))?.parse?.text;
                             notification["*"].parsed = parsed;

                             return notification;
                        }));

                        return list;
                    })).catch(error => {
                        if (retries++ < 3) {
                            self.postMessage({ body: { command: "notifications-resync", data: { retries } } });
                            return null;
                        } else
                            throw error;
                    });

                    if (results === null)
                        return;
                    retries = 0;

                    self.postMessage({ body: { command: "notifications", data: { results } } });
                } catch (error) {
                    console.error(`[WikiShield] Notifications worker error:`, error);
                } finally {
                    if (ID === notifications.ID)
                        setTimeout(() => check(), Math.max(0, interval - (performance.now() - start)));
                }
            };

            check();
        } break;
    }
};