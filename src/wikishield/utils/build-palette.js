export function BuildPalette(steps, ...colors) {
    const paper = document.createElement("canvas");
    paper.width = steps;
    paper.height = 1;

    const pen = paper.getContext("2d");

    const gradient = pen.createLinearGradient(0, 0, paper.width, 0);
    const step = 1 / (colors.length - 1);
    colors.forEach((color, index) => {
        gradient.addColorStop(step * index, color);
    });

    pen.fillStyle = gradient;
    pen.fillRect(0, 0, paper.width, paper.height);

    const data = pen.getImageData(0, 0, paper.width, 1).data;
    return Array.from({ length: steps }, (_, i) => {
        const offset = i * 4;
        return `rgb(${data[offset]}, ${data[offset + 1]}, ${data[offset + 2]})`;
    });
}