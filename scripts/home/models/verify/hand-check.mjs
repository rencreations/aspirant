// Loads the finished hand.glb in real Chrome with the site's three and checks, measures and draws it.
//
// Checks (a failure stops the build): the 20 bones, the clips and their lengths, the loader's
// materials, every bone head at three frames of every clip against Blender, no vertex of one
// finger inside the next at the end of palm_up and through the whole of breath.
// Measures: the flexion and spread axes of the five fingers (in three, on this file), where the
// palm is and where a thing laid on it sits (an offset in the hand bone's own frame).
// Draws: the elbow camera at 16:9, 21:9 and 9:16, and the hand from six sides with culling on
// against a magenta ground, where a hole or an open border would show.
import fs from "node:fs";
import path from "node:path";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { fail } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";
import { handChains, measureFingers } from "./fingers.mjs";

/**
 * The camera the page starts from: behind and above the wrist, looking along the arm at the palm,
 * aimed so that the wrist falls just under the bottom edge. Portrait keeps the same place and
 * turns a little higher with a wider field (the claws of the thumb leave the frame sideways).
 */
export const VIEW = {
  position: [0, 0.16, 0.26],
  target: [0, 0.05, -0.24],
  fov: 38,
  portrait: { target: [0, 0.1, -0.24], fov: 48 },
};
const viewFor = (label) =>
  label === "9:16"
    ? { position: VIEW.position, target: VIEW.portrait.target, fov: VIEW.portrait.fov }
    : { position: VIEW.position, target: VIEW.target, fov: VIEW.fov };
const ASPECTS = [
  ["16:9", 1280, 720],
  ["21:9", 1260, 540],
  ["9:16", 540, 960],
];

