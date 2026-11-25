// The numbers behind the form change. For each change (first clip on one form, second clip on the
// other) it samples both clips at 1/120 s in Chrome with the site's three and compares the world
// positions of the 18 Biped joints the two skeletons share, for every pair of times (t in the
// first clip, s in the second). Prints the best pairs and writes probe/forms-<change>.json.
//
// Usage: node analyse-forms.mjs [file.glb]
//   With no file it reads the two source files (the abyssal clips start at 1/30 s there, so
//   their times are shifted to start at 0, as the build does). With a built file it reads the
//   clips by their ids.
import fs from "node:fs";
import path from "node:path";
import { ABYSSAL_GLB, NORMAL_GLB, workDir } from "../lib/env.mjs";
import { openStage } from "../lib/browser.mjs";

export const SHARED = [
  "Bip001 Pelvis",
  "Bip001 Spine",
  "Bip001 Spine1",
  "Bip001 Head",
  ...["L", "R"].flatMap((s) =>
    ["Thigh", "Calf", "Foot", "UpperArm", "Forearm", "Hand", "Finger0"].map(
      (b) => `Bip001 ${s} ${b}`,
    ),
  ),
];

const built = process.argv[2];
const SRC = "selena_silverbolt_raiko_in_game_";
const CHANGES = built
  ? {
      toAbyssal: {
        first: ["m", "normal/to-abyssal", 0],
        second: ["m", "abyssal/from-normal", 0],
        roots: ["normal", "abyssal"],
      },
      toNormal: {
        first: ["m", "abyssal/to-normal", 0],
        second: ["m", "normal/from-abyssal", 0],
        roots: ["abyssal", "normal"],
      },
    }
  : {
      toAbyssal: {
        first: ["normal", `${SRC}skill3_1`, 0],
        second: ["abyssal", `${SRC}in_game_abyssal_form_skill3_2`, 1 / 30],
      },
      toNormal: {
        first: ["abyssal", `${SRC}in_game_abyssal_form_skill3`, 1 / 30],
        second: ["normal", `${SRC}skill3_2`, 0],
      },
    };

const out = workDir("probe");
const files = built ? { "m.glb": built } : { "normal.glb": NORMAL_GLB, "abyssal.glb": ABYSSAL_GLB };
const stage = await openStage(files);
const { page } = stage;
try {
  const durations = {};
  for (const name of Object.keys(files).map((f) => f.replace(".glb", ""))) {
    const info = await page.evaluate((n) => window.stage.load(n, `/file/${n}.glb`), name);
    for (const [clip, d] of info.clips) durations[`${name}|${clip}`] = d;
  }
  /** Samples one clip: world positions of the shared joints under `root` (a node name or the model). */
  const sample = async ([model, clip, offset], root) => {
    const duration = durations[`${model}|${clip}`];
    return page.evaluate(
      ([m, c, off, dur, joints, r]) => {
        const S = window.stage;
        const M = S.models[m];
        const T = S.THREE;
        const base = r ? M.root.getObjectByName(r) : M.root;
        // By the source name inside this form: three renames the second form's copies (`_1`).
        const find = (n) => {
          let hit = null;
          base.traverse((o) => {
            if (!hit && o.userData.name === n) hit = o;
          });
          return hit;
        };
        const nodes = joints.map(find);
        const rows = [];
        for (let i = 0; i * (1 / 120) <= dur - off + 1e-6; i++) {
          const t = i / 120;
          S.pose(m, c, t + off);
          rows.push({
            t,
            p: nodes.map((o) => o.getWorldPosition(new T.Vector3()).toArray()),
          });
        }
        return rows;
      },
      [model, clip, offset, duration, SHARED, root ?? null],
    );
  };
  const report = {};
  for (const [name, change] of Object.entries(CHANGES)) {
    const A = await sample(change.first, change.roots?.[0]);
    const B = await sample(change.second, change.roots?.[1]);
    const pelvisY = (row) => row.p[0][1];
    // Where the first form leaves: the first sample whose pelvis is far under the ground.
    const gone = A.find((row) => pelvisY(row) < -0.2);
    const pairs = [];
    for (const a of A) {
      if (gone && a.t >= gone.t - 1e-9) break;
      for (const b of B) {
        let sum = 0;
        for (let j = 0; j < SHARED.length; j++) {
          const d = a.p[j].map((x, k) => x - b.p[j][k]);
          sum += d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
        }
        pairs.push({ t: a.t, s: b.t, rms: Math.sqrt(sum / SHARED.length) });
      }
    }
    pairs.sort((x, y) => x.rms - y.rms);
    // The best s for every t (on the 1/30 s grid), to read the shape of the match.
    const byT = [];
    for (const a of A.filter((row) => Math.abs(row.t * 30 - Math.round(row.t * 30)) < 1e-6)) {
      if (gone && a.t >= gone.t - 1e-9) break;
      const best = pairs.find((p) => Math.abs(p.t - a.t) < 1e-9);
      byT.push({
        t: +a.t.toFixed(4),
        pelvis: a.p[0].map((x) => +x.toFixed(3)),
        bestS: best && +best.s.toFixed(4),
        rms: best && +best.rms.toFixed(4),
      });
    }
    report[name] = {
      gone: gone ? +gone.t.toFixed(4) : null,
      firstDuration: A.at(-1).t,
      secondDuration: B.at(-1).t,
      best: pairs.slice(0, 12).map((p) => ({
        t: +p.t.toFixed(4),
        s: +p.s.toFixed(4),
        rms: +p.rms.toFixed(4),
      })),
      byT,
      secondPelvis: B.filter((_, i) => i % 4 === 0).map((b) => [
        +b.t.toFixed(3),
        ...b.p[0].map((x) => +x.toFixed(3)),
      ]),
    };
    console.log(`\n== ${name}: first leaves at ${report[name].gone}`);
    console.log("best pairs", JSON.stringify(report[name].best));
    for (const row of byT) console.log(JSON.stringify(row));
  }
  fs.writeFileSync(
    path.join(out, `forms-${built ? "built" : "sources"}.json`),
    JSON.stringify(report, null, 1),
  );
} finally {
  await stage.close();
}
