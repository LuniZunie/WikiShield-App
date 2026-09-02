let killswitchInterval;

self.onmessage = event => {
    const { type, body } = event.data;
    if (type !== "post")
        return;

    const { command, data } = body;
    switch (command) {
        case "killswitch": {
            const { interval, expected, fetchArgs } = data;
            if (killswitchInterval)
                clearInterval(killswitchInterval);

            const check = async () => {
                try {
                    const response = await fetch(...fetchArgs)
                        .then(response => response.json())
                        .then(data => data.query?.pages || { })
                        .catch((err) => { return console.error(`[WikiShield] Killswitch fetch error:`, err) || { }; });

                    const content = Object.values(response)?.[0]?.revisions?.[0]?.slots?.main?.content || "";
                    const data = JSON.parse(content)?.WikiShield;
                    if (!data)
                        throw new Error("No killswitch found");
                    else if (data.disabled)
                        return self.postMessage({ body: { command: "killswitch", data: { event: "kill" } } });

                    const soft = data.reload?.soft ?? 0;
                    const hard = data.reload?.hard ?? 0;

                    if (hard > expected.hard)
                        return self.postMessage({ body: { command: "killswitch", data: { event: "force-update" } } });
                    else if (soft > expected.soft)
                        return self.postMessage({ body: { command: "killswitch", data: { event: "update", soft } } });

                    return self.postMessage({ body: { command: "killswitch", data: { event: "okay" } } });
                } catch (error) {
                    console.error(`[WikiShield] Killswitch worker error:`, error);
                    self.postMessage({ body: { command: "killswitch", data: { event: "unsafe" } } });
                }
            };

            killswitchInterval = setInterval(check, interval);
            check();
        } break;
    }
};