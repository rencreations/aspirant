// The candidate parts of the entrance file alone, at rest, in Chrome: their box in the world and
// six views each, to find the phone. Usage: node probe-phone.mjs [mesh name part ...]
import fs from "node:fs";
import path from "node:path";
import { ENTRANCE_GLB, workDir } from "../lib/env.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const parts = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["accessory_01", "accessory_02"];
const out = workDir("probe");
const stage = await openStage({ "e.glb": ENTRANCE_GLB });
try {
  await stage.page.evaluate(() => window.stage.load("e", "/file/e.glb"));
  await stage.page.evaluate(() => (window.stage.grid.visible = false));
  const tiles = [];
  for (const part of parts) {
    const box = await stage.page.evaluate((p) => {
      const M = window.stage.models.e;
      for (const m of M.meshes) m.visible = m.name.includes(p);
      const T = window.stage.THREE;
      const b = new T.Box3();
      const v = new T.Vector3();
      M.root.updateMatrixWorld(true);
      for (const m of M.meshes.filter((x) => x.visible)) {
        const pos = m.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          m.applyBoneTransform(i, v);
          v.applyMatrix4(m.matrixWorld);
          b.expandByPoint(v);
        }
      }
      return { min: b.min.toArray(), max: b.max.toArray() };
    }, part);
    const c = box.min.map((x, k) => (x + box.max[k]) / 2);
    const r = Math.max(...box.max.map((x, k) => x - box.min[k]));
    console.log(
      part,
      "box",
      box.min.map((x) => x.toFixed(3)),
      box.max.map((x) => x.toFixed(3)),
      "size",
      box.max.map((x, k) => (x - box.min[k]).toFixed(3)),
    );
    for (const [view, dir] of [
      ["+x", [1, 0, 0]],
      ["-x", [-1, 0, 0]],
      ["+y", [0, 1, 0.001]],
      ["-y", [0, -1, 0.001]],
      ["+z", [0, 0, 1]],
      ["-z", [0, 0, -1]],
    ]) {
      const png = await stage.page.evaluate(
        ([center, d, radius]) =>
          window.stage.shot({
            pos: center.map((x, k) => x + d[k] * radius * 2.6),
            target: center,
            width: 360,
            height: 360,
            fov: 30,
          }),
        [c, dir, r],
      );
      tiles.push({ png: pngBytes(png), label: `${part} from ${view}` });
    }
  }
  fs.writeFileSync(
    path.join(out, "phone-candidates.png"),
    await contactSheet(tiles, { columns: 6, width: 260, height: 260 }),
  );
} finally {
  await stage.close();
}
