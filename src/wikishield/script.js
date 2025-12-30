import './elements/manager.js';

import { WikiShield } from './core/wikishield.js';
import { StorageManager } from './data/storage.js';

import { Killswitch } from './wikipedia/killswitch.js';

window.addEventListener("wheel", event => {
    if (event.target.closest('.no-scroll'))
        return;

    if (event.target.tagName === 'INPUT' && event.target.type === 'number') {
        event.stopPropagation();
        event.target.value = Number(event.target.value) + (event.deltaY < 0 ? 1 : -1);
        event.target.dispatchEvent(new Event('input'));
    }
}, { passive: true });

if (StorageManager.okay(null, window.electronAPI)) {
    const ws = new WikiShield(await window.electronAPI.getServer());
    ws.on("ready", () => {
        window.addEventListener("beforeunload", () => {
            ws.save();
        });

        const killswitch = new Killswitch(ws);
        killswitch.on("kill", () => {
            window.alert("WikiShield has been temporarily disabled. Please contact the development team for more information.");
            window.electronAPI.quit();
        });
        killswitch.on("force-update", () => {
            window.alert("The current version of WikiShield is no longer supported. Please update to the latest version to continue using WikiShield.");
            window.electronAPI.quit();
        });
        killswitch.on("update", () => {
            window.electronAPI.notify({
                title: "WikiShield Update",
                body: "A new version of WikiShield is available. Please update to the latest version for the best experience.",
                type: "info",
            });
        });

        killswitch.on("unsafe", () => {
            window.alert("Could not verify the integrity of WikiShield. Make sure you are connected to the internet. If the problem persists, please contact the development team.");
            window.electronAPI.quit();
        });
        killswitch.on("okay", async () => {
            window.addEventListener("keydown", event => ws.controller(event));
            window.addEventListener("keyup", event => ws.controller(event));
            await ws.init();
        }, { once: true });

        killswitch.check().then(() => killswitch.monitor(10 * 1000));
    }, { once: true });
} else {
    window.alert("An error has occurred with the WikiShield storage system that could lead to data loss. For that reason, WikiShield has been automatically disabled. Please report this immediately to the development team.");
    window.electronAPI.quit();
}