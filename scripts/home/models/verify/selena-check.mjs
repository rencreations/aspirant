// Loads the finished selena.glb in real Chrome with the site's three and checks, measures and draws it.
//
// Checks (a failure stops the build): the bones, the clips and their lengths, the materials, the
// morph targets on the head, every bone head at three frames of every clip against Blender, the
// digest's numbers for the video match.
// Measures (written into the facts): the flexion and spread axes of every finger of both hands,
// the forward axis of each eyeball.
// Draws: clips, faces, the blink on the final head, and the material recipe against the plain load.
import fs from "node:fs";
import path from "node:path";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { fail } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";
import { handChains, measureFingers } from "./fingers.mjs";

const sane = (name) => name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");

export async function check({ glb, bake, renders, morphNames, loops = [], quiet = false }) {
  fs.mkdirSync(renders, { recursive: true });
  const stage = await openStage({ m: glb });
  const { page } = stage;
  const log = (...a) => quiet || console.log("  [selena]", ...a);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    const info = await ev(async () => await window.stage.load("m", "/file/m"));
    await ev(() => {
      window.measure = window.stage.measureFor("m");
    });
    const bones = bake.bones.map(sane);

    // 1. What the loader built.
    if (info.bones !== bones.length) fail(`selena: ${info.bones} bones, expected ${bones.length}`);
    for (const [clip, data] of Object.entries(bake.clips)) {
      const loaded = info.clips.find((c) => c[0] === `city_${clip}`);
      if (!loaded) fail(`selena: clip ${clip} missing`);
      const expected = (data.frames - 1) / bake.fps;
      if (Math.abs(loaded[1] - expected) > 1e-4)
        fail(`selena: ${clip} lasts ${loaded[1]}, expected ${expected}`);
    }
    for (const [name, , type] of info.meshes)
      if (type !== "MeshStandardMaterial") fail(`selena: ${name} is ${type}`);
    const morphs = await ev(() => {
      const head = window.stage.models.m.meshes.find((m) => m.name === "selena_mesh_head");
      return { dictionary: head.morphTargetDictionary, count: head.morphTargetInfluences.length };
    });
    for (const n of morphNames)
      if (!(n in morphs.dictionary)) fail(`selena: morph target ${n} is missing on the head`);
    log("morph targets", Object.keys(morphs.dictionary).join(" "));

    // 2. Every bone head, three frames of every clip, against Blender.
    let worst = 0;
    for (const [clip, data] of Object.entries(bake.clips)) {
      for (const [frame, heads] of Object.entries(data.probe)) {
        const t = Number(frame) / bake.fps;
        // A loop ends on its first key (the build sets it so): the last frame is checked against the first.
        const isLoopEnd = loops.includes(clip) && Number(frame) === data.frames - 1;
        const got = await ev(
          ([clip, t, names]) => {
            window.stage.pose("m", `city_${clip}`, t);
            return Object.fromEntries(names.map((n) => [n, window.measure.headOf(n).toArray()]));
          },
          [clip, t, bones],
        );
        bake.bones.forEach((raw, i) => {
          const e = (isLoopEnd ? data.probe["0"] : heads)[raw];
          const g = got[bones[i]];
          const d = Math.hypot(g[0] - e[0], g[1] - e[1], g[2] - e[2]);
          worst = Math.max(worst, d);
          if (d > 0.005)
            fail(`selena: ${clip} frame ${frame}: ${raw} is ${d.toFixed(4)} m from Blender`);
        });
      }
    }
    log("bone heads against Blender: worst", worst.toExponential(2), "m");
    const known = await ev(() => {
      window.stage.pose("m", "city_intercation03", 2.4);
      return {
        head: window.measure.headOf("Bip001_Head").toArray(),
        handR: window.measure.headOf("Bip001_R_Hand").toArray(),
      };
    });
    const digest = { head: [0.289, 1.629, -0.301], handR: [-0.155, 1.276, -0.404] };
    for (const key of ["head", "handR"]) {
      const d = Math.hypot(...known[key].map((v, i) => v - digest[key][i]));
      if (d > 0.012)
        fail(
          `selena: ${key} at intercation03 2.4 s is ${known[key]}, the digest has ${digest[key]}`,
        );
    }

    // 3. Fingers of both hands, and the eyes, at rest.
    await ev(() => window.measure.reset());
    const handX = await ev(() => ({
      L: window.measure.headOf("Bip001_L_Hand").x,
      R: window.measure.headOf("Bip001_R_Hand").x,
    }));
    const fingers = {};
    for (const side of ["L", "R"]) {
      // The palm faces the body in the rest pose: toward -X for the hand on the +X side.
      const palm = [handX[side] > 0 ? -1 : 1, 0, 0];
      fingers[side] = await measureFingers(page, { chains: handChains(`Bip001_${side}_`), palm });
    }
    log("index finger L", JSON.stringify(fingers.L.index), "R", JSON.stringify(fingers.R.index));
    const eyes = await ev(() => {
      const m = window.measure;
      const out = {};
      for (const side of ["L", "R"]) {
        const bone = `Bone01_Eye_${side}_02`;
        const q = m.worldQuat(bone).invert();
        out[bone] = {
          forwardLocal: m.round(new m.T.Vector3(0, 0, 1).applyQuaternion(q).toArray(), 4),
          upLocal: m.round(new m.T.Vector3(0, 1, 0).applyQuaternion(q).toArray(), 4),
          note: "rest pose, she faces +Z: forwardLocal is where the iris points in the bone's frame. To look right turn about the bone's local image of world +Y; to look up, about world -X.",
        };
      }
      return out;
    });

    // 4. Pictures.
    const shot = async (opts) => pngBytes(await ev((o) => window.stage.shot(o), opts));
    await ev(() => {
      window.stage.setBackground(0x8a8f99);
      window.stage.useEnvironment(true);
      window.measure.reset();
    });
    const headBox = await ev(() => {
      const m = window.measure;
      const pts = m.pointsOf("Bip001_Head", 0.3, (mesh) => mesh.name === "selena_mesh_head");
      const c = m.centroid(pts);
      return { c: c.toArray() };
    });
    const face = (pos) => ({
      width: 640,
      height: 640,
      pos: [headBox.c[0] + pos[0], headBox.c[1] + pos[1], headBox.c[2] + pos[2]],
      target: [headBox.c[0], headBox.c[1] + 0.01, headBox.c[2]],
      fov: 22,
    });

    // The faces: every kept morph at 1, on the final head, eyes and all.
    const faceTiles = [];
    const setMorph = (name, v) =>
      ev(
        ([name, v]) => {
          const head = window.stage.models.m.meshes.find((m) => m.name === "selena_mesh_head");
          head.morphTargetInfluences.fill(0);
          if (name) head.morphTargetInfluences[head.morphTargetDictionary[name]] = v;
        },
        [name, v],
      );
    for (const name of [null, ...morphNames]) {
      await setMorph(name, 1);
      faceTiles.push({ png: await shot(face([0, 0.02, 0.8])), label: name ?? "base (no morph)" });
    }
    await setMorph(null, 0);
    fs.writeFileSync(
      path.join(renders, "selena-faces.png"),
      await contactSheet(faceTiles, { columns: 4, width: 420, height: 420 }),
    );

    // The blink, with the eyeballs in place, from the front and from the side; and the eye mesh hidden.
    const blink = [];
    for (const [label, v] of [
      ["open", 0],
      ["blink 0.5", 0.5],
      ["blink 1", 1],
    ]) {
      await setMorph("blink", v);
      blink.push({ png: await shot(face([0, 0.02, 0.8])), label: `${label}, front` });
      blink.push({ png: await shot(face([-0.45, 0.04, 0.6])), label: `${label}, 3/4` });
    }
    await setMorph(null, 0);
    fs.writeFileSync(
      path.join(renders, "selena-blink.png"),
      await contactSheet(blink, { columns: 2, width: 560, height: 560 }),
    );

    // The clips, three moments each.
    const moments = [];
    for (const [clip, times] of [
      ["idle", [0, 0.9, 1.8]],
      ["interaction_R_loop", [0, 0.9, 1.8]],
      ["interaction_back_R", [0, 1.4, 3.1]],
      ["intercation03", [0.8, 2.4, 4.0, 5.2]],
    ]) {
      for (const t of times) {
        const c = await ev(
          ([clip, t]) => {
            window.stage.pose("m", `city_${clip}`, t);
            const m = window.measure;
            return m.centroid([m.headOf("Bip001_Head"), m.headOf("Bip001_Pelvis")]).toArray();
          },
          [clip, t],
        );
        moments.push({
          png: await shot({
            width: 560,
            height: 560,
            pos: [c[0] + 0.3, c[1] + 0.2, c[2] + 3.2],
            target: c,
            fov: 34,
          }),
          label: `${clip} ${t}s`,
        });
      }
    }
    fs.writeFileSync(
      path.join(renders, "selena-clips.png"),
      await contactSheet(moments, { columns: 4, width: 440, height: 440 }),
    );

    // The material recipe against the plain load: the rest pose and the face.
    await ev(() => window.measure.reset());
    const recipe = [];
    const rest = (extra) => ({
      width: 640,
      height: 900,
      pos: [0, 1.0 + extra, 4.0],
      target: [0, 0.95 + extra, 0],
      fov: 38,
    });
    recipe.push({
      png: await shot(rest(0.1)),
      label: "as loaded: MeshStandardMaterial + environment",
    });
    recipe.push({ png: await shot(face([0, 0.02, 0.8])), label: "as loaded, face" });
    await ev(() => window.stage.recipe.on());
    recipe.push({ png: await shot(rest(0.1)), label: "recipe: toon steps + rim + ink outline" });
    recipe.push({ png: await shot(face([0, 0.02, 0.8])), label: "recipe, face" });
    await ev(() => window.stage.recipe.off());
    fs.writeFileSync(
      path.join(renders, "selena-material.png"),
      await contactSheet(recipe, { columns: 4, width: 460, height: 640 }),
    );

    return { worstHeadError: worst, fingers, eyes, morphs: morphs.dictionary };
  } finally {
    await stage.close();
  }
}
