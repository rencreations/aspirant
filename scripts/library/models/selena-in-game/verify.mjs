// Checks the finished files in real Chrome with the site's three (GLTFLoader and the meshopt
// decoder, as the room loads them) and draws the pictures to read. Stops on a failed check.
//   node scripts/library/models/selena-in-game/verify.mjs            the mirror files
//   node scripts/library/models/selena-in-game/verify.mjs --dir D    another folder
// Writes into the work folder: verify.json (the numbers), materials.png, phone.png and
// silverbolt.png. The frame sheets of the form change are sheets.mjs.
import fs from "node:fs";
import path from "node:path";
import { OUT, WORK } from "./lib/env.mjs";
import { openStage, pngBytes } from "./lib/browser.mjs";
import { contactSheet } from "./lib/sheet.mjs";
import { renderFrames } from "./lib/frames.mjs";
import { ABYSSAL_CLIPS, NORMAL_CLIPS } from "./config.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const dir = arg("dir", OUT);
const file = path.join(dir, "selena-in-game.glb");
const entries = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, "..", "entries.json"), "utf8"),
);
const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

const stage = await openStage({ "m.glb": file });
const { page } = stage;
const result = {};
try {
  const info = await page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  const d = Object.fromEntries(info.clips.map(([n, dur]) => [n, dur]));
  const forms = info.extras.forms;

  // 1. The clips: every id the room lists, the four transform clips, nothing else.
  const listed = entries.entries
    .find((e) => e.slug === "selena")
    .views.find((v) => v.id === "selena-in-game")
    .forms.flatMap((f) => f.clips.map(([id]) => id));
  const expected = [...NORMAL_CLIPS, ...ABYSSAL_CLIPS].map(([id]) => id);
  for (const id of listed) check(id in d, `entries.json clip ${id} is in the file`);
  check(
    info.clips.length === expected.length,
    `${info.clips.length} clips (expected ${expected.length})`,
  );
  check(
    Object.keys(d).every((id) => expected.includes(id)),
    "no clip outside the table",
  );
  check(info.top.join(",") === "normal,abyssal", `two roots: ${info.top.join(", ")}`);
  for (const key of ["toAbyssal", "toNormal"]) {
    const c = forms?.[key];
    check(!!c, `extras.forms.${key} present`);
    if (!c) continue;
    check(
      c.hideAt <= d[c.first],
      `${key}: hideAt ${c.hideAt} is within ${c.first} (${d[c.first]})`,
    );
    check(
      c.secondFrom < d[c.second],
      `${key}: secondFrom ${c.secondFrom} is within ${c.second} (${d[c.second]})`,
    );
  }

  // 2. Each form at rest and through its idle: on the ground, near the origin, facing +Z.
  const measure = (form, clip, t) =>
    page.evaluate(
      ([f, c, time]) => {
        const S = window.stage;
        const M = S.models.m;
        const T = S.THREE;
        const roots = {
          normal: M.root.getObjectByName("normal"),
          abyssal: M.root.getObjectByName("abyssal"),
        };
        M.mixers ??= {
          normal: new T.AnimationMixer(roots.normal),
          abyssal: new T.AnimationMixer(roots.abyssal),
        };
        for (const k of ["normal", "abyssal"]) {
          roots[k].visible = k === f;
          M.mixers[k].stopAllAction();
        }
        if (c) {
          const a = M.mixers[f].clipAction(M.clips[c], roots[f]);
          a.setLoop(T.LoopOnce, 1);
          a.clampWhenFinished = true;
          a.reset().play();
          a.time = time;
          M.mixers[f].update(0);
        }
        M.root.updateMatrixWorld(true);
        // Joints by their source name inside this form (three renames the second form's copies).
        const joint = (n) => {
          let hit = null;
          roots[f].traverse((o) => {
            if (!hit && o.userData.name === n) hit = o;
          });
          return hit.getWorldPosition(new T.Vector3());
        };
        const box = S.box("m", f);
        const pelvis = joint("Bip001 Pelvis");
        const head = joint("Bip001 Head");
        const left = joint("Bip001 L Thigh").add(joint("Bip001 L UpperArm"));
        const right = joint("Bip001 R Thigh").add(joint("Bip001 R UpperArm"));
        const across = left.sub(right);
        const forward = new T.Vector3()
          .crossVectors(across, new T.Vector3(0, 1, 0))
          .setY(0)
          .normalize();
        const feet = joint("Bip001 L Foot").add(joint("Bip001 R Foot")).multiplyScalar(0.5);
        return {
          box,
          pelvis: pelvis.toArray(),
          head: head.toArray(),
          feet: feet.toArray(),
          facingDeg: (Math.atan2(forward.x, forward.z) * 180) / Math.PI,
        };
      },
      [form, clip, t],
    );
  result.stand = {};
  for (const form of ["normal", "abyssal"]) {
    const rest = await measure(form, null, 0);
    const idle = [];
    for (let i = 0; i <= 8; i++)
      idle.push(await measure(form, `${form}/idle`, (d[`${form}/idle`] * i) / 8));
    const minY = Math.min(...idle.map((m) => m.box.min[1]));
    const maxPelvis = Math.max(...idle.map((m) => Math.hypot(m.pelvis[0], m.pelvis[2])));
    const facing = idle.map((m) => m.facingDeg);
    result.stand[form] = { rest, idleFirst: idle[0], minY, maxPelvisFromAxis: maxPelvis, facing };
    check(
      Math.abs(rest.box.min[1]) < 0.02,
      `${form} at rest stands on the ground (lowest point ${rest.box.min[1].toFixed(4)} m)`,
    );
    // The sash tip of the normal form brushes 2.5 cm into the ground in its idle (as authored).
    check(Math.abs(minY) < 0.03, `${form} idle: lowest point ${minY.toFixed(4)} m`);
    check(
      maxPelvis < 0.25,
      `${form} idle: pelvis within ${maxPelvis.toFixed(3)} m of the vertical axis`,
    );
    check(
      facing.every((f) => Math.abs(f) < 35),
      `${form} idle faces +Z (${Math.min(...facing).toFixed(1)} to ${Math.max(...facing).toFixed(1)} deg)`,
    );
    // The same measure through the run loop (she runs straight ahead): the root's own facing.
    const run = [];
    for (let i = 0; i < 16; i++)
      run.push((await measure(form, `${form}/run`, (d[`${form}/run`] * i) / 16)).facingDeg);
    const runMean = run.reduce((a, x) => a + x, 0) / run.length;
    result.stand[form].runFacingMean = runMean;
    console.log(`info ${form} run: facing ${runMean.toFixed(1)} deg on average over the loop`);
  }
  const hn = result.stand.normal.idleFirst.head[1];
  const ha = result.stand.abyssal.idleFirst.head[1];
  check(
    Math.abs(hn - ha) / hn < 0.05,
    `same scale: head ${hn.toFixed(3)} m (normal) and ${ha.toFixed(3)} m (abyssal)`,
  );

  // 3. The form changes: the pelvis at the swap, and nothing under the ground while shown.
  result.changes = {};
  for (const [key, a, b] of [
    ["toAbyssal", "normal", "abyssal"],
    ["toNormal", "abyssal", "normal"],
  ]) {
    const c = forms[key];
    const before = await measure(a, c.first, c.hideAt);
    const after = await measure(b, c.second, c.secondFrom);
    const gap = before.pelvis.map((x, k) => x - after.pelvis[k]);
    let lowest = Infinity;
    for (let t = 0; t <= c.hideAt + 1e-6; t += 1 / 60)
      lowest = Math.min(lowest, (await measure(a, c.first, t)).box.min[1]);
    let lowest2 = Infinity;
    for (let t = c.secondFrom; t <= d[c.second] + 1e-6; t += 1 / 60)
      lowest2 = Math.min(lowest2, (await measure(b, c.second, t)).box.min[1]);
    result.changes[key] = { before, after, gap, lowestFirst: lowest, lowestSecond: lowest2 };
    const g = Math.hypot(...gap);
    check(
      g < 0.08,
      `${key}: pelvis gap at the swap ${g.toFixed(3)} m (${gap.map((x) => x.toFixed(3)).join(", ")})`,
    );
    check(
      lowest > -0.08,
      `${key}: ${c.first} never shows a point under the ground before hideAt (lowest ${lowest.toFixed(3)} m)`,
    );
    check(
      lowest2 > -0.08,
      `${key}: ${c.second} never shows a point under the ground from secondFrom (lowest ${lowest2.toFixed(3)} m)`,
    );
  }

  // 4. The materials: every one has its picture, none is a Physical material.
  for (const [name, skinned, type, material, transparent, , hasMap] of info.meshes) {
    check(hasMap, `${name} (${material}) has its picture`);
    check(type === "MeshStandardMaterial", `${name} is ${type}`);
  }
  result.meshes = info.meshes;

  // 5. Close-ups of every material, on the light ground and on magenta (a black or bare part shows).
  const tiles = [];
  const shots = [
    ["normal", "normal/idle", 0.3, [0.4, 1.35, 1.6], [0.05, 1.3, 0], "normal upper body"],
    ["normal", "normal/idle", 0.3, [1.4, 0.7, 1.4], [0.15, 0.55, 0], "normal sash"],
    ["normal", "normal/idle", 0.3, [-1.0, 1.3, -2.2], [0, 1.0, 0], "normal back"],
    ["abyssal", "abyssal/idle", 0.3, [0.3, 1.6, 1.6], [0.1, 1.5, 0], "abyssal upper body and orbs"],
    [
      "abyssal",
      "abyssal/idle",
      0.3,
      [0.8, 2.3, 1.2],
      [0.15, 1.95, -0.1],
      "abyssal hair and sparkles",
    ],
    ["abyssal", "abyssal/idle", 0.3, [-1.2, 1.4, -2.4], [0.1, 1.1, 0], "abyssal back"],
  ];
  for (const bg of [0xe9e7e2, 0xff00ff]) {
    for (const [form, clip, t, pos, target, label] of shots) {
      const [tile] = await renderFrames(
        page,
        [{ label: `${label}${bg === 0xff00ff ? " (magenta)" : ""}`, [form]: { clip, t } }],
        {
          camera: { pos, target, fov: 34 },
          width: 420,
          height: 420,
        },
      );
      tiles.push(tile);
    }
    await page.evaluate((c) => window.stage.setBackground(c), 0xff00ff);
  }
  await page.evaluate(() => window.stage.setBackground(0xe9e7e2));
  fs.writeFileSync(
    path.join(WORK, "materials.png"),
    await contactSheet(tiles, { columns: 6, width: 300, height: 300 }),
  );
} finally {
  await stage.close();
}

