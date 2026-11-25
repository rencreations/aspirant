// Small edits of the effect pictures, done on raw pixels with sharp.
import sharp from "sharp";

async function raw(bytes) {
  const { data, info } = await sharp(Buffer.from(bytes))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

function png(data, info) {
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Fills the colour under the clear pixels of a cut-out picture with the mean colour of the
 * visible ones, so filtering and WebP never bleed the hidden ground (magenta here) into the edges.
 */
export async function bleedClear(bytes, below = 8) {
  const { data, info } = await raw(bytes);
  const sum = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    for (let k = 0; k < 3; k++) sum[k] += data[i + k] * a;
    weight += a;
  }
  const mean = sum.map((s) => Math.round(s / Math.max(weight, 1e-6)));
  let filled = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] >= below) continue;
    data[i] = mean[0];
    data[i + 1] = mean[1];
    data[i + 2] = mean[2];
    filled++;
  }
  return { png: await png(data, info), mean, filled };
}
