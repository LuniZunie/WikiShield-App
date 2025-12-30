const { shell } = require('electron/common');
const {
    app, BaseWindow, BrowserWindow, Menu, Tray, Notification, nativeImage, safeStorage,
    screen, ipcMain, dialog, globalShortcut, clipboard, crashReporter
} = require('electron/main');
const Store = require('electron-store');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

const __DEV__ = process.env.NODE_ENV === 'development' || !app.isPackaged;
if (require('electron-squirrel-startup')) {
    app.quit();
}

// Handle Squirrel events on Windows
if (process.platform === 'win32') {
    const handleSquirrelEvent = () => {
        if (process.argv.length === 1) {
            return false;
        }

        const squirrelEvent = process.argv[1];
        const appFolder = path.resolve(process.execPath, '..');
        const rootAtomFolder = path.resolve(appFolder, '..');
        const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
        const exeName = path.basename(process.execPath);

        const spawn = function(command, args) {
            let spawnedProcess;
            try {
                spawnedProcess = require('child_process').spawn(command, args, { detached: true });
            } catch (error) {}
            return spawnedProcess;
        };

        const spawnUpdate = function(args) {
            return spawn(updateDotExe, args);
        };

        switch (squirrelEvent) {
            case '--squirrel-install':
            case '--squirrel-updated':
                spawnUpdate(['--createShortcut', exeName]);
                setTimeout(app.quit, 1000);
                return true;

            case '--squirrel-uninstall':
                spawnUpdate(['--removeShortcut', exeName]);
                setTimeout(app.quit, 1000);
                return true;

            case '--squirrel-obsolete':
                app.quit();
                return true;
        }
    };

    if (handleSquirrelEvent()) {
        app.quit();
    }
}

crashReporter.start({ submitURL: 'https://luni.me/crash-report' });

log.transports.file.level = 'debug';
log.transports.file.file = path.join(app.getPath('userData'), 'logs', 'wikishield.log');
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

let loadedAccount = null;
let server = null;
const windows = {
    main: null,
    login: null,
    accounts: null,
};

const userLoginCookies = { };

const store = new Store({
    defaults: {
        server: null,
        accounts: [],
    }
});

async function createBadgeIcon(count) {
    const text = count > 99 ? '99+' : count.toString();

    // Create canvas using webContents to ensure proper rendering
    const code = `
        const canvas = document.createElement('canvas');
        const size = 16; // Windows overlay icon size
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const text = '${text}';
        const fontSize = text.length > 2 ? 8.5 : 10.5;

        // Draw outer glow shadow
        ctx.shadowColor = 'rgba(240, 147, 251, 0.8)';
        ctx.shadowBlur = 3;
        ctx.fillStyle = 'rgba(240, 147, 251, 0.3)';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw main shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1.5;

        // Create gradient background matching app theme
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#f093fb');

        // Draw main circle
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadows
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Draw subtle border/rim
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1.75, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner top highlight
        const highlightGradient = ctx.createRadialGradient(size / 2, size / 2 - 3, 0, size / 2, size / 2, size / 2);
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw text with shadow for depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 1;
        ctx.shadowOffsetY = 0.5;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold ' + fontSize + 'px Segoe UI, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Fine-tune vertical centering
        const yOffset = text.length > 2 ? 0.3 : 0.2;
        ctx.fillText(text, size / 2, size / 2 + yOffset);

        canvas.toDataURL('image/png');
    `;

    try {
        const dataURL = await windows.main.webContents.executeJavaScript(code);
        const image = nativeImage.createFromDataURL(dataURL);

        // Ensure the image has the correct size
        if (image.isEmpty()) {
            throw new Error('Created image is empty');
        }

        // Resize to ensure it's 16x16 for overlay icon
        return image.resize({ width: 16, height: 16 });
    } catch (error) {
        log.error('Failed to create badge icon:', error);
        return null;
    }
}

let cachedLoginToken = {
    token: null,
    cookies: null,
};