/** A model's skinned box in the world, and pictures of it from the six sides and a three quarter. */
async function itemViews(p, name, clip, t) {
  const box = await p.evaluate(
    ([c, time]) => {
      const S = window.stage;
      if (c) S.pose("x", c, time);
      return S.box("x");
    },
    [clip, t],
  );
  const c = box.min.map((x, k) => (x + box.max[k]) / 2);
  const r = Math.max(...box.max.map((x, k) => x - box.min[k]));
  const tiles = [];
  for (const [view, dir] of [
    ["front (+Z)", [0, 0, 1]],
    ["back (-Z)", [0, 0, -1]],
    ["right (+X)", [1, 0, 0]],
    ["left (-X)", [-1, 0, 0]],
    ["top (+Y)", [0, 1, 0.02]],
    ["three quarter", [0.55, 0.35, 0.75]],
  ]) {
    const png = await p.evaluate(
      ([centre, d, radius]) =>
        window.stage.shot({
          pos: centre.map((x, k) => x + d[k] * radius * 2.4),
          target: centre,
          width: 420,
          height: 420,
          fov: 30,
        }),
      [c, dir, r],
    );
    tiles.push({ png: pngBytes(png), label: `${name} ${view}` });
  }
  return { box, tiles };
}

// The phone: centred, upright, the case back toward +Z.
{
  const s = await openStage({ "x.glb": path.join(dir, "selena-phone.glb") });
  try {
    const info = await s.page.evaluate(() => window.stage.load("x", "/file/x.glb"));
    await s.page.evaluate(() => (window.stage.grid.visible = false));
    const { box, tiles } = await itemViews(s.page, "phone", null, 0);
    const size = box.max.map((x, k) => x - box.min[k]);
    const centre = box.min.map((x, k) => (x + box.max[k]) / 2);
    check(info.meshes.length === 1 && info.clips.length === 0, "phone: one mesh, no clip");
    check(
      Math.hypot(...centre) < 0.002,
      `phone: centred (${centre.map((x) => x.toFixed(4)).join(", ")})`,
    );
    check(
      size[1] > size[0] && size[0] > size[2],
      `phone: long side up, thin through Z (${size.map((x) => x.toFixed(3)).join(" x ")} m)`,
    );
    fs.writeFileSync(
      path.join(WORK, "phone.png"),
      await contactSheet(tiles, { columns: 6, width: 300, height: 300 }),
    );
    result.phone = { box, size };
  } finally {
    await s.close();
  }
}

