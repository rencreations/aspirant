// The camera of `idle-standing` (no recording shows it; the owner wants her whole body): static,
// from the front three quarter (30 degrees to her left of straight on), the eye a little above
// her waist, far enough that her whole figure through the loop fills the frame's height with a
// margin. Written into cameras/fits.json and drawn to WORK/idle-standing-camera.png.
//
//   node fit/standing.mjs
import fs from "node:fs";
import path from "node:path";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { HERE, WORK, readJson, writeWhole } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const VFOV = 60;
const ASPECT = 2.2222;
const AZIMUTH = 30; // degrees, to her left of straight on
const MARGIN = 0.12; // of the frame's height, shared above and below
const SELENA = ["body_01", "body_02", "body_03", "head", "eye", "hair_01", "hair_02"];

const stage = await openStage({ model: path.join(WORK, "work", "model.glb") });
const { page } = stage;
try {
  await page.evaluate(async () => {
    await window.stage.load("m", "/file/model");
    window.stage.look("m", "unlit");
    window.stage.setBackground(0xeceef2);
  });
  const clip = await page.evaluate(() => window.stage.models.m.clips["idle-standing"].duration);
  // Her points through the loop, and the way she faces at its start.
  const measured = await page.evaluate(
    ({ clip, SELENA }) => {
      const S = window.stage;
      const T = S.THREE;
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        S.pose("m", "idle-standing", (clip * i) / 8);
        const flat = S.skinned("m", 7, SELENA);
        for (let k = 0; k < flat.length; k += 3) pts.push([flat[k], flat[k + 1], flat[k + 2]]);
      }
      S.pose("m", "idle-standing", 0);
      const pos = (n) => new T.Vector3().setFromMatrixPosition(S.models.m.bones[n].matrixWorld);
      const left = pos("Bip001_L_Thigh").sub(pos("Bip001_R_Thigh")).setY(0).normalize();
      const forward = left
        .clone()
        .cross(new T.Vector3(0, 1, 0))
        .normalize();
      return { pts, forward: forward.toArray(), pelvis: pos("Bip001_Pelvis").toArray() };
    },
    { clip, SELENA },
  );
  const ys = measured.pts.map((p) => p[1]);
  const top = Math.max(...ys);
  const bottom = Math.min(...ys);
  const waist = measured.pelvis[1] + 0.12;
  const cx = measured.pts.reduce((a, p) => a + p[0], 0) / measured.pts.length;
  const cz = measured.pts.reduce((a, p) => a + p[2], 0) / measured.pts.length;
  // The view direction: her forward turned by the azimuth about the vertical, the eye on the
  // waist's height plus a little, aimed at the middle of her height.
  const a = (AZIMUTH * Math.PI) / 180;
  const [fx, , fz] = measured.forward;
  const dir = [fx * Math.cos(a) + fz * Math.sin(a), 0, -fx * Math.sin(a) + fz * Math.cos(a)];
  const target = [cx, (top + bottom) / 2, cz];
  const half = ((top - bottom) / 2) * (1 + 2 * MARGIN);
  let distance = half / Math.tan(((VFOV / 2) * Math.PI) / 180);
  // Her depth along the view: the nearest point is in front of the target.
  const eyeHeight = waist + 0.15;
  const fits = readJson(path.join(HERE, "cameras", "fits.json"));
  let cam;
  for (let round = 0; round < 3; round++) {
    const pos = [target[0] + dir[0] * distance, eyeHeight, target[2] + dir[2] * distance];
    cam = await page.evaluate(
      ({ pos, target, pts, VFOV, ASPECT }) => {
        const T = window.stage.THREE;
        const c = new T.PerspectiveCamera(VFOV, ASPECT, 0.02, 100);
        c.position.set(...pos);
        c.lookAt(new T.Vector3(...target));
        c.updateMatrixWorld(true);
        let ymin = 1;
        let ymax = -1;
        let xmin = 1;
        let xmax = -1;
        const v = new T.Vector3();
        for (const p of pts) {
          v.set(...p).project(c);
          ymin = Math.min(ymin, v.y);
          ymax = Math.max(ymax, v.y);
          xmin = Math.min(xmin, v.x);
          xmax = Math.max(xmax, v.x);
        }
        return { p: pos, q: c.quaternion.toArray(), ymin, ymax, xmin, xmax };
      },
      { pos, target, pts: measured.pts, VFOV, ASPECT },
    );
    // keep the figure's height at 1 - 2 * MARGIN of the frame
    const used = (cam.ymax - cam.ymin) / 2;
    distance *= used / (1 - 2 * MARGIN);
  }
  fits.clips["idle-standing"] = {
    note: "no recording: a static camera made for the whole figure (fit/standing.mjs)",
    static: {
      p: cam.p.map((v) => Math.round(v * 1e5) / 1e5),
      q: cam.q.map((v) => Math.round(v * 1e6) / 1e6),
    },
    vfov: VFOV,
  };
  fs.writeFileSync(path.join(HERE, "cameras", "fits.json"), JSON.stringify(fits, null, 1));
  console.log(JSON.stringify({ top, bottom, cam }));
  const tiles = [];
  for (const t of [0, clip / 3, (2 * clip) / 3, clip]) {
    const png = await page.evaluate(
      ({ t, cam, VFOV }) => {
        window.stage.pose("m", "idle-standing", t);
        return window.stage.shot({
          width: 960,
          height: 432,
          pos: cam.p,
          quaternion: cam.q,
          vfov: VFOV,
        });
      },
      { t, cam, VFOV },
    );
    tiles.push({ png: pngBytes(png), label: `idle-standing ${t.toFixed(2)} s, its camera` });
  }
  writeWhole(
    path.join(WORK, "idle-standing-camera.png"),
    await contactSheet(tiles, { columns: 2, width: 960, height: 432 }),
  );
} finally {
  await stage.close();
}