// Language code to name mapping
const languageNames = {
    'af': 'Afrikaans', 'sq': 'Albanian', 'am': 'Amharic', 'ar': 'Arabic', 'hy': 'Armenian',
    'az': 'Azerbaijani', 'eu': 'Basque', 'be': 'Belarusian', 'bn': 'Bengali', 'bs': 'Bosnian',
    'bg': 'Bulgarian', 'ca': 'Catalan', 'ceb': 'Cebuano', 'ny': 'Chichewa', 'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)', 'co': 'Corsican', 'hr': 'Croatian', 'cs': 'Czech', 'da': 'Danish',
    'nl': 'Dutch', 'en': 'English', 'eo': 'Esperanto', 'et': 'Estonian', 'tl': 'Filipino', 'fi': 'Finnish',
    'fr': 'French', 'fy': 'Frisian', 'gl': 'Galician', 'ka': 'Georgian', 'de': 'German', 'el': 'Greek',
    'gu': 'Gujarati', 'ht': 'Haitian Creole', 'ha': 'Hausa', 'haw': 'Hawaiian', 'iw': 'Hebrew', 'he': 'Hebrew',
    'hi': 'Hindi', 'hmn': 'Hmong', 'hu': 'Hungarian', 'is': 'Icelandic', 'ig': 'Igbo', 'id': 'Indonesian',
    'ga': 'Irish', 'it': 'Italian', 'ja': 'Japanese', 'jw': 'Javanese', 'kn': 'Kannada', 'kk': 'Kazakh',
    'km': 'Khmer', 'ko': 'Korean', 'ku': 'Kurdish', 'ky': 'Kyrgyz', 'lo': 'Lao', 'la': 'Latin',
    'lv': 'Latvian', 'lt': 'Lithuanian', 'lb': 'Luxembourgish', 'mk': 'Macedonian', 'mg': 'Malagasy',
    'ms': 'Malay', 'ml': 'Malayalam', 'mt': 'Maltese', 'mi': 'Maori', 'mr': 'Marathi', 'mn': 'Mongolian',
    'my': 'Myanmar', 'ne': 'Nepali', 'no': 'Norwegian', 'or': 'Odia', 'ps': 'Pashto', 'fa': 'Persian',
    'pl': 'Polish', 'pt': 'Portuguese', 'pa': 'Punjabi', 'ro': 'Romanian', 'ru': 'Russian', 'sm': 'Samoan',
    'gd': 'Scots Gaelic', 'sr': 'Serbian', 'st': 'Sesotho', 'sn': 'Shona', 'sd': 'Sindhi', 'si': 'Sinhala',
    'sk': 'Slovak', 'sl': 'Slovenian', 'so': 'Somali', 'es': 'Spanish', 'su': 'Sundanese', 'sw': 'Swahili',
    'sv': 'Swedish', 'tg': 'Tajik', 'ta': 'Tamil', 'te': 'Telugu', 'th': 'Thai', 'tr': 'Turkish',
    'uk': 'Ukrainian', 'ur': 'Urdu', 'ug': 'Uyghur', 'uz': 'Uzbek', 'vi': 'Vietnamese', 'cy': 'Welsh',
    'xh': 'Xhosa', 'yi': 'Yiddish', 'yo': 'Yoruba', 'zu': 'Zulu'
};

