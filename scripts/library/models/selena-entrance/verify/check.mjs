// The finished file, loaded as the room loads it (the site's three, GLTFLoader, meshopt):
// - it loads, has the 14 clips by their ids and the extras the room reads;
// - the clips still move as the owner's file does: every kept bone's world position at five
//   times of each clip against the owner's GLB at the same moment (its keys start 1/24 s later);
// - a sheet of each clip at four times from one fixed three quarter camera (clips-*.png);
// - the camera sheets (cameras-<clip>.png: the recording | ours | 50 percent | our outline) for
//   every clip with a recording, at six times, and the sticker views.
//
//   node verify/check.mjs [--file GLB]
import fs from "node:fs";
import path from "node:path";
import { CLIPS } from "../clips.mjs";
import { readFits } from "../cameras.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { OUT_FILE, SOURCE_GLB, WORK, fail, option, writeWhole } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";
import { closeStage, compare } from "./compare.mjs";
import { stickerViews } from "./sticker.mjs";

/** Fixed three quarter view for the clip sheets (front left, a little above, wide enough for Silverbolt). */
const VIEW = { pos: [-1.9, 1.75, 2.7], target: [0, 1.0, 0], vfov: 50 };
/** Bone positions may differ by this much from the owner's file (quantisation, resampling). */
const LIMIT = 0.006;

export async function check({ file = OUT_FILE, report } = {}) {
  const out = WORK;
  const stage = await openStage({ model: file, source: SOURCE_GLB });
  const { page } = stage;
  const summary = { file, bytes: fs.statSync(file).size, clips: {}, worstBone: 0 };
  try {
    const info = await page.evaluate(async () => {
      const a = await window.stage.load("m", "/file/model");
      const b = await window.stage.load("src", "/file/source");
      window.stage.show("src", false);
      return { a, b: { clips: b.clips.map((c) => c[0]) } };
    });
    const ids = info.a.clips.map((c) => c[0]);
    for (const c of CLIPS) if (!ids.includes(c.id)) fail(`clip ${c.id} missing`);
    if (ids.length !== CLIPS.length) fail(`${ids.length} clips, expected ${CLIPS.length}`);
    const extras = info.a.extras;
    if (!extras.cameras || !extras.sticker) fail("extras.cameras or extras.sticker missing");
    if (!info.a.boneNames.includes(extras.sticker.bone)) fail(`no bone ${extras.sticker.bone}`);
    summary.meshes = info.a.meshes.map((m) => m[0]);
    summary.bones = info.a.bones;
    for (const [id, duration] of info.a.clips) {
      const cam = extras.cameras.clips[id];
      const frames = Math.round(duration * extras.cameras.fps) + 1;
      if (!cam || cam.frames !== frames || cam.keys.length !== frames * 8)
        fail(`${id}: ${cam?.frames} camera keys, expected ${frames}`);
      // bones against the owner's file
      const source = CLIPS.find((c) => c.id === id);
      const rows = await page.evaluate(
        ({ id, src, duration }) => {
          const S = window.stage;
          const out = [];
          for (const f of [0, 0.25, 0.5, 0.75, 1]) {
            const t = duration * f;
            S.pose("m", id, t);
            S.pose("src", src, t + 1 / 24);
            const a = S.boneWorld("m");
            const b = S.boneWorld("src");
            let worst = 0;
            let name = "";
            for (const [n, p] of Object.entries(a)) {
              const q = b[n];
              if (!q) continue;
              const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
              if (d > worst) {
                worst = d;
                name = n;
              }
            }
            out.push({ t, worst, name, compared: Object.keys(a).filter((n) => b[n]).length });
          }
          return out;
        },
        { id, src: `selena_silverbolt_raiko_entrance_${source.action}`, duration },
      );
      const worst = rows.reduce((a, r) => (r.worst > a.worst ? r : a), rows[0]);
      summary.clips[id] = {
        seconds: Math.round(duration * 1e4) / 1e4,
        cameraKeys: cam.frames,
        worstBoneMm: Math.round(worst.worst * 1e4) / 10,
        worstBone: worst.name,
        bonesCompared: worst.compared,
      };
      summary.worstBone = Math.max(summary.worstBone, worst.worst);
      if (worst.worst > LIMIT)
        fail(`${id}: ${worst.name} is ${worst.worst} m from the owner's file`);
    }
    // the clip sheets from one fixed camera
    await page.evaluate(() => {
      window.stage.look("m", "unlit");
      window.stage.setBackground(0xeceef2);
    });
    const tiles = [];
    const length = Object.fromEntries(info.a.clips);
    for (const { id } of CLIPS) {
      const duration = length[id];
      for (const f of [0, 1 / 3, 2 / 3, 1]) {
        const t = duration * f;
        const png = await page.evaluate(
          ({ id, t, VIEW }) => {
            window.stage.pose("m", id, t);
            return window.stage.shot({
              width: 640,
              height: 400,
              pos: VIEW.pos,
              target: VIEW.target,
              vfov: VIEW.vfov,
            });
          },
          { id, t, VIEW },
        );
        tiles.push({ png: pngBytes(png), label: `${id} ${t.toFixed(2)} s` });
      }
    }
    for (let s = 0; s * 28 < tiles.length; s++) {
      writeWhole(
        path.join(out, `clips-${s + 1}.png`),
        await contactSheet(tiles.slice(s * 28, s * 28 + 28), {
          columns: 4,
          width: 400,
          height: 250,
        }),
      );
    }
  } finally {
    await stage.close();
  }
  // camera sheets: six times of each clip with a recording
  const fits = readFits();
  const durations = Object.fromEntries(
    Object.entries(summary.clips).map(([id, c]) => [id, c.seconds]),
  );
  for (const [id, fit] of Object.entries(fits.clips)) {
    if (!fit.video || fit.offset === undefined) continue;
    const d = durations[id];
    const pairs = [0.02, 0.2, 0.4, 0.6, 0.8, 0.98].map((f) => {
      const t = Math.round(d * f * 1000) / 1000;
      return [t, Math.round((t + fit.offset) * 1000) / 1000];
    });
    await compare({
      clip: id,
      video: fit.video,
      pairs,
      file,
      out: path.join(out, `cameras-${id}.png`),
    });
  }
  await closeStage();
  summary.sticker = await stickerViews({ file, out: path.join(out, "sticker-views.png") });
  writeWhole(path.join(out, "check.json"), JSON.stringify({ ...summary, report }, null, 2));
  console.log(JSON.stringify(summary, null, 1));
  return summary;
}

if (process.argv[1] && path.basename(process.argv[1]) === "check.mjs") {
  await check({ file: option("file", OUT_FILE) });
}
