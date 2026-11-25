// Close-ups of the abyssal form's small orbs (the islands painted black in pbs_02_d) at the first
// key of the idle, to judge how they should look. Usage: node probe-orbs.mjs <built.glb> [name]
import fs from "node:fs";
import path from "node:path";
import { workDir } from "../lib/env.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const file = process.argv[2];
const name = process.argv[3] ?? "orbs";
const out = workDir("probe");
const stage = await openStage({ "m.glb": file });
try {
  await stage.page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  const tiles = [];
  // Where the orbs are: the vertices whose UV falls in the black box, after skinning.
  const found = await stage.page.evaluate(() => {
    const S = window.stage;
    const M = S.models.m;
    M.root.getObjectByName("normal").visible = false;
    const mixer = new S.THREE.AnimationMixer(M.root.getObjectByName("abyssal"));
    mixer.clipAction(M.clips["abyssal/idle"]).play();
    mixer.update(0);
    M.root.updateMatrixWorld(true);
    const v = new S.THREE.Vector3();
    const pts = [];
    M.root.getObjectByName("abyssal").traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const uv = o.geometry.attributes.uv;
      if (!uv) return;
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i);
        const w = uv.getY(i);
        if (u > 0.205 && u < 0.265 && w > 0.88 && w < 0.99 && o.material.name.includes("body_03")) {
          v.fromBufferAttribute(o.geometry.attributes.position, i);
          o.applyBoneTransform(i, v);
          v.applyMatrix4(o.matrixWorld);
          pts.push(v.toArray());
        }
      }
    });
    return pts;
  });
  const left = found.filter((p) => p[0] < 0);
  const right = found.filter((p) => p[0] >= 0);
  const mid = (pts) => pts.reduce((a, p) => a.map((x, k) => x + p[k] / pts.length), [0, 0, 0]);
  console.log("orb vertices", found.length, "left", mid(left), "right", mid(right));
  for (const [label, c] of [
    ["right orb", mid(right)],
    ["left orb", mid(left)],
  ]) {
    for (const [view, off] of [
      ["front", [0, 0, 0.45]],
      ["side", [0.45, 0, 0]],
      ["back", [0, 0.1, -0.45]],
    ]) {
      const png = await stage.page.evaluate(
        ([t, o]) =>
          window.stage.shot({
            pos: t.map((x, k) => x + o[k]),
            target: t,
            width: 400,
            height: 400,
            fov: 30,
          }),
        [c, off],
      );
      tiles.push({ png: pngBytes(png), label: `${label} ${view}` });
    }
  }
  const png = await stage.page.evaluate(() =>
    window.stage.shot({
      pos: [0, 1.45, 1.6],
      target: [0, 1.4, 0],
      width: 600,
      height: 400,
      fov: 40,
    }),
  );
  tiles.push({ png: pngBytes(png), label: "upper body" });
  fs.writeFileSync(
    path.join(out, `${name}.png`),
    await contactSheet(tiles, { columns: 4, width: 360, height: 360 }),
  );
} finally {
  await stage.close();
}