async function translateToEnglish(text) {
    try {
        const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`);
        const data = await response.json();
        const translated = data[0].map(item => item[0]).join('');
        const detectedLang = data[2] || 'unknown';
        const languageName = languageNames[detectedLang] || detectedLang;

        return {
            translated,
            detectedLanguage: languageName,
            detectedLanguageCode: detectedLang
        };
    } catch (error) {
        log.error('Translation error:', error);
        return null;
    }
}

async function showTranslationDialog(window, original, result) {
    const maxLength = 100;
    const truncateText = (text) => text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const message = [
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📝 Original (${result.detectedLanguage}):`,
        `   ${truncateText(original)}`,
        ``,
        `🌐 English Translation:`,
        `   ${truncateText(result.translated)}`,
        ``,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n');

    const response = await dialog.showMessageBox(window, {
        type: 'info',
        title: `Translation: ${result.detectedLanguage} → English`,
        message: message,
        buttons: ['Copy Translation', 'Copy Original', 'Close'],
        defaultId: 0,
        cancelId: 2,
        noLink: true
    });

    if (response.response === 0)
        clipboard.writeText(result.translated);
    else if (response.response === 1)
        clipboard.writeText(original);
}

function AddAppMenuItems() {
    if (windows.main) {
        const isMac = process.platform === 'darwin';
        const template = [
            {
                label: GetActiveAccount() || 'WikiShield',
                submenu: [
                    {
                        label: 'Accounts',

                        type: 'submenu',
                        submenu: Object.entries(global.accounts).sort((a, b) => b[1].lastLogin - a[1].lastLogin).map(([ username, account ]) => ({
                            type: 'radio',
                            label: username,
                            checked: account.active,
                            click() {
                                SetActiveAccount(username);
                            }
                        })).concat([
                            {
                                label: 'Add Account',
                                click() {
                                    BuildLoginWindow();
                                }
                            },
                            { type: 'separator' },
                            {
                                label: 'Manage Accounts',
                                click() {
                                    BuildAccountsWindow();
                                }
                            }
                        ])
                    },
                    { type: 'separator' },
                    { role: 'close' },
                    { role: 'quit' }
                ]
            },
            {
                label: server || 'Server',
                submenu: [
                    {
                        type: 'radio',
                        label: 'en.wikipedia.org',
                        checked: server === 'en.wikipedia.org',
                        click() {
                            SwitchServer('en.wikipedia.org');
                        }
                    },
                    {
                        type: 'radio',
                        label: 'test.wikipedia.org',
                        checked: server === 'test.wikipedia.org',
                        click() {
                            SwitchServer('test.wikipedia.org');
                        }
                    },
                    {
                        type: 'radio',
                        label: 'test2.wikipedia.org',
                        checked: server === 'test2.wikipedia.org',
                        click() {
                            SwitchServer('test2.wikipedia.org');
                        }
                    }
                ]
            },
            {
                label: 'Settings',
                submenu: [
                    {
                        label: 'Notifications',
                        click() {

                        }
                    },
                    {
                        label: 'Preferences',
                        click() {
                            if (windows.main) {
                                windows.main.webContents.send("open-settings");
                            }
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Import',
                        submenu: [
                            {
                                label: 'From File',
                                click() {
                                    if (windows.main) {
                                        windows.main.webContents.send("import-settings-from-file");
                                    }
                                }
                            },
                            {
                                label: 'From Clipboard',
                                click() {
                                    if (windows.main) {
                                        windows.main.webContents.send("import-settings-from-clipboard");
                                    }
                                }
                            },
                            {
                                label: 'From Input',
                                click() {
                                    if (windows.main) {
                                        windows.main.webContents.send("import-settings-from-input");
                                    }
                                }
                            }
                        ],
                    },
                    {
                        label: 'Export',
                        submenu: [
                            {
                                label: 'To File',
                                click() {
                                    if (windows.main) {
                                        windows.main.webContents.send("export-settings-to-file");
                                    }
                                }
                            },
                            {
                                label: 'To Clipboard',
                                click() {
                                    if (windows.main) {
                                        windows.main.webContents.send("export-settings-to-clipboard");
                                    }
                                }
                            }
                        ],
                    }
                ]
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'selectAll' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                    { role: 'pasteAndMatchStyle' },
                    { type: 'separator' },
                    ...(isMac ? [
                        {
                            label: "Typing",
                            submenu: [
                                { role: 'showSubstitutions' },
                                { role: 'toggleSmartQuotes' },
                                { role: 'toggleSmartDashes' },
                                { role: 'toggleTextReplacement' },
                                { role: 'toggleSpellChecker' }
                            ]
                        }
                    ] : [
                        { role: 'toggleSpellChecker' }
                    ])
                ]
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forcereload' },
                    { type: 'separator' },
                    { role: 'resetzoom' },
                    { role: 'zoomin' },
                    { role: 'zoomout' },
                    { type: 'separator' },
                    { role: 'minimize' },
                    { role: 'togglefullscreen' }
                ]
            },
            {
                label: 'Help',
                submenu: [
                    {
                        label: 'WikiShield',
                        click: async () => {
                            await shell.openExternal('https://en.wikipedia.org/wiki/Wikipedia:WikiShield');
                        }
                    },
                    {
                        label: 'Changelog',
                        click: () => {

                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Check for Updates...',
                        click: () => {
                            log.info('Manual update check triggered');
                            autoUpdater.checkForUpdates()
                                .then(result => {
                                    log.info('Manual update check result:', result);
                                    if (!result || result.updateInfo.version === app.getVersion()) {
                                        dialog.showMessageBox({
                                            type: 'info',
                                            title: 'No Updates',
                                            message: `You're running the latest version (${app.getVersion()})`,
                                            buttons: ['OK']
                                        });
                                    }
                                })
                                .catch(err => {
                                    log.error('Manual update check failed:', err);
                                    dialog.showErrorBox('Update Check Failed', `Failed to check for updates: ${err.message}`);
                                });
                        }
                    },
                    { type: 'separator' },
                    ...(__DEV__ ? [
                        { role: 'toggleDevTools' },
                        { type: 'separator' }
                    ] : []),
                    { type: 'separator' },
                    { role: 'about' },
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }
}

async function BuildMainWindow() {
    if (!GetActiveAccount()) {
        BuildLoginWindow();
        return;
    }

    windows.main = new BrowserWindow({
        show: false,
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            sandbox: true,
            v8CacheOptions: 'code',
            disableBlinkFeatures: 'Auxclick',
            backgroundThrottling: false
        },
    });

    AddAppMenuItems();

    windows.main.webContents.on('context-menu', (e, params) => {
        const contextMenu = Menu.buildFromTemplate([
            ...(params.editFlags.canCopy ? [{ role: 'copy' }] : []),
            ...(params.editFlags.canCut ? [{ role: 'cut' }] : []),
            ...(params.editFlags.canPaste ? [{ role: 'paste' }] : []),
            { type: 'separator' },
            { role: 'selectAll' },
            ...(params.selectionText ? [
                { type: 'separator' },
                {
                    label: 'Translate to English',
                    click: async () => {
                        const result = await translateToEnglish(params.selectionText);
                        if (result)
                            await showTranslationDialog(windows.main, params.selectionText, result);
                        else
                            dialog.showErrorBox('Translation Error', 'Failed to translate text. Please check your internet connection.');
                    }
                }
            ] : [])
        ]);
        contextMenu.popup(windows.main, params.x, params.y);
    });

    windows.main.loadFile(path.join(__dirname, 'src', 'wikishield', 'index.html'));
    windows.main.once('ready-to-show', () => {
        windows.main.maximize();
    });

    return windows.main;
}

function BuildLoginWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const min = Math.min(width, height);

    windows.login = new BrowserWindow({
        parent: windows.main instanceof BaseWindow ? windows.main : null,
        modal: true,
        show: false,
        width: Math.floor(min * 0.8),
        height: Math.floor(min * 0.8),
        resizable: false,
        maximizable: false,
        minimizable: false,
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            sandbox: true,
            v8CacheOptions: 'code',
            backgroundThrottling: false
        }
    });

    windows.login.webContents.on('context-menu', (e, params) => {
        const contextMenu = Menu.buildFromTemplate([
            ...(params.editFlags.canCopy ? [{ role: 'copy' }] : []),
            ...(params.editFlags.canCut ? [{ role: 'cut' }] : []),
            ...(params.editFlags.canPaste ? [{ role: 'paste' }] : []),
            { type: 'separator' },
            { role: 'selectAll' },
            ...(params.selectionText ? [
                { type: 'separator' },
                {
                    label: 'Translate to English',
                    click: async () => {
                        const result = await translateToEnglish(params.selectionText);
                        if (result)
                            await showTranslationDialog(windows.login, params.selectionText, result);
                        else
                            dialog.showErrorBox('Translation Error', 'Failed to translate text. Please check your internet connection.');
                    }
                }
            ] : [])
        ]);
        contextMenu.popup(windows.login, params.x, params.y);
    });

    windows.login.loadFile(path.join(__dirname, 'src', 'login', 'index.html'));
    windows.login.setMenuBarVisibility(false);

    windows.login.once('ready-to-show', () => {
        windows.login.show();
    });

    return windows.login;
}

function BuildAccountsWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const min = Math.min(width, height);

    windows.accounts = new BrowserWindow({
        parent: windows.main instanceof BaseWindow ? windows.main : null,
        modal: true,
        show: false,
        width: Math.floor(min * 0.8),
        height: Math.floor(min * 0.6),
        resizable: false,
        maximizable: false,
        minimizable: false,
        icon: nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            sandbox: true,
            v8CacheOptions: 'code',
            backgroundThrottling: false
        }
    });

    windows.accounts.webContents.on('context-menu', (e, params) => {
        const contextMenu = Menu.buildFromTemplate([
            ...(params.editFlags.canCopy ? [{ role: 'copy' }] : []),
            ...(params.editFlags.canCut ? [{ role: 'cut' }] : []),
            ...(params.editFlags.canPaste ? [{ role: 'paste' }] : []),
            { type: 'separator' },
            { role: 'selectAll' },
            ...(params.selectionText ? [
                { type: 'separator' },
                {
                    label: 'Translate to English',
                    click: async () => {
                        const result = await translateToEnglish(params.selectionText);
                        if (result)
                            await showTranslationDialog(windows.accounts, params.selectionText, result);
                        else
                            dialog.showErrorBox('Translation Error', 'Failed to translate text. Please check your internet connection.');
                    }
                }
            ] : [])
        ]);
        contextMenu.popup(windows.accounts, params.x, params.y);
    });

    windows.accounts.loadFile(path.join(__dirname, 'src', 'accounts', 'index.html'));
    windows.accounts.setMenuBarVisibility(false);

    windows.accounts.once('ready-to-show', () => {
        windows.accounts.show();
    });

    return windows.accounts;
}

