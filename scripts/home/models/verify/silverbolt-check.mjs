// Loads the finished silverbolt.glb in real Chrome with the site's three and checks and measures it.
//
// Checks (any failure stops the build): the bones, the clips and their lengths, the materials
// the loader builds, every bone head at three frames of every clip against the numbers Blender
// computed from the source, and the numbers the digest gave for the video match.
// Measures (written into the facts): the hinge of the jaw, the axes of the wing and cheek blades,
// the bend of the tail, the squash of the eyes, the mouth gap.
// Draws: the contact sheets the build keeps.
import fs from "node:fs";
import path from "node:path";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { fail } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const HEAD = "Bone02_She_01";
const JAW = "Bone02_She_02";
const BLADES = ["05", "06", "13", "14", "15", "16", "17", "18"].map((n) => `Bone02_She_${n}`);
const FINS = ["Bone02_She_08", "Bone02_She_07"];
const TONGUE = ["Bone02_She_19", "Bone02_She_20"];

/** Browser side: the helpers of stage.js, for the model "m", as window.measure. */
function installMeasure() {
  window.measure = window.stage.measureFor("m");
}

export async function check({ glb, bake, renders, loops = [], quiet = false }) {
  fs.mkdirSync(renders, { recursive: true });
  const stage = await openStage({ m: glb });
  const { page } = stage;
  const log = (...a) => quiet || console.log("  [silverbolt]", ...a);
  try {
    const info = await page.evaluate(async () => await window.stage.load("m", "/file/m"));
    await page.evaluate(installMeasure);

    // 1. What the loader built.
    if (info.bones !== bake.bones.length)
      fail(`silverbolt: ${info.bones} bones, expected ${bake.bones.length}`);
    for (const [clip, data] of Object.entries(bake.clips)) {
      const loaded = info.clips.find((c) => c[0] === `city_${clip}`);
      if (!loaded) fail(`silverbolt: clip ${clip} missing`);
      const expected = (data.frames - 1) / bake.fps;
      if (Math.abs(loaded[1] - expected) > 1e-4)
        fail(`silverbolt: ${clip} lasts ${loaded[1]}, expected ${expected}`);
    }
    const materials = await page.evaluate(() =>
      window.stage.models.m.meshes.map((m) => [
        m.material.name,
        m.material.type,
        m.material.transparent,
        m.material.depthWrite,
        m.material.side,
        !!m.material.map,
        !!m.material.emissiveMap,
      ]),
    );
    for (const [name, type] of materials)
      if (type !== "MeshStandardMaterial") fail(`silverbolt: ${name} is ${type}`);
    const ribbon = materials.find((m) => m[0] === "silverbolt_ribbon");
    if (!ribbon || !ribbon[2] || ribbon[3])
      fail(
        `silverbolt: the ribbon must be transparent without depth write: ${JSON.stringify(ribbon)}`,
      );

    // 2. Every bone head, three frames of every clip, against Blender.
    let worst = 0;
    for (const [clip, data] of Object.entries(bake.clips)) {
      for (const [frame, heads] of Object.entries(data.probe)) {
        const t = Number(frame) / bake.fps;
        // A loop ends on its first key (the build sets it so): the last frame is checked against the first.
        const isLoopEnd = loops.includes(clip) && Number(frame) === data.frames - 1;
        const got = await page.evaluate(
          ([clip, t, names]) => {
            const S = window.stage;
            S.pose("m", `city_${clip}`, t);
            return Object.fromEntries(names.map((n) => [n, window.measure.headOf(n).toArray()]));
          },
          [clip, t, bake.bones],
        );
        for (const name of bake.bones) {
          const e = (isLoopEnd ? data.probe["0"] : heads)[name];
          const d = Math.hypot(got[name][0] - e[0], got[name][1] - e[1], got[name][2] - e[2]);
          worst = Math.max(worst, d);
          if (d > 0.005)
            fail(`silverbolt: ${clip} frame ${frame}: ${name} is ${d.toFixed(4)} m from Blender`);
        }
      }
    }
    log("bone heads against Blender: worst", worst.toExponential(2), "m");

    // 3. The digest's numbers for the video match (short-1, action 2.4 s).
    const at = await page.evaluate(() => {
      window.stage.pose("m", "city_intercation03", 2.4);
      return window.measure.headOf("Bone02_She_01").toArray();
    });
    const known = [0.626, 1.342, 0.291];
    const drift = Math.hypot(at[0] - known[0], at[1] - known[1], at[2] - known[2]);
    if (drift > 0.012)
      fail(
        `silverbolt: She_01 at intercation03 2.4 s is ${at.join(",")}, the digest has ${known.join(",")}`,
      );
    log(
      "She_01 at intercation03 2.4 s",
      at.map((x) => +x.toFixed(3)),
      "digest",
      known,
    );

    // 4. Measurements.
    const measured = await page.evaluate(
      ([HEAD, JAW, BLADES, FINS, TONGUE, CHAIN]) => {
        const m = window.measure;
        const { T } = m;
        const out = {};
        const lateral = [1, 0, 0];
        // Jaw: positive angle about the world X axis turns the lower jaw down.
        m.reset();
        const jawAxis = m.localAxis(JAW, lateral);
        const jawRest = m.centroid(m.pointsOf(JAW, 0.9));
        const upper = () =>
          m.centroid(m.pointsOf(HEAD, 0.9).filter((p) => p.z > 0.15 && p.y < 3.55));
        const gap = (angle) => {
          m.reset();
          m.turn(JAW, jawAxis, angle);
          const lower = m.pointsOf(JAW, 0.9);
          const front = lower.sort((a, b) => b.z - a.z).slice(0, Math.ceil(lower.length * 0.2));
          const up = m
            .pointsOf(HEAD, 0.9)
            .filter((p) => p.z > 0.2 && p.y < 3.6)
            .sort((a, b) => b.z - a.z)
            .slice(0, 40);
          return m.centroid(up).distanceTo(m.centroid(front));
        };
        const lowerAt = (a) => {
          m.reset();
          m.turn(JAW, jawAxis, a);
          return m.centroid(m.pointsOf(JAW, 0.9)).y;
        };
        const sign = lowerAt(0.3) < lowerAt(0) ? 1 : -1;
        out.jaw = {
          bone: JAW,
          axisLocal: m.round(jawAxis.clone().multiplyScalar(sign).toArray(), 5),
          note: "positive angle about axisLocal opens the mouth",
          gaps: Object.fromEntries(
            [-0.4, -0.3, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0].map((a) => [
              a,
              +gap(sign * a).toFixed(3),
            ]),
          ),
        };
        void jawRest;
        void upper;
        // Blades and fins: flap = about the body's long axis (world Z), spread = about world Y.
        const hinge = (bone, world, test) => {
          m.reset();
          const axis = m.localAxis(bone, world);
          const pts = m.pointsOf(bone, 0.5);
          if (!pts.length) return null;
          const head = m.headOf(bone);
          const tip = pts
            .reduce((a, p) => (p.distanceTo(head) > a.distanceTo(head) ? p : a), pts[0])
            .clone();
          const before = test(tip);
          m.turn(bone, axis, 0.3);
          const moved = m
            .pointsOf(bone, 0.5)
            .reduce((a, p) => (p.distanceTo(head) > a.distanceTo(head) ? p : a), pts[0]);
          // the same vertex index is not tracked: take the farthest point again, good enough for a sign
          const after = test(moved);
          const sgn = after > before ? 1 : -1;
          return {
            axisLocal: m.round(axis.clone().multiplyScalar(sgn).toArray(), 5),
            tipRest: m.round(tip.toArray(), 3),
            length: +tip.distanceTo(head).toFixed(3),
            sideX: Math.sign(tip.x),
          };
        };
        out.blades = {};
        for (const bone of [...BLADES, ...FINS]) {
          out.blades[bone] = {
            raise: hinge(bone, [0, 0, 1], (p) => p.y),
            spread: hinge(bone, [0, 1, 0], (p) => Math.abs(p.x)),
          };
        }
        out.tongue = {};
        for (const bone of TONGUE) out.tongue[bone] = { curl: hinge(bone, [1, 0, 0], (p) => -p.y) };
        // Tail: bending each bone about its own X by an angle moves the whole rest of the chain.
        m.reset();
        const tailAxis = m.localAxis(CHAIN[0], [1, 0, 0]);
        const tipOf = () => m.headOf(CHAIN[CHAIN.length - 1]);
        const t0 = tipOf().clone();
        for (const b of CHAIN) m.turn(b, tailAxis, 0.25);
        const up = tipOf().y > t0.y ? 1 : -1;
        out.tail = {
          chain: CHAIN,
          aimAxisLocal: [0, 1, 0],
          pitchAxisLocal: m.round(tailAxis.clone().multiplyScalar(up).toArray(), 5),
          note: "a positive angle about pitchAxisLocal raises the tail",
          tipRest: m.round(t0.toArray(), 3),
          tipAfter: m.round(tipOf().toArray(), 3),
          perBoneTurn: 0.25,
        };
        // Eyes: the scale of the eye bones.
        out.eyes = {
          bones: ["sb_eye_L", "sb_eye_R"],
          axis: "y",
          note: "scale.y of each eye bone, 1 open, 0.06 shut",
        };
        m.reset();
        void T;
        return out;
      },
      [HEAD, JAW, BLADES, FINS, TONGUE, bake.chain],
    );
    log("jaw", JSON.stringify(measured.jaw));

    // 5. Contact sheets.
    const shot = async (opts) => pngBytes(await page.evaluate((o) => window.stage.shot(o), opts));
    const setup = (fn, arg) => page.evaluate(fn, arg);
    await setup(() => {
      window.stage.setBackground(0x8a8f99);
      window.stage.useEnvironment(true);
      window.measure.reset();
    });
    const angles = [];
    for (const [label, pos] of [
      ["front", [0, 3.75, 2.3]],
      ["3/4", [-2.3, 4.2, 2.0]],
      ["side", [3.6, 3.9, -0.6]],
    ]) {
      const png = await shot({ width: 1440, height: 900, pos, target: [0, 3.5, -0.8], fov: 40 });
      fs.writeFileSync(path.join(renders, `silverbolt-${label.replace("/", "-")}.png`), png);
      angles.push({ png, label: `rest, ${label}, 1440x900` });
    }
    const whole = await shot({
      width: 1440,
      height: 900,
      pos: [8.2, 4.4, -1.2],
      target: [0, 3.45, -1.2],
      fov: 30,
    });
    angles.push({ png: whole, label: "rest, the whole body from the side" });
    // The same model under MeshBasicMaterial (no light at all): the painted pictures carry the shading.
    await page.evaluate(() => {
      const T = window.stage.THREE;
      window.stage.useEnvironment(false);
      window.stage.hemi.visible = false;
      window.stage.sun.visible = false;
      for (const mesh of window.stage.models.m.meshes) {
        const old = mesh.material;
        mesh.userData.standard = old;
        mesh.material = new T.MeshBasicMaterial({
          map: old.map,
          color: old.color,
          transparent: old.transparent,
          depthWrite: old.depthWrite,
          side: T.DoubleSide,
        });
      }
    });
    angles.push({
      png: await shot({
        width: 1440,
        height: 900,
        pos: [-2.6, 4.3, 2.8],
        target: [0, 3.5, -0.8],
        fov: 40,
      }),
      label: "3/4 under MeshBasicMaterial, no lights",
    });
    await page.evaluate(() => {
      window.stage.useEnvironment(true);
      window.stage.hemi.visible = true;
      window.stage.sun.visible = true;
      for (const mesh of window.stage.models.m.meshes) mesh.material = mesh.userData.standard;
    });
    fs.writeFileSync(
      path.join(renders, "silverbolt-angles.png"),
      await contactSheet(angles, { columns: 2, width: 720, height: 450 }),
    );

    // Head: jaw open, eyes shut, tail bent; and the throat from the front with culling on.
    const poseHead = (jaw, eye, bend) =>
      page.evaluate(
        ([jaw, eye, bend, jawAxis, chain, tailAxis]) => {
          const m = window.measure;
          m.reset();
          m.turn("Bone02_She_02", new m.T.Vector3(...jawAxis), jaw);
          for (const n of ["sb_eye_L", "sb_eye_R"]) m.M.bones[n].scale.set(1, eye, 1);
          for (const b of chain) m.turn(b, new m.T.Vector3(...tailAxis), bend);
          m.M.root.updateMatrixWorld(true);
        },
        [jaw, eye, bend, measured.jaw.axisLocal, bake.chain, measured.tail.pitchAxisLocal],
      );
    const head = [];
    await poseHead(0.8, 0.06, 0.28);
    for (const [label, pos, target, fov] of [
      ["head 3/4: jaw open 0.8, eyes shut", [-1.5, 4.0, 1.5], [0, 3.5, 0.15], 28],
      ["head side", [2.0, 3.7, 0.4], [0, 3.5, 0.15], 28],
      ["head from below, into the mouth", [0.2, 2.6, 1.7], [0, 3.4, 0.15], 32],
      ["tail bent, side", [6.5, 4.2, -1.3], [0, 3.6, -1.3], 36],
    ])
      head.push({ png: await shot({ width: 960, height: 720, pos, target, fov }), label: label });
    await page.evaluate(() => {
      window.stage.setBackground(0xff00ff);
      for (const mesh of window.stage.models.m.meshes)
        for (const mat of [].concat(mesh.material)) mat.side = window.stage.THREE.FrontSide;
    });
    for (const [label, pos, target, fov] of [
      ["culling on, open mouth, front", [0.15, 3.2, 1.8], [0, 3.4, 0.1], 32],
      ["culling on, open mouth, 3/4 below", [-1.2, 2.8, 1.4], [0, 3.4, 0.1], 32],
    ])
      head.push({ png: await shot({ width: 960, height: 720, pos, target, fov }), label });
    fs.writeFileSync(
      path.join(renders, "silverbolt-head.png"),
      await contactSheet(head, { columns: 3, width: 640, height: 480 }),
    );
    await page.evaluate(() => {
      window.stage.setBackground(0x8a8f99);
      for (const mesh of window.stage.models.m.meshes)
        for (const mat of [].concat(mesh.material)) mat.side = window.stage.THREE.DoubleSide;
    });

    // Clip frames: three moments of the video match, drawn from the camera of the clip is done in cameras-check.
    const moments = [];
    for (const [clip, t] of [
      ["idle", 0.5],
      ["idle_BP", 0.5],
      ["interaction_R_loop", 0.5],
      ["intercation03", 1.6],
      ["intercation03", 2.4],
      ["intercation03", 3.6],
    ]) {
      await page.evaluate(([clip, t]) => window.stage.pose("m", `city_${clip}`, t), [clip, t]);
      const centre = await page.evaluate(() => window.measure.headOf("Bone02_She_01").toArray());
      const png = await shot({
        width: 720,
        height: 540,
        pos: [centre[0] + 1.4, centre[1] + 0.5, centre[2] + 1.6],
        target: centre,
        fov: 40,
      });
      moments.push({ png, label: `${clip} ${t}s` });
    }
    fs.writeFileSync(
      path.join(renders, "silverbolt-clips.png"),
      await contactSheet(moments, { columns: 3, width: 560, height: 420 }),
    );
    return { measured, materials, worstHeadError: worst };
  } finally {
    await stage.close();
  }
}
