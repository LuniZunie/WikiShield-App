const { nativeImage } = require("electron/main");
const Logger = require("electron-log");

const size = 16;
async function CreateBadgeIcon(frame, count) {
    if (!frame || frame.isDestroyed())
        return null;
    if (count <= 0 || !Number.isInteger(count))
        return null;

    const text = count > 99 ? '99+' : String(count);
    try {
        const dataUrl = await frame.webContents.executeJavaScript(`
            (() => {
                try {
                    const paper = document.createElement('canvas');
                    paper.width = ${size};
                    paper.height = ${size};

                    const pen = paper.getContext('2d');
                    pen.imageSmoothingEnabled = true;
                    pen.imageSmoothingQuality = 'high';

                    // radial gradient for more depth
                    const bgGradient = pen.createRadialGradient(${size} / 2, ${size} / 2 - 1, 0, ${size} / 2, ${size} / 2, ${size} / 2);
                    bgGradient.addColorStop(0, "rgba(139, 92, 246, 1)");
                    bgGradient.addColorStop(0.6, "rgba(168, 85, 247, 1)");
                    bgGradient.addColorStop(1, "rgba(236, 72, 153, 1)");

                    // drop shadow
                    pen.shadowColor = "rgba(0, 0, 0, 0.4)";
                    pen.shadowBlur = 3;
                    pen.shadowOffsetY = 1.5;
                    pen.fillStyle = bgGradient;

                    // draw main circle with shadow
                    pen.beginPath();
                    pen.arc(${size} / 2, ${size} / 2, ${size} / 2 - 1, 0, 2 * Math.PI);
                    pen.fill();

                    // outer rim highlight
                    pen.shadowColor = "transparent";
                    pen.shadowBlur = 0;
                    pen.strokeStyle = "rgba(255, 255, 255, 0.35)";
                    pen.lineWidth = 1;
                    pen.beginPath();
                    pen.arc(${size} / 2, ${size} / 2, ${size} / 2 - 1.5, 0, 2 * Math.PI);
                    pen.stroke();

                    // inner light gradient for shine
                    const shine = pen.createRadialGradient(${size} / 2 - 2, ${size} / 2 - 2, 0, ${size} / 2, ${size} / 2, ${size} / 2);
                    shine.addColorStop(0, "rgba(255, 255, 255, 0.5)");
                    shine.addColorStop(0.4, "rgba(255, 255, 255, 0.1)");
                    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
                    pen.fillStyle = shine;

                    pen.beginPath();
                    pen.arc(${size} / 2, ${size} / 2, ${size} / 2 - 1.5, 0, 2 * Math.PI);
                    pen.fill();

                    // text rendering
                    pen.shadowColor = "rgba(0, 0, 0, 0.5)";
                    pen.shadowBlur = 1.5;
                    pen.shadowOffsetY = 0.5;
                    pen.fillStyle = "rgba(255, 255, 255, 1)";
                    pen.font = "bold ${text.length > 2 ? 8 : 10}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                    pen.textAlign = "center";
                    pen.textBaseline = "middle";
                    pen.fillText("${text}", ${size} / 2, ${size} / 2);

                    return paper.toDataURL("image/png");
                } catch (err) { return \`error:\${err.message}\`; }
            })();
        `);

        if (typeof dataUrl !== "string")
            return null;
        else if (dataUrl.startsWith("error:"))
            throw new Error(`Badge icon generation error: ${dataUrl.slice(6)}`);

        const image = nativeImage.createFromDataURL(dataUrl);
        if (image.isEmpty())
            return null;

        return image.resize({ width: size, height: size });
    } catch (err) {
        Logger.error(err);
        return null;
    }
}

module.exports = { CreateBadgeIcon };