function BuildTray() {
    const tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.png')));
    tray.setToolTip('WikiShield');

    tray.on('click', () => {
        if (windows.main.isVisible()) {
            windows.main.minimize();
        } else {
            windows.main.restore();
            windows.main.focus();
        }
    });

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(contextMenu);

    return tray;
}

function SendNotification(options, click) {
    if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, 'assets', 'icon.png');
        let icon = options.icon || nativeImage.createFromPath(iconPath);

        if (!icon.isEmpty() && process.platform === 'win32') {
            icon = icon.resize({ width: 256, height: 256 });
        }

        const notificationOptions = {
            ...options,
            icon: icon,
        };
        const notification = new Notification(notificationOptions);
        notification.show();

        if (typeof click === "string")
            notification.on('click', () => {
                shell.openExternal(click);
            });
    }
}

function SwitchServer(newServer) {
    if (server !== newServer) {
        server = newServer;
        store.set('server', server);
        AddAppMenuItems();

        if (windows.main)
            windows.main.reload();
    }
}

function Save() {
    global.accounts ??= { };
    const accountsToStore = Object.fromEntries(Object.entries(global.accounts).map(([ username, account ]) => ([
        username, {
            password: safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(account.password) : account.password,
            active: account.active === true,
            lastLogin: account.lastLogin,
        }
    ])));
    store.set('accounts', accountsToStore);
    store.set('server', server);

    AddAppMenuItems();
}

