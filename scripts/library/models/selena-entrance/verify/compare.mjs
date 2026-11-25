// The camera of a clip against the game's recording: for each pair (clip time, recording time) a
// row of four pictures, the recording | ours (base colour, unlit) | ours over the recording at 50
// percent | the outline of ours on the recording.
//
//   node verify/compare.mjs SPEC.json        (one sheet; SPEC as `compare` takes it)
//
// Used while fitting (cameras/fits.json) and by the build's check for every clip with a recording.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fittedAt, readFits } from "../cameras.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { onGround, outline, overlay, raw, toPng } from "../lib/compose.mjs";
import { WORK, readJson, writeWhole } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";
import { frame } from "../lib/video.mjs";

const W = 480;
const H = 216;

let shared = null;
/** One stage for the whole run (the file is loaded once). */
export async function stageFor(file) {
  if (shared?.file === file) return shared;
  if (shared) await shared.stage.close();
  const stage = await openStage({ model: file });
  await stage.page.evaluate(async () => {
    await window.stage.load("m", "/file/model");
    window.stage.look("m", "unlit");
    window.stage.setBackground(null);
  });
  shared = { file, stage };
  return shared;
}
export async function closeStage() {
  if (shared) await shared.stage.close();
  shared = null;
}

/** Our render of `clip` at `t` through camera { p, q, vfov } as PNG bytes (transparent ground). */
export async function render(
  stage,
  clip,
  t,
  cam,
  { width = 960, height = 432, look = "unlit" } = {},
) {
  const url = await stage.page.evaluate(
    ({ clip, t, cam, width, height, look }) => {
      window.stage.look("m", look);
      window.stage.pose("m", clip, t);
      return window.stage.shot({ width, height, pos: cam.p, quaternion: cam.q, vfov: cam.vfov });
    },
    { clip, t, cam, width, height, look },
  );
  return pngBytes(url);
}

/**
 * spec: { clip, video, pairs: [[clipTime, videoTime], ...], fit (a fits.json entry; default the
 * file's own extras.cameras, or cameras/fits.json for a file without them), file (GLB; default
 * the work model), out }.
 */
export async function compare(spec) {
  const file = spec.file ?? path.join(WORK, "work", "model.glb");
  const { stage } = await stageFor(file);
  const bake = readJson(path.join(WORK, "work", "cameras.game.json"));
  const fit = spec.fit === undefined ? readFits().clips[spec.clip] : spec.fit;
  const tiles = [];
  for (const [ct, vt] of spec.pairs) {
    // The file's own cameras (extras.cameras) when the file has them: that is what ships.
    const shipped = await stage.page.evaluate(
      ({ clip, t }) => {
        const cams = window.stage.models.m.gltf.scene.userData?.cameras;
        const c = cams?.clips?.[clip];
        if (!c) return null;
        const T = window.stage.THREE;
        const n = c.keys.length / 8;
        const x = Math.max(0, Math.min(n - 1, t * cams.fps));
        const i = Math.floor(x);
        const j = Math.min(n - 1, i + 1);
        const f = x - i;
        const k = (a) => c.keys.slice(a * 8, a * 8 + 8);
        const A = k(i);
        const B = k(j);
        const q = new T.Quaternion(A[3], A[4], A[5], A[6]).slerp(
          new T.Quaternion(B[3], B[4], B[5], B[6]),
          f,
        );
        return {
          p: [0, 1, 2].map((m) => A[m] + (B[m] - A[m]) * f),
          q: q.toArray(),
          vfov: A[7] + (B[7] - A[7]) * f,
        };
      },
      { clip: spec.clip, t: ct },
    );
    const cam =
      spec.fit === undefined && shipped ? shipped : fittedAt(fit, bake.clips[spec.clip], ct);
    const ours = await raw(await render(stage, spec.clip, ct, cam), W, H);
    const label = `${spec.clip} ${ct.toFixed(2)} s`;
    if (spec.video) {
      const video = await raw(frame(spec.video, vt), W, H);
      tiles.push({ png: await toPng(video), label: `${spec.video}.mkv ${vt.toFixed(2)} s` });
      tiles.push({ png: await toPng(onGround(ours)), label: `ours: ${label}` });
      tiles.push({ png: await toPng(overlay(video, ours)), label: "50 percent" });
      tiles.push({ png: await toPng(outline(video, ours)), label: "our outline on the recording" });
    } else {
      tiles.push({ png: await toPng(onGround(ours)), label: `ours: ${label}` });
    }
  }
  const sheet = await contactSheet(tiles, {
    columns: spec.video ? 4 : Math.min(4, tiles.length),
    width: W,
    height: H,
  });
  if (spec.out) writeWhole(spec.out, sheet);
  return sheet;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const list = Array.isArray(spec) ? spec : [spec];
  for (const s of list) {
    await compare(s);
    console.log("wrote", s.out);
  }
  await closeStage();
}
