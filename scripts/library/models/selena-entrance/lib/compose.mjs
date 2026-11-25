// Pictures for the camera checks: the recording, our render, the two laid over each other.
import sharp from "sharp";

/** RGBA pixels of a PNG at w by h (stretched to that size). */
export async function raw(png, w, h) {
  const data = await sharp(png).resize(w, h, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  return { data, w, h };
}

export function toPng({ data, w, h }) {
  return sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
}

/** Our render over the recording at `opacity` where ours is drawn (alpha), the recording elsewhere. */
export function overlay(video, ours, opacity = 0.5) {
  const out = Buffer.from(video.data);
  for (let i = 0; i < out.length; i += 4) {
    const a = (ours.data[i + 3] / 255) * opacity;
    for (let k = 0; k < 3; k++)
      out[i + k] = Math.round(video.data[i + k] * (1 - a) + ours.data[i + k] * a);
    out[i + 3] = 255;
  }
  return { data: out, w: video.w, h: video.h };
}

/** The recording, darkened a little, with the outline of our silhouette drawn on it. */
export function outline(video, ours, color = [0, 255, 255]) {
  const { w, h } = video;
  const out = Buffer.from(video.data);
  const inside = (x, y) => ours.data[(y * w + x) * 4 + 3] > 127;
  for (let i = 0; i < out.length; i += 4) {
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(out[i + k] * 0.8);
    out[i + 3] = 255;
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = inside(x, y);
      if (!c) continue;
      if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;
      const i = (y * w + x) * 4;
      out[i] = color[0];
      out[i + 1] = color[1];
      out[i + 2] = color[2];
    }
  }
  return { data: out, w, h };
}

/** Our render on a flat light ground (the room's look for the sheet). */
export function onGround(ours, ground = [236, 238, 242]) {
  const out = Buffer.alloc(ours.data.length);
  for (let i = 0; i < out.length; i += 4) {
    const a = ours.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(ground[k] * (1 - a) + ours.data[i + k] * a);
    out[i + 3] = 255;
  }
  return { data: out, w: ours.w, h: ours.h };
}
