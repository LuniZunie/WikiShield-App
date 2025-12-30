const electronInstaller = require('electron-winstaller');
const path = require('path');

(async () => {
    try {
        await electronInstaller.createWindowsInstaller({
        appDirectory: path.join('./out/WikiShield-win32-x64'),
        outputDirectory: path.join('./build/installer'),
        authors: 'LuniZunie',
        exe: 'WikiShield.exe',
        setupExe: 'WikiShield-Setup.exe',
        setupIcon: path.join('./assets/icon.ico'),
        signWithParams: process.env.CERTIFICATE_FILE
            ? `/f "${process.env.CERTIFICATE_FILE}" /p "${process.env.CERTIFICATE_PASSWORD}" /tr http://timestamp.digicert.com /td sha256 /fd sha256`
            : undefined,
        remoteReleases: process.env.UPDATE_SERVER_URL,
        noDelta: false,
        loadingGif: path.join('./assets/icon.png'),
    });
    console.log('Installer created successfully!');
    } catch (e) {
        console.error(`Error creating installer: ${e.message}`);
    }
})();