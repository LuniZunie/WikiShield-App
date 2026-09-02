import { Multithread } from "./class.js";

async function getRawJS(path) {
    try {
        return await fetch(path).then(response => response.text());
    } catch (error) {
        console.error("[WikiShield] Failed to fetch raw JS from path:", path, error);
        throw error;
    }
}

async function loadMultithreadedCode() {
    Multithread.LOADED_FILES["background-checks"] = await getRawJS("./multithreading/scripts/background-checks.raw.js");
}

export { loadMultithreadedCode };