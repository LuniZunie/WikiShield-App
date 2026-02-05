export const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
export const isURL = str => {
    try {
        new URL(str);
        return true;
    } catch { return false; }
};