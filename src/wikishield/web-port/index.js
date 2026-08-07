import { run } from "../script.js";
import { build } from "./build.js";

{
    "use strict";

    function start() {
        build().then(() => {
            run();

            window.onpopstate = event => {
                if (event.state?.page !== "WikiShield") {
                    window.location.reload();
                    window.onpopstate = null;
                }
            };
        }).catch(error => {
            console.error("[WikiShield] Error during build:", error);
            alert("An error occurred while starting WikiShield. Please check the console for details.");
        });
    }

    const $link = mw.util.addPortletLink(
        "p-personal",
        mw.util.getUrl("Wikipedia:WikiShield/run"),
        "WikiShield",
        "pt-wikishield",
        "WikiShield",
        undefined,
        "#pt-preferences"
    );

    if ($link) {
        const $icon = $link.querySelector(":scope > a > span");
        if ($icon) {
            $icon.innerHTML = "WS";
            $icon.style.fontWeight = "bold";
            $icon.style.color = "var(--color-base, #202122)";
            $icon.style.maskImage = "none";
            $icon.style.webkitMaskImage = "none";
            $icon.style.background = "transparent";
            $icon.style.height = "auto";
        }

        if (electron.localStorage.get("WikiShield:OpenExternally") !== "true")
            $link.addEventListener("click", event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
                    return;

                event.preventDefault();
                window.history.pushState({ page: "WikiShield" }, "", window.location.href);

                start();
            });
    }

    window.addEventListener("popstate", event => {
        if (event.state?.page === "WikiShield")
            start();
    });

    switch (window.history.state?.page) {
        case "WikiShield": {
            window.history.replaceState(null, "", window.location.href);
        } break;
        case "WikiShield-reload": {
            window.history.replaceState({ page: "WikiShield" }, "", window.location.href);
            start();
        } break;
    }

    if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
        window.history.pushState({ page: "WikiShield" }, "", window.location.href);
        start();
    }
}