function GetActiveAccount() {
    for (const [ username, account ] of Object.entries(global.accounts))
        if (account.active)
            return username;

    return null;
}

async function LoadAccounts() {
    const storedAccounts = store.get('accounts');

    let accounts = Object.entries((typeof storedAccounts === 'object' && storedAccounts !== null ? storedAccounts : { }));
    accounts = accounts.filter(([ , account ]) => typeof account === 'object' && account !== null && account.password);
    accounts = accounts.map(([ username, account ]) => {
        try {
            return [username, {
                password: safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(new Uint8Array(account.password.data)) : account.password,
                active: account.active === true,
                lastLogin: account.lastLogin,
            }];
        } catch (e) {
            return null;
        }
    }).filter(entry => entry !== null);

    global.accounts = { };

    const errors = new Set();
    await Promise.allSettled(accounts.map(async ([ username, account ]) => {
        const valid = await CheckAccountLogin(username, account.password, errors);

        global.accounts[username] = {
            password: account.password,
            active: account.active && valid,
            valid: valid,
            lastLogin: account.lastLogin,
        }
    }));

    return global.accounts;
}

async function CheckAccountLogin(username, password, errors = new Set()) {
    let token = cachedLoginToken.token;
    let cookies = cachedLoginToken.cookies;

    if (!token) {
        const tokenResponse = await fetch('https://en.wikipedia.org/w/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                action: 'query',
                meta: 'tokens',
                type: 'login',
                format: 'json'
            }).toString()
        }).catch(error => {
            const errorText = error.message;
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return null;
        });

        if (!tokenResponse?.ok) {
            const errorText = tokenResponse?.statusText || 'Unknown error';
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return false;
        }

        cookies = tokenResponse.headers.get('set-cookie');
        const tokenData = await tokenResponse.json();
        token = tokenData.query?.tokens?.logintoken;

        if (!token) {
            const errorText = 'No token received';
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return false;
        }

        // Cache the token and cookies
        cachedLoginToken.token = token;
        cachedLoginToken.cookies = cookies;
    }

    const loginResult = await fetch('https://en.wikipedia.org/w/api.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...(cookies && { 'Cookie': cookies })
        },
        body: new URLSearchParams({
            action: 'login',
            lgname: username,
            lgpassword: password,
            lgtoken: token,
            format: 'json'
        }).toString()
    })
        .then(response => {
            userLoginCookies[username] = response.headers?.get('set-cookie') || null;

            return response.json();
        })
        .then(data => {
            if (data.login?.result === 'Success') {
                return true;
            } else if (data.login?.result === 'Failed' || data.login?.result === 'NeedToken') {
                return 'retry';
            } else {
                const errorText = data.login?.reason || 'Unknown error';
                if (errors.has(errorText))
                    return;
                errors.add(errorText);

                dialog.showErrorBox(`Error during login for ${username}`, errorText);
                return false;
            }
        })
        .catch(error => {
            dialog.showErrorBox(`Error during login for ${username}`, errorText);
            return false;
        });

    if (loginResult === 'retry') {
        cachedLoginToken.token = null;
        cachedLoginToken.cookies = null;

        const tokenResponse = await fetch('https://en.wikipedia.org/w/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                action: 'query',
                meta: 'tokens',
                type: 'login',
                format: 'json'
            }).toString()
        }).catch(error => {
            const errorText = error.message;
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return null;
        });

        if (!tokenResponse?.ok) {
            const errorText = tokenResponse?.statusText || 'Unknown error';
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return false;
        }

        cookies = tokenResponse.headers.get('set-cookie');
        const tokenData = await tokenResponse.json();
        token = tokenData.query?.tokens?.logintoken;

        if (!token) {
            const errorText = 'No token received';
            if (errors.has(errorText))
                return;
            errors.add(errorText);

            dialog.showErrorBox(`Error fetching login token`, errorText);
            return false;
        }

        cachedLoginToken.token = token;
        cachedLoginToken.cookies = cookies;

        return await fetch('https://en.wikipedia.org/w/api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(cookies && { 'Cookie': cookies })
            },
            body: new URLSearchParams({
                action: 'login',
                lgname: username,
                lgpassword: password,
                lgtoken: token,
                format: 'json'
            }).toString()
        })
            .then(response => {
                userLoginCookies[username] = response.headers?.get('set-cookie') || null;

                return response.json();
            })
            .then(data => {
                if (data.login?.result === 'Success') {
                    return true;
                } else {
                    dialog.showErrorBox(`Error during login for ${username}`, data.login?.reason || 'Unknown error');
                    return false;
                }
            })
            .catch(error => {
                dialog.showErrorBox(`Error during login for ${username}`, error.message);
                return false;
            });
    }

    return loginResult;
}

