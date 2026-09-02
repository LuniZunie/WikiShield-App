import { Multithread } from "./class.js";
import backgroundChecks from './scripts/background-checks.raw.js';

async function loadMultithreadedCode() {
    Multithread.LOADED_FILES["background-checks"] = backgroundChecks;
}

export { loadMultithreadedCode };