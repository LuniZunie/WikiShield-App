import electronInstaller from 'electron-winstaller';
import path from 'path';

try {
    await electronInstaller.createWindowsInstaller({
        appDirectory: path.join('./out/WikiShield-win32-x64'),
        outputDirectory: path.join('./build/installer'),
        authors: 'LuniZunie',
        exe: 'WikiShield.exe',
        setupExe: 'WikiShield-Setup.exe',
        setupIcon: path.join('./assets/icon.ico'),
        // Code signing configuration
        // To use code signing, you need a certificate (.pfx file)
        // certificateFile: './path/to/certificate.pfx',
        // certificatePassword: process.env.CERTIFICATE_PASSWORD,
        // Sign the installer
        signWithParams: process.env.CERTIFICATE_FILE
            ? `/f "${process.env.CERTIFICATE_FILE}" /p "${process.env.CERTIFICATE_PASSWORD}" /tr http://timestamp.digicert.com /td sha256 /fd sha256`
            : undefined,
        // Squirrel update configuration
        remoteReleases: process.env.UPDATE_SERVER_URL,
        // Don't create delta packages for now
        noDelta: false,
        // Setup icon for shortcuts
        loadingGif: path.join('./assets/icon.png'),
    });
    console.log('Installer created successfully!');
} catch (e) {
    console.error(`Error creating installer: ${e.message}`);
}