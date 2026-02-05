import { Logger } from "./logger.js";
import { isObject } from "./utility.js";

export class Version {
    static loadedLogger = new Logger();
    static loadedData = { };

    static sanitize(path, fallback, callback = null) {
        const value = path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.loadedData);
        if (value === undefined)
            return void(this.loadedLogger.warn(`Missing expected key path [ ${path.join(" -> ")} ] in stored data, defaulting to fallback value.`)) ?? fallback;

        if (typeof callback === "function") {
            const modValue = callback(value);
            if (modValue === undefined)
                return void(this.loadedLogger.warn(`Invalid value at key path [ ${path.join(" -> ")} ] in stored data, defaulting to fallback value.`)) ?? fallback;
            return modValue;
        }

        return value;
    }

    static exists(...path) {
        return path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.loadedData) !== undefined;
    }

    static deprecated(...path) {
        if (this.exists(...path))
            return void(this.loadedLogger.warn(`Skipped deprecated key path [ ${path.join(" -> ")} ] in stored data.`, true)) ?? true;
        return false;
    }

    static reset(...path) {
        this.loadedLogger.warn(`Resetting key path [ ${path.join(" -> ")} ] in stored data to default value.`);
        const value = path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.default);
        if (value === undefined)
            return void(this.loadedLogger.dev(`Could not find default value for key path [ ${path.join(" -> ")} ] in stored data.`));

        const final = path.pop();
        const scope = path.reduce((scope, key) => {
            if (scope[key] === undefined)
                scope[key] = { };
            return scope[key];
        }, this.loadedData);

        scope[final] = value;
    }

    static restrictObject(obj, ...path) {
        if (!isObject(obj))
            return void(this.reset(...path)) ?? false;

        const keys = Object.keys(path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.default));
        Object.keys(obj).forEach(key => {
            if (!keys.includes(key)) {
                this.loadedLogger.warn(`Removing unexpected key [ ${[ ...path, key ].join(" -> ")} ] from stored data.`);
                delete obj[key]; // remove unexpected keys
            }
        });

        return true;
    }

    static number = 0;
    static get default() {
        return { };
    }

    static init(logger, data) {
        this.loadedLogger = logger;
        this.loadedData = data;

        return true;
    }

    static upgrade() {
        if (this.loadedData.version !== this.number - 1) {
            this.loadedLogger.dev(`[INVALID_UPGRADE_ATTEMPT] Attempted to upgrade from version ${this.loadedData.version} to version ${this.number}, but this upgrade method only supports upgrades from version ${this.number - 1}.`);
            throw new Error("INVALID_UPGRADE_ATTEMPT");
        }

        return { };
    }

    static validate() {
        const root = this.loadedData;
        this.restrictObject(root, );

        if (root.version !== this.number)
            return void(this.loadedLogger.error(`Stored data version ${root.version} does not match expected version ${this.number}.`)) ?? false;
        return true;
    }
}