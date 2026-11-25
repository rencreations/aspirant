// The bunny's picture. The source shares one 1024 by 1024 picture with Chang'e's weapon; the bunny
// uses a band of it. This crops that band, keeps every texel a kept triangle covers exactly as it
// was, carries the edge colours a few texels out (so a smaller mip level does not bleed the dark
// ground into the paint) and makes the rest one flat colour: nothing of the weapon's paint ships.

/** Texels the paint is carried out past the triangles, for the mip levels. */
export const BLEED = 6;
/** The colour of every texel no triangle uses. */
export const BLANK = [24, 24, 32];
const PAD = BLEED + 2;

/** The texel a UV (three's, v up) falls on, in the source picture. */
export const texel = (uv, size) => [uv[0] * size, (1 - uv[1]) * size];

/**
 * `uvTris`: every kept triangle as three UVs (three's, v up). Returns the cropped picture (a
 * canvas), its place in the source and a function from a source UV to the UV of the cropped
 * picture (glTF's, v down, as the file stores it).
 */
export function cropPaint(image, uvTris) {
  const size = image.naturalWidth ?? image.width;
  if ((image.naturalHeight ?? image.height) !== size) throw new Error("the picture is not square");
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const tri of uvTris) {
    for (const uv of tri) {
      const [x, y] = texel(uv, size);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  const left = Math.max(0, Math.floor(x0) - PAD);
  const top = Math.max(0, Math.floor(y0) - PAD);
  const right = Math.min(size, Math.ceil(x1) + PAD);
  const bottom = Math.min(size, Math.ceil(y1) + PAD);
  const w = right - left;
  const h = bottom - top;

  // The source band.
  const source = document.createElement("canvas");
  source.width = w;
  source.height = h;
  const sx = source.getContext("2d", { willReadFrequently: true });
  sx.drawImage(image, left, top, w, h, 0, 0, w, h);
  const src = sx.getImageData(0, 0, w, h).data;

  // The texels the triangles touch: each triangle drawn with a one texel rim, so a texel that a
  // triangle only grazes (and the sampler blends in) counts as used.
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mx = mask.getContext("2d", { willReadFrequently: true });
  mx.fillStyle = "#fff";
  mx.strokeStyle = "#fff";
  mx.lineWidth = 2;
  mx.lineJoin = "round";
  for (const tri of uvTris) {
    mx.beginPath();
    tri.forEach((uv, k) => {
      const [x, y] = texel(uv, size);
      if (k === 0) mx.moveTo(x - left, y - top);
      else mx.lineTo(x - left, y - top);
    });
    mx.closePath();
    mx.fill();
    mx.stroke();
  }
  const on = mx.getImageData(0, 0, w, h).data;
  const used = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) used[i] = on[i * 4 + 3] > 0 ? 1 : 0;

  // Out from the used texels, ring by ring: each new texel takes the mean of its used or already
  // carried neighbours.
  const out = new Uint8ClampedArray(w * h * 4);
  const done = used.slice();
  for (let i = 0; i < w * h; i++) {
    for (let c = 0; c < 4; c++) out[i * 4 + c] = used[i] ? src[i * 4 + c] : c === 3 ? 255 : 0;
  }
  for (let ring = 0; ring < BLEED; ring++) {
    const add = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (done[i]) continue;
        let n = 0;
        const sum = [0, 0, 0];
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (!done[j]) continue;
          n++;
          for (let c = 0; c < 3; c++) sum[c] += out[j * 4 + c];
        }
        if (n > 0) add.push([i, sum.map((s) => Math.round(s / n))]);
      }
    }
    for (const [i, rgb] of add) {
      done[i] = 1;
      out[i * 4] = rgb[0];
      out[i * 4 + 1] = rgb[1];
      out[i * 4 + 2] = rgb[2];
    }
  }
  let blank = 0;
  for (let i = 0; i < w * h; i++) {
    if (done[i]) continue;
    out[i * 4] = BLANK[0];
    out[i * 4 + 1] = BLANK[1];
    out[i * 4 + 2] = BLANK[2];
    blank++;
  }
  // The proof: a used texel is the source's, an unused one past the bleed is blank.
  let changed = 0;
  let usedCount = 0;
  for (let i = 0; i < w * h; i++) {
    if (!used[i]) continue;
    usedCount++;
    for (let c = 0; c < 3; c++) if (out[i * 4 + c] !== src[i * 4 + c]) changed++;
    if (src[i * 4 + 3] !== 255) changed++;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);

  return {
    canvas,
    used,
    report: {
      sourceSize: size,
      crop: { left, top, width: w, height: h },
      usedTexels: usedCount,
      blankTexels: blank,
      changedUsedTexels: changed,
    },
    /** A source UV (three's, v up) to the UV the file stores (glTF's, v down, on the crop). */
    remap: (uv) => {
      const [x, y] = texel(uv, size);
      return [(x - left) / w, (y - top) / h];
    },
  };
}

/** The colour of the source picture under a UV (three's, v up), for the checks. */
export function sample(image, uv) {
  const size = image.naturalWidth ?? image.width;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d", { willReadFrequently: true });
  const [px, py] = texel(uv, size);
  x.drawImage(image, Math.floor(px), Math.floor(py), 1, 1, 0, 0, 1, 1);
  return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