if (process.platform === 'win32') {
    app.setAppUserModelId('com.wikishield.app');
}

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('wikishield', process.execPath, [path.resolve(process.argv[1])]);
    } else {
        app.setAsDefaultProtocolClient('wikishield');
    }
}

function SetActiveAccount(username) {
    global.accounts ??= { };

    const active = GetActiveAccount();
    if (global.accounts[active]) {
        global.accounts[active].active = false;
    }

    if (global.accounts[username]) {
        global.accounts[username].active = true;
        global.accounts[username].lastLogin = Date.now();
    }

    Save();

    AddAppMenuItems();

    if (loadedAccount !== username) {
        loadedAccount = username;
        if (windows.main)
            windows.main.reload();
    }
}

// Configure auto-updater (works on Windows, Mac, and Linux)
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
autoUpdater.autoDownload = true; // Automatically download updates
autoUpdater.autoInstallOnAppQuit = true;

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
    log.info('Checking for update...');
    log.info(`Current version: ${app.getVersion()}`);
});

autoUpdater.on('update-available', (info) => {
    log.info('Update available:', JSON.stringify(info));
    log.info(`Automatically downloading version ${info.version}...`);
    // Update will be downloaded automatically due to autoDownload = true
});

autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available. Current version is latest:', JSON.stringify(info));
});