export async function check({ glb, bake, renders, loops = [], quiet = false }) {
  fs.mkdirSync(renders, { recursive: true });
  const stage = await openStage({ m: glb });
  const { page } = stage;
  const log = (...a) => quiet || console.log("  [hand]", ...a);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sane = (n) => n.replace(/\s/g, "_");
  try {
    const info = await ev(async () => await window.stage.load("m", "/file/m"));
    await ev(() => {
      window.measure = window.stage.measureFor("m");
    });
    const bones = bake.bones.map(sane);
    if (info.bones !== bones.length) fail(`hand: ${info.bones} bones, expected ${bones.length}`);
    for (const [clip, data] of Object.entries(bake.clips)) {
      const loaded = info.clips.find((c) => c[0] === clip);
      if (!loaded) fail(`hand: clip ${clip} missing`);
      const expected = (data.frames - 1) / bake.fps;
      if (Math.abs(loaded[1] - expected) > 1e-4)
        fail(`hand: ${clip} lasts ${loaded[1]}, expected ${expected}`);
    }
    for (const [name, , type] of info.meshes)
      if (type !== "MeshStandardMaterial") fail(`hand: ${name} is ${type}`);

    // 1. Bone heads against Blender.
    let worst = 0;
    for (const [clip, data] of Object.entries(bake.clips)) {
      for (const [frame, heads] of Object.entries(data.probe)) {
        const t = Number(frame) / bake.fps;
        const isLoopEnd = loops.includes(clip) && Number(frame) === data.frames - 1;
        const got = await ev(
          ([clip, t, names]) => {
            window.stage.pose("m", clip, t);
            return Object.fromEntries(names.map((n) => [n, window.measure.headOf(n).toArray()]));
          },
          [clip, t, bones],
        );
        bake.bones.forEach((raw, i) => {
          const e = (isLoopEnd ? data.probe["0"] : heads)[raw];
          const g = got[bones[i]];
          const d = Math.hypot(g[0] - e[0], g[1] - e[1], g[2] - e[2]);
          worst = Math.max(worst, d);
          if (d > 0.002)
            fail(`hand: ${clip} frame ${frame}: ${raw} is ${d.toFixed(5)} m from Blender`);
        });
      }
    }
    log("bone heads against Blender: worst", worst.toExponential(2), "m");

    // 2. Fingers do not go through each other.
    const chains = handChains("Bip001_L_");
    const gap = await ev(
      ([chains, times]) => {
        const m = window.measure;
        const order = ["thumb", "index", "middle", "ring", "pinky"];
        let worst = Infinity;
        let at = null;
        for (const [clip, t] of times) {
          window.stage.pose("m", clip, t);
          const sets = Object.fromEntries(
            order.map((f) => [f, chains[f].flatMap((b) => m.pointsOf(b, 0.6))]),
          );
          for (let i = 0; i < order.length - 1; i++) {
            const a = sets[order[i]];
            const b = sets[order[i + 1]];
            let min = Infinity;
            for (const p of a) for (const q of b) min = Math.min(min, p.distanceTo(q));
            if (min < worst) {
              worst = min;
              at = [clip, t, order[i], order[i + 1]];
            }
          }
        }
        return { worst, at };
      },
      [
        chains,
        [
          ["palm_up", 1.0],
          ["palm_up", 0.6],
          ["breath", 0],
          ["breath", 1],
          ["breath", 2],
          ["breath", 3],
        ],
      ],
    );
    // Neighbouring fingers are never closer than the thickness of a claw base: 2 mm is "touching".
    if (gap.worst < 0.002)
      fail(`hand: fingers touch (${gap.worst} m) at ${JSON.stringify(gap.at)}`);
    log("closest two fingers", gap.worst.toFixed(4), "m", JSON.stringify(gap.at));

    // 3. Finger axes at the bind pose (nothing posed), palm facing as in the bake.
    await ev(() => window.measure.reset());
    const fingers = await measureFingers(page, {
      chains,
      palm: bake.palmNormalBind,
      thumbSide: bake.thumbSideBind,
    });
    log("index", JSON.stringify(fingers.index));

    // 4. The palm: where a thing laid on it sits, as an offset in the hand bone's frame.
    const palm = await ev(() => {
      const m = window.measure;
      const T = m.T;
      window.stage.pose("m", "palm_up", 1.0);
      const wrist = m.headOf("Bip001_L_Hand");
      const knuckles = [
        "Bip001_L_Finger1",
        "Bip001_L_Finger2",
        "Bip001_L_Finger3",
        "Bip001_L_Finger4",
      ].map((b) => m.headOf(b));
      const mid = knuckles.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(0.25);
      const centre = wrist.clone().lerp(mid, 0.55);
      const across = knuckles[0].clone().sub(knuckles[3]);
      const along = mid.clone().sub(wrist);
      // The palm normal: perpendicular to both, on the side of the camera (+Y).
      let n = new T.Vector3().crossVectors(across, along).normalize();
      if (n.y < 0) n.negate();
      const ray = new T.Raycaster(
        centre.clone().addScaledVector(n, 0.12),
        n.clone().negate(),
        0,
        0.3,
      );
      const hits = ray.intersectObjects(m.M.meshes, false);
      const hit = hits[0];
      const bone = m.M.bones.Bip001_L_Hand;
      const local = bone.worldToLocal(hit.point.clone());
      const surfaceNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      return {
        bone: "Bip001_L_Hand",
        centre: m.round(hit.point.toArray(), 4),
        normal: m.round(n.toArray(), 3),
        offsetInBoneFrame: m.round(local.toArray(), 4),
        wrist: m.round(wrist.toArray(), 4),
        spanAcross: +across.length().toFixed(4),
        spanAlong: +along.length().toFixed(4),
        surfaceNormalNote:
          surfaceNormal.length() > 0 ? "face normal of the hit, for reference" : "",
      };
    });
    log("palm", JSON.stringify(palm));

    // 4b. The framing, at every aspect: the wrist is under the bottom edge, the palm and the claws of the
    // four fingers are in the frame, the end of the sleeve is out of it, and the palm faces the
    // camera within 55 degrees.
    await ev(() => window.stage.pose("m", "palm_up", 1.0));
    const framing = {};
    for (const [label, w, h] of ASPECTS) {
      const view = viewFor(label);
      framing[label] = await ev(
        ([view, w, h, palmNormal]) => {
          const m = window.measure;
          const T = m.T;
          const camera = new T.PerspectiveCamera(view.fov, w / h, 0.01, 10);
          camera.position.set(...view.position);
          camera.lookAt(new T.Vector3(...view.target));
          camera.updateMatrixWorld(true);
          camera.updateProjectionMatrix();
          const ndc = (p) => {
            const q = p.clone().project(camera);
            return [q.x, q.y];
          };
          const wrist = m.headOf("Bip001_L_Hand");
          const knuckles = [
            "Bip001_L_Finger1",
            "Bip001_L_Finger2",
            "Bip001_L_Finger3",
            "Bip001_L_Finger4",
          ].map((b) => m.headOf(b));
          const mid = knuckles.reduce((a, p) => a.add(p), new T.Vector3()).multiplyScalar(0.25);
          const palm = wrist.clone().lerp(mid, 0.55);
          const tip = (chain) => {
            const pts = chain.flatMap((b) => m.pointsOf(b, 0.5));
            return pts.reduce((a, p) => (p.distanceTo(wrist) > a.distanceTo(wrist) ? p : a));
          };
          const tips = ["Finger1", "Finger2", "Finger3", "Finger4"].map((f) =>
            ndc(tip([f, f + "1", f + "2"].map((b) => "Bip001_L_" + b))),
          );
          const thumb = ndc(tip(["Bip001_L_Finger0", "Bip001_L_Finger01", "Bip001_L_Finger02"]));
          // The end of the sleeve: the vertex farthest toward the camera along +Z.
          let apex = null;
          const p = new T.Vector3();
          for (const mesh of m.M.meshes) {
            const g = mesh.geometry;
            for (let i = 0; i < g.attributes.position.count; i++) {
              p.fromBufferAttribute(g.attributes.position, i);
              mesh.applyBoneTransform(i, p);
              if (!apex || p.z > apex.z) apex = p.clone();
            }
          }
          const inView = camera.matrixWorldInverse.clone();
          const apexCam = apex.clone().applyMatrix4(inView);
          const apexOutside =
            apexCam.z > 0 || Math.abs(ndc(apex)[0]) > 1 || Math.abs(ndc(apex)[1]) > 1;
          const normal = new T.Vector3(...palmNormal).normalize();
          const toCamera = camera.position.clone().sub(palm).normalize();
          return {
            wrist: ndc(wrist),
            palm: ndc(palm),
            tips,
            thumb,
            apexOutside,
            palmAngleDegrees: (Math.acos(normal.dot(toCamera)) * 180) / Math.PI,
          };
        },
        [view, w, h, palm.normal],
      );
      const f = framing[label];
      const inside = (n) => Math.abs(n[0]) <= 1 && Math.abs(n[1]) <= 1;
      if (!(f.wrist[1] < -1))
        fail(
          `hand: at ${label} the wrist is at NDC y ${f.wrist[1].toFixed(2)}, not under the bottom edge`,
        );
      if (!inside(f.palm))
        fail(`hand: at ${label} the palm centre is outside the frame (${f.palm})`);
      if (!f.tips.every(inside))
        fail(`hand: at ${label} a claw is outside the frame (${JSON.stringify(f.tips)})`);
      if (Math.abs(f.thumb[1]) > 1)
        fail(`hand: at ${label} the thumb claw leaves the frame above or below`);
      if (!f.apexOutside) fail(`hand: at ${label} the end of the sleeve is in the frame`);
      if (f.palmAngleDegrees > 55)
        fail(
          `hand: the palm is ${f.palmAngleDegrees.toFixed(0)} degrees off the camera at ${label}`,
        );
    }
    log("framing", JSON.stringify(framing));

    // 5. Pictures.
    const shot = async (opts) => pngBytes(await ev((o) => window.stage.shot(o), opts));
    const dress = (cull) =>
      ev((cull) => {
        window.stage.setBackground(cull ? 0xff00ff : 0x3a4150);
        window.stage.useEnvironment(true);
        for (const mesh of window.stage.models.m.meshes)
          for (const mat of [].concat(mesh.material))
            mat.side = cull ? window.stage.THREE.FrontSide : window.stage.THREE.DoubleSide;
      }, cull);
    await dress(false);
    const views = [];
    for (const [label, w, h] of ASPECTS) {
      for (const [clip, t, tag] of [
        ["palm_up", 0, "bind"],
        ["palm_up", 1, "palm_up"],
      ]) {
        await ev(([clip, t]) => window.stage.pose("m", clip, t), [clip, t]);
        const v = viewFor(label);
        const png = await shot({
          width: w,
          height: h,
          pos: v.position,
          target: v.target,
          fov: v.fov,
        });
        fs.writeFileSync(path.join(renders, `hand-${label.replace(":", "x")}-${tag}.png`), png);
        views.push({ png, label: `elbow camera, ${label}, ${tag}` });
      }
    }
    fs.writeFileSync(
      path.join(renders, "hand-views.png"),
      await contactSheet(views, { columns: 2, width: 640, height: 500 }),
    );
    // From six sides, culling on, magenta ground: a hole or an open border would show as magenta.
    await dress(true);
    await ev(() => window.stage.pose("m", "palm_up", 1.0));
    const closed = [];
    for (const [label, pos] of [
      ["elbow camera", VIEW.position],
      ["behind, low", [0.12, 0.04, 0.55]],
      ["behind, high", [-0.1, 0.5, 0.45]],
      ["from below", [0, -0.5, 0.15]],
      ["from the side", [0.55, 0.12, 0.1]],
      ["from the front", [0.05, 0.1, -0.6]],
    ])
      closed.push({
        png: await shot({ width: 640, height: 640, pos, target: [0, 0, 0.02], fov: 42 }),
        label: `culling on: ${label}`,
      });
    fs.writeFileSync(
      path.join(renders, "hand-closed.png"),
      await contactSheet(closed, { columns: 3, width: 460, height: 460 }),
    );
    // The same from the elbow camera at three aspects, culling on.
    const ratios = [];
    for (const [label, w, h] of ASPECTS)
      ratios.push({
        png: await shot({
          width: w,
          height: h,
          pos: viewFor(label).position,
          target: viewFor(label).target,
          fov: viewFor(label).fov,
        }),
        label: `culling on: ${label}`,
      });
    fs.writeFileSync(
      path.join(renders, "hand-closed-views.png"),
      await contactSheet(ratios, { columns: 3, width: 460, height: 460 }),
    );
    await dress(false);
    const breath = [];
    for (const t of [0, 1, 2, 3]) {
      await ev((t) => window.stage.pose("m", "breath", t), t);
      breath.push({
        png: await shot({
          width: 640,
          height: 640,
          pos: VIEW.position,
          target: VIEW.target,
          fov: VIEW.fov,
        }),
        label: `breath ${t} s`,
      });
    }
    fs.writeFileSync(
      path.join(renders, "hand-breath.png"),
      await contactSheet(breath, { columns: 4, width: 360, height: 360 }),
    );
    return { worstHeadError: worst, closestFingers: gap, fingers, palm, view: VIEW, framing };
  } finally {
    await stage.close();
  }
}
