import WS_HTML from "../index.html";

import COMMON_CSS from "../../common/style.css";
import WS_CSS from "../style.css";

export async function build() {
    document.head.querySelectorAll("link[rel=stylesheet]").forEach(link => link.remove()); // Clear existing stylesheets

    const parser = new DOMParser();
    const doc = parser.parseFromString(WS_HTML, "text/html");

    document.title = doc.title;
    doc.head.querySelectorAll("link[rel=stylesheet]").forEach(link => {
        document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: link.href }));
    });

    const styles = [ COMMON_CSS, WS_CSS ]
        .filter(Boolean)
        .forEach(css => {
            const $style = document.createElement("style");
            $style.textContent = css;
            document.head.appendChild($style);
        });

    document.body.innerHTML = doc.body.innerHTML; // load body after CSS so everything is styled on load

    await new Promise(requestAnimationFrame); // wait for next frame to ensure everything is rendered
}