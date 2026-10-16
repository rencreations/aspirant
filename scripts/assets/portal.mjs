// Home "portal face" images: img/portal/{id}/base.webp, alt.webp, depth.webp (+ depth-alt.webp).
// Depth: Depth-Anything-V2-Small through scripts/assets/depth.py when DEPTH_PYTHON points at a venv with
// torch + transformers; otherwise a pseudo-depth built from the alpha silhouette and luminance.
import fsp from "node:fs/promises";
import path from "node:path";
import {
  CACHE,
  DEPTH_PYTHON,
  FORCE,
  REPO,
  TMP,
  ensureDirFor,
  exec,
  fileSize,
  getSharp,
  isFresh,
  log,
  mkdirp,
  pub,
  rel,
  saveStage,
  src,
  srcRel,
} from "./lib.mjs";

const W = 1100;
const H = 1375; // 4:5

/** Crop rectangles are in the pixel space of the published img/char/<slug>/cutout.webp (1800 px tall). */
const cutout = (slug, crop) => ({
  file: pub("img", "char", slug, "cutout.webp"),
  crop,
  alpha: true,
  label: `img/char/${slug}/cutout.webp`,
});

const PORTALS = {
  vexana: {
    pair: "guinevere-vexana",
    base: cutout("vexana", { left: 700, top: 0, width: 1100, height: 1375 }),
    alt: {
      // Ender form: vexana-mobile-wallpaper.jpg (1440x3200); face, hair and gauntlet at 4:5 around y 900 to 2700.
      file: pub("img", "char", "vexana", "extra-1.webp"),
      crop: { left: 0, top: 900, width: 1440, height: 1800 },
      alpha: false,
      label: "img/char/vexana/extra-1.webp (vexana-mobile-wallpaper.jpg)",
    },
    notes:
      "base: Aspirant-uniform pose (vexana-fighting-stance-transparent.png, cropped to a 4:5 portrait). alt: Ender-form portrait from vexana-mobile-wallpaper.jpg (blue-lavender hair, opaque background).",
  },
  "selena-obsidia": {
    pair: "selena-obsidia",
    base: cutout("selena", { left: 950, top: 20, width: 1100, height: 1375 }),
    alt: cutout("obsidia", { left: 350, top: 0, width: 1100, height: 1375 }),
    notes:
      "base: Selena (selena-transparent.png). alt: Obsidia (obsidia-transparent.png). Both are 4:5 portrait crops around the head and upper body, transparent background.",
  },
  "guinevere-vexana": {
    pair: "guinevere-vexana",
    base: cutout("guinevere", { left: 250, top: 0, width: 1100, height: 1375 }),
    alt: cutout("vexana", { left: 700, top: 0, width: 1100, height: 1375 }),
    notes:
      "base: Guinevere (guin-fighting-stance-transparent.png). alt: Vexana (vexana-fighting-stance-transparent.png). 4:5 crops, transparent background.",
  },
};

async function buildImage(spec, outWebp, tmpPng) {
  const sharp = await getSharp();
  // Crop from the published source, fit into W x H.
  const img = sharp(spec.file).extract(spec.crop).resize({ width: W, height: H, fit: "cover" });
  await img.clone().png().toFile(tmpPng);
  if (!isFresh(outWebp, spec.file)) {
    await ensureDirFor(outWebp);
    await img
      .clone()
      .webp(spec.alpha ? { quality: 86, alphaQuality: 92, effort: 5 } : { quality: 84, effort: 5 })
      .toFile(outWebp);
    return true;
  }
  return false;
}

/** Run a sharp pipeline and return one 8-bit channel as a flat buffer, whatever channel count sharp chose. */
async function gray(pipeline) {
  const { data, info } = await pipeline
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels === 1) return data;
  const out = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels];
  return out;
}

function percentile(arr, mask, p) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < arr.length; i++)
    if (!mask || mask[i] > 128) {
      hist[arr[i]]++;
      n++;
    }
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= n * p) return v;
  }
  return 255;
}

async function alphaOf(file) {
  const sharp = await getSharp();
  return sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer(); // single channel
}

/** model depth (near = white, raw PNG) -> smoothed, masked 8-bit map. */
async function refineDepth(rawPng, spec, outWebp, baseRgbaPng) {
  const sharp = await getSharp();
  const raw = await gray(sharp(rawPng));
  const mask = spec.alpha ? await alphaOf(baseRgbaPng) : null;
  const lo = percentile(raw, mask, 0.02);
  const hi = percentile(raw, mask, 0.98);
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const d = Math.min(1, Math.max(0, (raw[i] - lo) / Math.max(1, hi - lo)));
    out[i] = Math.round(255 * (0.12 + 0.88 * d));
  }
  let img = sharp(out, { raw: { width: W, height: H, channels: 1 } }).blur(2.5);
  if (spec.alpha) {
    const soft = await gray(sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(3));
    const d = await gray(img);
    const merged = Buffer.alloc(d.length);
    for (let i = 0; i < d.length; i++) merged[i] = Math.round((d[i] * soft[i]) / 255);
    img = sharp(merged, { raw: { width: W, height: H, channels: 1 } });
  }
  await img.webp({ quality: 90, effort: 5 }).toFile(outWebp);
}

