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
        "#pt-notifications"
    );

    if ($link && electron.localStorage.get("WikiShield:OpenExternally") !== "true")
        $link.addEventListener("click", event => {
            event.preventDefault();
            history.pushState({ page: "WikiShield" }, "", location.href);

            start();
        });

    addEventListener("popstate", event => {
        if (event.state?.page === "WikiShield")
            start();
    });

    switch (history.state?.page) {
        case "WikiShield": {
            history.replaceState(null, "", location.href);
        } break;
        case "WikiShield-reload": {
            history.replaceState({ page: "WikiShield" }, "", location.href);
            start();
        } break;
    }

    if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
        history.pushState({ page: "WikiShield" }, "", location.href);
        start();
    }
}