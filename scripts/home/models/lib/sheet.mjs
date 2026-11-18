// Contact sheets: pictures in a grid with a caption on each, written as one PNG.
import sharp from "sharp";

function escape(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * tiles: [{ png: Buffer, label: string }]. Each tile is drawn at `width` by `height` (the
 * pictures are scaled to fit, not cropped).
 */
export async function contactSheet(
  tiles,
  { columns = 3, width = 480, height = 360, background = "#20242b" } = {},
) {
  const rows = Math.ceil(tiles.length / columns);
  const label = 22;
  const cell = height + label;
  const composites = [];
  for (let i = 0; i < tiles.length; i++) {
    const x = (i % columns) * width;
    const y = Math.floor(i / columns) * cell;
    const picture = await sharp(tiles[i].png)
      .resize(width, height, { fit: "contain", background })
      .png()
      .toBuffer();
    composites.push({ input: picture, left: x, top: y + label });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${label}"><rect width="100%" height="100%" fill="#101216"/><text x="6" y="16" font-family="Consolas, monospace" font-size="13" fill="#ffd866">${escape(tiles[i].label)}</text></svg>`;
    composites.push({ input: Buffer.from(svg), left: x, top: y });
  }
  return sharp({
    create: { width: width * columns, height: cell * rows, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer();
}