autoUpdater.on('error', (err) => {
    log.error('Error in auto-updater:', err);
    // Don't show error dialog for network issues or no updates
    if (!err.message.includes('net::') && !err.message.includes('ENOTFOUND')) {
        dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
    }
});

autoUpdater.on('download-progress', (progressObj) => {
    let logMessage = 'Download speed: ' + progressObj.bytesPerSecond;
    logMessage = logMessage + ' - Downloaded ' + progressObj.percent + '%';
    logMessage = logMessage + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
    log.info(logMessage);
});

autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    log.info('Update will be installed when the application quits.');
    // Update will be installed automatically on next app quit due to autoInstallOnAppQuit = true
    // Show a non-intrusive notification to let the user know
    SendNotification({
        title: 'Update Ready',
        body: `WikiShield v${info.version} has been downloaded and will be installed when you close the app.`
    });
});

app.whenReady().then(async () => {
    log.info(`App ready - DEV mode: ${__DEV__}, Packaged: ${app.isPackaged}`);

    // Check if app-update.yml exists (only exists in production builds from electron-builder)
    const fs = require('fs');
    const appUpdateFile = path.join(process.resourcesPath, 'app-update.yml');
    const hasUpdateFile = fs.existsSync(appUpdateFile);

    log.info(`Auto-updater file check: ${appUpdateFile} exists: ${hasUpdateFile}`);

    if (!__DEV__ && app.isPackaged && hasUpdateFile) {
        log.info('Auto-updater enabled, will check for updates in 3 seconds...');

        // Check for updates after app is ready
        setTimeout(() => {
            log.info('Initiating update check...');
            log.info(`Update feed URL: ${autoUpdater.getFeedURL()}`);
            autoUpdater.checkForUpdates()
                .then(result => {
                    log.info('Update check result:', result);
                })
                .catch(err => {
                    log.error('Failed to check for updates:', err);
                    // Only show error dialog for non-network errors
                    if (!err.message.includes('net::') && !err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
                        dialog.showErrorBox('Update Error', `Failed to check for updates: ${err.message}`);
                    }
                });
        }, 3000);

        // Check for updates every 4 hours
        setInterval(() => {
            log.info('Periodic update check...');
            autoUpdater.checkForUpdates().catch(err => {
                log.error('Failed to check for updates:', err);
            });
        }, 4 * 60 * 60 * 1000);
    } else {
        log.info(`Auto-updater disabled - DEV: ${__DEV__}, Packaged: ${app.isPackaged}, Has update file: ${hasUpdateFile}`);
    }

    globalShortcut.register('escape', () => {
        if (windows.login && windows.login.isFocused()) {
            windows.login.close();
            windows.login = null;
        }
        if (windows.accounts && windows.accounts.isFocused()) {
            windows.accounts.close();
            windows.accounts = null;
        }
    });

    ipcMain.on('set-badge-count', async (event, count) => {
        if (process.platform === 'win32') {
            // Windows: Custom overlay icon
            if (!windows.main) return;

            try {
                if (count > 0) {
                    const overlayIcon = await createBadgeIcon(count);
                    if (overlayIcon && !overlayIcon.isEmpty()) {
                        windows.main.setOverlayIcon(overlayIcon, `${count} notifications`);
                    }
                } else {
                    windows.main.setOverlayIcon(null, '');
                }
            } catch (error) {
                log.error('Failed to set badge count:', error);
            }
        } else if (process.platform === 'darwin') {
            // macOS: Dock badge
            app.dock.setBadge(count > 0 ? count.toString() : '');
        } else {
            // Linux: App badge count
            app.setBadgeCount(count);
        }
    });

    ipcMain.on('open-external', (event, url) => {
        shell.openExternal(url);
    });

    ipcMain.handle('send-notification', async (event, options, click) => SendNotification(options, click));
    ipcMain.on('copy-to-clipboard', (event, text) => {
        clipboard.writeText(text);
    });
    ipcMain.handle('get-clipboard-text', async () => {
        return clipboard.readText();
    });

    ipcMain.handle('get-server', async () => {
        return server;
    });

    ipcMain.handle('get-active-account', async () => {
        const active = GetActiveAccount();
        return { username: active, password: global.accounts?.[active]?.password || null };
    });
    ipcMain.handle('load-accounts', async () => {
        return Object.entries(global.accounts || { }).sort((a, b) => b[1].lastLogin - a[1].lastLogin).map(([ username, account ]) => ({ username, ...account }));
    });

    ipcMain.on('save-account', async (event, account) => {
        global.accounts ??= { };

        const valid = await CheckAccountLogin(account.username, account.password);
        if (valid) {
            const active = global.accounts[GetActiveAccount()];
            if (active) active.active = false;
        }

        global.accounts[account.username] = {
            password: account.password,
            active: valid,
            valid: valid,
        };

        Save();

        if (windows.login) {
            windows.login.close();
            windows.login = null;
        }

        if (GetActiveAccount()) {
            if (windows.main) {
                windows.main.focus();
            } else {
                BuildMainWindow();
            }
        } else {
            BuildLoginWindow();
        }
    });
    ipcMain.on('set-active-account', async (event, username) => SetActiveAccount(username));
    ipcMain.on('delete-account', async (event, username) => {
        global.accounts ??= { };
        delete global.accounts[username];

        Save();
    });

    ipcMain.on('log', (event, message, level) => {
        log[level || 'info']?.(message);
    });
    ipcMain.on('error', (event, message, detail) => {
        dialog.showErrorBox(message, detail.toString());
    });

    let savePromise = [];
    ipcMain.on('save-account-data', async (event, username, data) => {
        savePromise = savePromise.filter(p => !p.isFulfilled);
        savePromise.push(CheckAccountLogin(username, global.accounts?.[username]?.password).then(async valid => {
            if (valid) {
                const crsf = await fetch(`https://${server}/w/api.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': userLoginCookies[username] || ''
                    },
                    body: new URLSearchParams({
                        action: 'query',
                        meta: 'tokens',
                        type: 'csrf',
                        format: 'json'
                    }).toString()
                }).then(response => response.json()).then(data => data.query?.tokens?.csrftoken);

                if (!crsf) {
                    log.error(`Failed to get CSRF token for saving account data for ${username}`);
                    return;
                }

                await fetch(`https://${server}/w/api.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': userLoginCookies[username] || ''
                    },
                    body: new URLSearchParams({
                        action: 'options',
                        optionname: "userjs-wikishield-storage",
                        optionvalue: data,
                        format: 'json',
                        token: crsf
                    }).toString()
                }).then(response => response.json()).then(result => {
                    if (result.options !== 'success')
                        log.error(`Failed to save account data for ${username}: ${JSON.stringify(result)}`);
                });
            } else {
                log.error(`Invalid login for ${username}, skipping save of account data`);
            }
        }));
    });

    app.on('before-quit', async (event) => {
        savePromise = savePromise.filter(p => !p.isFulfilled);
        if (savePromise.length > 0) {
            event.preventDefault();
            await Promise.allSettled(savePromise);
        }

        app.exit(0);
    });

    ipcMain.on('quit', () => {
        app.quit();
    });

    BuildTray();
    server = store.get('server') || "en.wikipedia.org";
    await LoadAccounts();
    if (Object.keys(global.accounts).length === 0)
        BuildLoginWindow();
    else
        BuildMainWindow();
});

if (process.platform === 'darwin') {
    app.on('open-url', (event, url) => {
        switch (url) {

        }
    });
} else {
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            switch (commandLine[commandLine.length - 1]) {
                default: {
                    // Placeholder for handling other protocol URLs
                } break;
            }
        });
    }
}

app.on('window-all-closed', () => {
    app.quit();
});