/** Fallback when no depth model is available. */
async function pseudoDepth(spec, outWebp, rgbaPng) {
  const sharp = await getSharp();
  const alpha = spec.alpha ? await alphaOf(rgbaPng) : Buffer.alloc(W * H, 255);
  const a = sharp(alpha, { raw: { width: W, height: H, channels: 1 } });
  const big = await gray(a.clone().blur(40));
  const mid = await gray(a.clone().blur(10));
  const lum = await gray(sharp(rgbaPng).flatten({ background: "#808080" }).greyscale().blur(6));
  const out = Buffer.alloc(W * H);
  for (let i = 0; i < out.length; i++) {
    const d = 0.55 * (big[i] / 255) + 0.45 * (mid[i] / 255) * (0.55 + 0.45 * (lum[i] / 255));
    out[i] = Math.round(255 * Math.min(1, d) * (spec.alpha ? (alpha[i] / 255) * 0.15 + 0.85 : 1));
  }
  await sharp(out, { raw: { width: W, height: H, channels: 1 } })
    .blur(2)
    .webp({ quality: 90, effort: 5 })
    .toFile(outWebp);
}

export async function run() {
  const records = [];
  const notes = [];
  const tmpDir = path.join(TMP, "portal");
  await mkdirp(tmpDir);
  const jobs = []; // depth jobs still to run: {tmpPng, rawPng, spec, out}
  const useModel = !!DEPTH_PYTHON;

  for (const [id, p] of Object.entries(PORTALS)) {
    const dir = pub("img", "portal", id);
    for (const [role, spec] of [
      ["base", p.base],
      ["alt", p.alt],
    ]) {
      const out = path.join(dir, `${role}.webp`);
      const tmpPng = path.join(tmpDir, `${id}-${role}.png`);
      await buildImage(spec, out, tmpPng);
      // Depth input: transparent images are flattened on mid grey so the model sees a plain backdrop.
      const depthIn = path.join(tmpDir, `${id}-${role}-in.png`);
      const sharp = await getSharp();
      await sharp(tmpPng).flatten({ background: "#808080" }).png().toFile(depthIn);
      const depthOut = path.join(dir, role === "base" ? "depth.webp" : "depth-alt.webp");
      if (!isFresh(depthOut, out, path.join(REPO, "scripts", "assets", "portal.mjs"))) {
        jobs.push({
          id,
          role,
          tmpPng,
          depthIn,
          rawPng: path.join(tmpDir, `${id}-${role}-raw.png`),
          spec,
          out: depthOut,
        });
      }
      records.push({
        kind: "image",
        id: `portal-${id}-${role}`,
        path: rel(out),
        pair: p.pair,
        role: `portal-${role}`,
        source: spec.label,
        notes: p.notes,
        bytes: await fileSize(out),
        width: W,
        height: H,
      });
    }
  }

  let method = useModel
    ? "Depth-Anything-V2-Small (depth-anything/Depth-Anything-V2-Small-hf), CPU"
    : "pseudo-depth (alpha silhouette blur x luminance)";
  if (jobs.length && useModel) {
    log("portal", `depth model on ${jobs.length} images`);
    try {
      await exec(DEPTH_PYTHON, [
        path.join(REPO, "scripts", "assets", "depth.py"),
        ...jobs.flatMap((j) => [j.depthIn, j.rawPng]),
      ]);
    } catch (e) {
      log("portal", `depth model failed, using pseudo-depth: ${String(e.message).slice(0, 300)}`);
      method = "pseudo-depth (model run failed)";
      jobs.forEach((j) => (j.rawPng = null));
    }
  }
  for (const j of jobs) {
    if (j.rawPng) await refineDepth(j.rawPng, j.spec, j.out, j.tmpPng);
    else await pseudoDepth(j.spec, j.out, j.tmpPng);
  }
  if (!jobs.length) {
    // Nothing regenerated: keep the method recorded by the run that produced the files.
    try {
      const prev = JSON.parse(await fsp.readFile(path.join(CACHE, "portal.json"), "utf8"));
      const m = prev.notes
        ?.find((n) => n.about === "portal depth maps")
        ?.note?.replace(/^Method this run: /, "")
        .replace(/.$/, "");
      if (m) method = m;
    } catch {}
  }
  for (const [id, p] of Object.entries(PORTALS)) {
    for (const role of ["base", "alt"]) {
      const f = pub("img", "portal", id, role === "base" ? "depth.webp" : "depth-alt.webp");
      records.push({
        kind: "image",
        id: `portal-${id}-depth${role === "alt" ? "-alt" : ""}`,
        path: rel(f),
        pair: p.pair,
        role: role === "base" ? "portal-depth" : "portal-depth-alt",
        source: `portal-${id}-${role}`,
        notes: "8-bit grayscale, near = white, same size as the image it belongs to.",
        bytes: await fileSize(f),
        width: W,
        height: H,
      });
    }
  }
  notes.push({ about: "portal depth maps", note: `Method this run: ${method}.` });
  log("portal", `depth method: ${method}`);
  await saveStage(
    "portal",
    records.sort((a, b) => a.id.localeCompare(b.id)),
    { notes },
  );
}
