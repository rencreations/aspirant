// Samples clips of the sources frame by frame in Chrome (the site's three): the pelvis, the head,
// the feet and the skinned box of the whole form. Writes probe/clips-<form>.json and prints a
// table of the clips named on the command line (default: the four transform clips).
// Usage: node probe-clips.mjs [clip substring ...]
import fs from "node:fs";
import path from "node:path";
import { ABYSSAL_GLB, NORMAL_GLB, workDir } from "../lib/env.mjs";
import { openStage } from "../lib/browser.mjs";

const want = process.argv.slice(2);
const out = workDir("probe");
const stage = await openStage({ "normal.glb": NORMAL_GLB, "abyssal.glb": ABYSSAL_GLB });
const { page } = stage;
const NODES = ["Bip001 Pelvis", "Bip001 Head", "Bip001 L Foot", "Bip001 R Foot"];
try {
  for (const form of ["normal", "abyssal"]) {
    const info = await page.evaluate((f) => window.stage.load(f, `/file/${f}.glb`), form);
    const result = {};
    for (const [clip, duration] of info.clips) {
      const frames = Math.round(duration * 30) + 1;
      result[clip] = await page.evaluate(
        ([f, c, n, nodes]) => {
          const rows = [];
          for (let i = 0; i < n; i++) {
            const t = i / 30;
            window.stage.pose(f, c, t);
            const w = window.stage.world(f, nodes);
            const q = window.stage.worldQuat(f, ["Bip001 Pelvis"]);
            rows.push({ t, box: window.stage.box(f), w, q: q["Bip001 Pelvis"] });
          }
          return rows;
        },
        [form, clip, frames, NODES],
      );
    }
    fs.writeFileSync(path.join(out, `clips-${form}.json`), JSON.stringify(result));
    const table = (want.length ? want : ["skill3"]).flatMap((w) =>
      Object.keys(result).filter((c) => c.includes(w)),
    );
    for (const clip of table) {
      console.log(`\n== ${form} ${clip}`);
      for (const r of result[clip]) {
        const p = r.w["Bip001 Pelvis"].map((x) => x.toFixed(3));
        const h = r.w["Bip001 Head"].map((x) => x.toFixed(3));
        const b = r.box;
        console.log(
          r.t.toFixed(3),
          "pelvis",
          p.join(" "),
          "head",
          h.join(" "),
          "box y",
          b.min[1].toFixed(3),
          b.max[1].toFixed(3),
          "x",
          b.min[0].toFixed(2),
          b.max[0].toFixed(2),
          "z",
          b.min[2].toFixed(2),
          b.max[2].toFixed(2),
        );
      }
    }
  }
} finally {
  await stage.close();
}
