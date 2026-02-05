import { Logger } from "./logger.js";
import { Version } from "./versions.js";

import "./versions/v0.js";
import "./versions/v1.js";
import "./versions/v2.js";
import "./versions/v3.js";

export class StorageManager {
    static version = Version.v3;
    static get versions() {
        return new Map([
            [  0, Version.v0 ],
            [  1, Version.v1 ],
            [  2, Version.v2 ],
            [  3, Version.v3 ],
        ]);
    }

    constructor() {
        this.reset(new Logger());
    }

    reset(logger) {
        logger?.log(`Resetting storage to default.`);
        this.data = StorageManager.version.default;

        StorageManager.version.init(logger, this.data);
        StorageManager.version.validate();
        StorageManager.version.construct();

        return this.data;
    }

    load(data = { }) {
        const logger = new Logger();

        let version = data.version ??= 0;
        if (StorageManager.versions.has(version)) {
            const expectedVersion = StorageManager.version.number;
            while (version !== expectedVersion) {
                const StorageClass = StorageManager.versions.get(version + 1);
                if (typeof StorageClass?.constructor === "function" && new StorageClass() instanceof Version) {
                    logger.log(`Upgrading storage from version ${version} to ${version + 1}`, true);
                    try {
                        if (!StorageClass.init(logger, data)) {
                            data = this.reset(logger);
                            break;
                        }

                        data = StorageClass.upgrade();
                        data.version = ++version; // we do this here to avoid infinite loops in case of upgrade failure
                    } catch (err) {
                        logger.error(`Error upgrading storage from version ${version} to ${version + 1}: ${err}`);
                        data = this.reset(logger);
                        break;
                    }
                } else {
                    logger.dev(`[MISSING_UPGRADE_METHOD] Uh oh! Something has gone wrong; this message should never appear. Please report this to the WikiShield developers.`);
                    data = this.reset(logger);
                    break;
                }
            }

            version = data.version;
            logger.log(`Initializing storage at version ${version}.`, true);
            StorageManager.version.init(logger, data);
            logger.log(`Validating storage at version ${version}.`, true);
            StorageManager.version.validate();
            logger.log(`Constructing storage at version ${version}.`, true);
            data = StorageManager.version.construct();

            logger.log(`Storage loaded successfully at version ${version}.`, true);
            this.data = data;
        } else {
            logger.error(`Storage version ${version} is corrupted or unsupported.`);
            this.reset(logger);
        }

        return { data: this.data, logs: logger.getLogs() };
    }

    save() {
        const logger = new Logger();

        const version = StorageManager.version.number;
        logger.log(`Initializing storage at version ${version}.`, true);
        StorageManager.version.init(logger, this.data);
        logger.log(`Deconstructing storage at version ${version}.`, true);
        const data = StorageManager.version.deconstruct();

        logger.log(`Storage saved successfully at version ${version}.`, true);
        return { data, logs: logger.getLogs() };
    }

    decode(string) {
        try {
            return this.load(JSON.parse(atob(string.trim() || "e30=")));
        } catch (err) { return this.load({ }); }
    }

    encode() {
        const { data, logs } = this.save();
        const string = btoa(JSON.stringify(data));

        return { string, logs };
    }

    static output(logs, name = "<unknown>", logger = console) {
        const allExpected = !logs.some(log => !log.expected);

        logger?.log?.(`[${allExpected ? " " : "X"}] WikiShield Storage Logs: ${name}`);
        for (const log of logs) {
            let prefix = `[${log.expected ? " " : "X"}][${log.timestamp}][Storage]`;

            let type = log.type;
            if (type === "dev") {
                type = "error";
                prefix = `#DEV# ${prefix}`;
            }

            logger?.[type]?.(`${prefix} ${log.message}`);
        }
    }
    static okay(data, logger = console) {
        data ??= new StorageManager().load(StorageManager.versions.get(0).default);

        const okay = !(data.logs?.some?.(log => !log.expected) ?? true);
        if (okay)
            return okay;
        else
            return void(StorageManager.output(data.logs, "Storage Check", logger)) ?? okay;
    }
}