// Silverbolt: one clip, `idle`, that loops in place near the origin, tail, wings and jaw moving.
{
  const s = await openStage({ "x.glb": path.join(dir, "silverbolt.glb") });
  try {
    const info = await s.page.evaluate(() => window.stage.load("x", "/file/x.glb"));
    check(
      info.clips.length === 1 && info.clips[0][0] === "idle",
      `silverbolt: one clip, idle (${info.clips.map((c) => c[0]).join(", ")})`,
    );
    const duration = info.clips[0][1];
    const motion = await s.page.evaluate((dur) => {
      const S = window.stage;
      const M = S.models.x;
      const names = [
        "Bone02_She_02",
        "Bone02_She_05",
        "Bone02_She_06",
        "Bone02_She_13",
        "Bone02_She_15",
        "Bone02_She_10",
        "Bone02_She_12",
        "Bone02_She_23",
      ];
      const T = S.THREE;
      // A point 0.2 m out along each bone's own axes: it moves when the bone turns or moves.
      const probe = new T.Vector3(0.2, 0.2, 0.2);
      const at = (t) => {
        S.pose("x", "idle", t);
        return Object.fromEntries(
          names.map((n) => {
            const o = M.root.getObjectByName(n);
            return [n, o.localToWorld(probe.clone()).toArray()];
          }),
        );
      };
      const first = at(0);
      const moved = Object.fromEntries(names.map((n) => [n, 0]));
      const boxes = [];
      for (let i = 0; i <= 16; i++) {
        const now = at((dur * i) / 16);
        for (const n of names)
          moved[n] = Math.max(moved[n], Math.hypot(...now[n].map((x, k) => x - first[n][k])));
        boxes.push(S.box("x"));
      }
      const end = at(dur);
      const seam = Math.max(
        ...names.map((n) => Math.hypot(...end[n].map((x, k) => x - first[n][k]))),
      );
      return { moved, boxes, seam };
    }, duration);
    const centres = motion.boxes.map((b) => b.min.map((x, k) => (x + b.max[k]) / 2));
    const far = Math.max(...centres.map((c) => Math.hypot(...c)));
    check(far < 0.25, `silverbolt: box centre stays within ${far.toFixed(3)} m of the origin`);
    check(
      motion.seam < 0.01,
      `silverbolt: idle loops (last pose ${motion.seam.toFixed(4)} m from the first)`,
    );
    for (const [label, bones] of [
      ["jaw", ["Bone02_She_02"]],
      ["wings", ["Bone02_She_05", "Bone02_She_06", "Bone02_She_13", "Bone02_She_15"]],
      ["tail", ["Bone02_She_10", "Bone02_She_12", "Bone02_She_23"]],
    ]) {
      const most = Math.max(...bones.map((b) => motion.moved[b]));
      check(most > 0.005, `silverbolt: ${label} moves (up to ${most.toFixed(3)} m)`);
    }
    const tiles = [];
    for (const f of [0, 0.25, 0.5, 0.75]) {
      const { tiles: views } = await itemViews(
        s.page,
        `silverbolt idle ${(duration * f).toFixed(2)} s`,
        "idle",
        duration * f,
      );
      tiles.push(...views);
    }
    fs.writeFileSync(
      path.join(WORK, "silverbolt.png"),
      await contactSheet(tiles, { columns: 6, width: 260, height: 260 }),
    );
    result.silverbolt = { duration, moved: motion.moved, far, seam: motion.seam };
  } finally {
    await s.close();
  }
}
fs.writeFileSync(path.join(WORK, "verify.json"), JSON.stringify(result, null, 1));
if (problems.length) {
  console.error(`\n${problems.length} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
