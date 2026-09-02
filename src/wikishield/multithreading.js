self.onmessage = event => {
    const { command, opts } = event.data;
    switch (command) {
        case "killswitch": {
            const { interval, expected, fetchArgs } = opts;

            setInterval(async () => {
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
                        return self.postMessage({ command: "killswitch", opts: { event: "kill" } });

                    const soft = data.reload?.soft ?? 0;
                    const hard = data.reload?.hard ?? 0;

                    if (hard > expected.hard)
                        return self.postMessage({ command: "killswitch", opts: { event: "force-update" } });
                    else if (soft > expected.soft)
                        return self.postMessage({ command: "killswitch", opts: { event: "update", soft } });

                    return self.postMessage({ command: "killswitch", opts: { event: "okay" } });
                } catch (error) {
                    console.error(`[WikiShield] Killswitch worker error:`, error);
                    self.postMessage({ command: "killswitch", opts: { event: "unsafe" } });
                }
            }, interval);
        } break;
    }
};