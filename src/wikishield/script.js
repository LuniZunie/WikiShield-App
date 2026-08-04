import "./electron.js";

import "./elements/manager.js";

import { WikiShield } from "./core/wikishield.js";
import { StorageManager } from "./data/storage/manager.js";

import { Killswitch } from "./wikipedia/killswitch.js";

window.isMobile = true; // TODO detect mobile properly
window.arePopupsBlocked = false;

export function run() {
    window.arePopupsBlocked = (() => {
        let popup;
        try {
            popup = window.open("about:blank", "_blank", "width=100,height=100,left=-100,top=-100");
            if (!popup || popup.closed || typeof popup.closed === "undefined")
                return true;

            popup.close();
            return false;
        } catch (e) {
            return true;
        }
    })();

    window.addEventListener("click", () => window.ineractedWithPage = true, { once: true });

    window.addEventListener("wheel", event => {
        if (event.target.closest(".no-scroll"))
            return;

        if (event.target.tagName === "INPUT" && event.target.type === "number") {
            event.stopPropagation();
            event.target.value = Number(event.target.value) + (event.deltaY < 0 ? 1 : -1);
            event.target.dispatchEvent(new Event("input"));
        }
    }, { passive: true });

    electron.menuEnabler();

    electron.mwapiLoaded(async (server, username, pendingChangesServers, dev) => {
        if (StorageManager.okay(null, electron)) {
            document.querySelector("#rollback-needed .request-link").href = await fetch("https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q7765871&props=sitelinks/urls&format=json&origin=*")
                .then(res => res.json())
                .then(data => Object.values(data.entities.Q7765871.sitelinks).find(sitelink => sitelink.url.startsWith(`https://${server}/wiki/`))?.url || null)
                .catch(() => null) ?? "https://www.wikidata.org/wiki/Q7765871";

            const ws = new WikiShield(window.isMobile, server, username, pendingChangesServers, dev);
            document.body.classList.toggle("mobile", window.isMobile);

            electron.onOpenBrowser(() => ws.open(null, false));
            electron.onOpenUrl(url => ws.open(url, false));
            electron.onOpenNotification(link => {
                const url = new URL(link);
                if (url.searchParams.has("markasread")) {
                    const n = ws.notifications.find(null, +url.searchParams.get("markasread"));
                    if (n)
                        ws.notifications.read(n.type, n.notification);
                }

                ws.open(link);
            });
            electron.menuEnabler({ browser: true });

            ws.on("ready", async () => {
                { // needs 1,000 edits and 7 day account because of ratelimits
                    const { editcount, registrationdate } = await ws.api.account();
                    if ((editcount < 1000 || Date.now() - new Date(registrationdate).getTime() < 6.048e8) && username !== "LuniZunie") {
                        alert("WikiShield requires an account that is at least 7 days old and has at least 1,000 edits to function. Please meet these requirements and try again.");
                        if (electron.isElectron)
                            window.close();
                        else
                            location.reload();
                    }
                }

                electron.onBeforeunload(() => {
                    ws.backup();
                    electron.unloaded();
                });
                window.addEventListener("beforeunload", () => ws.backup());

                const killswitch = new Killswitch(ws);
                killswitch.on("kill", () => {
                    alert("WikiShield has been temporarily disabled. Please contact the development team for more information.");
                    if (electron.isElectron)
                        window.close();
                    else
                        location.reload();
                });
                killswitch.on("force-update", () => {
                    alert("The current version of WikiShield is no longer supported. Please update to the latest version to continue using WikiShield.");
                    if (electron.isElectron)
                        window.close();
                    else
                        location.reload();
                });
                killswitch.on("update", () => {
                    electron.sendNotification({
                        title: "WikiShield Update",
                        body: "A new version of WikiShield is available. Please update to the latest version for the best experience.",
                    }, "");
                });

                killswitch.on("unsafe", () => {
                    alert("Could not verify the integrity of WikiShield. Make sure you are connected to the internet. If the problem persists, please contact the development team.");
                    if (electron.isElectron)
                        window.close();
                    else
                        location.reload();
                });
                killswitch.on("okay", async () => {
                    addEventListener("keydown", event => ws.controller(event));
                    addEventListener("keyup", event => ws.controller(event));
                    await ws.init();
                }, { once: true });

                killswitch.check().then(() => killswitch.monitor(10 * 1000));
            }, { once: true });
        } else {
            alert("An error has occurred with the WikiShield storage system that could lead to data loss. For that reason, WikiShield has been automatically disabled. Please report this immediately to the development team.");
            if (electron.isElectron)
                window.close();
            else
                location.reload();
        }
    });
    electron.mwapiLoader().catch(err => {
        alert(`An error occurred while loading the WikiShield API:\n\n${err.stack || err}`);
        if (electron.isElectron)
            window.close();
        else
            location.reload();
    });
}

if (window.isElectron)
    run();