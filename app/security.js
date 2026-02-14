const { shell } = require('electron/common');
const { safeStorage } = require('electron/main');

class Security {
    static openExternal(url) {
        const protocol = new URL(url).protocol;
        const protocols = ['http:', 'https:', 'mailto:', 'wikishield:', 'tel:', 'file:']; // yes, we allow file: protocol because malware would already need to be downloaded to exploit that
        if (protocols.includes(protocol))
            return shell.openExternal(url);
        else
            console.error(`Blocked attempt to open external URL with unsupported protocol: ${url}`);
    }

    static encrypt(data) {
        data ??= "";
        return safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(data) : data;
    }
    static decrypt(data) {
        return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(data.data)) : data;
    }

    static encryptAccounts(accounts) {
        return Object.fromEntries(Object.entries(accounts).map(([ username, data ]) => {
            return [ username, { ...data, accessToken: undefined, refreshToken: Security.encrypt(data.refreshToken) } ];
        }));
    }
    static decryptAccounts(accounts) {
        return Object.fromEntries(Object.entries(accounts).map(([ username, data ]) => {
            return [ username, { ...data, accessToken: undefined, refreshToken: Security.decrypt(data.refreshToken) } ];
        }));
    }
}

module.exports = { Security };