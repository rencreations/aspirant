// The sticker's anchor (extras.sticker) and its check pictures.
//
//   node verify/sticker.mjs [--file GLB] [--find]
//
// --find measures the anchor and prints it (the numbers then go into sticker.mjs): the idle clip
// at four times, from three angles that look at her bottom (behind, which is the angle of the
// owner's screenshot, behind and below, and below), drawn in its base colour. Every pixel of the
// part to cover is followed back onto the posed mesh: the shorts (dark or wine red, on body_01)
// and the bare skin between them and the stockings (pale pink, on any mesh). The points within
// 20 cm of the pelvis are written in the pelvis bone's own space; their middle is the point (it
// lies under the surface, so a disc that faces the camera there is centred on the bottom from
// every one of these angles), their plane gives the normal (turned toward the side the cameras
// look from), and the radius takes in 85
// percent of them (the rest are stray texels of the legs). `surface` is where the normal through
// the middle leaves the body.
//
// Without --find the anchor of sticker.mjs is drawn: a disc of its radius at its point, facing
// the camera, over Selena in the idle clip, from the same three angles at four times of the loop,
// next to the same view without it. The disc is drawn without a depth test (the point is inside
// the body), as the room must draw the sticker.
import path from "node:path";
import { createRequire } from "node:module";
import { STICKER } from "../sticker.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { REPO, WORK, option, writeWhole } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const sharp = createRequire(path.join(REPO, "package.json"))("sharp");
const TIMES = [0, 0.7, 1.4, 2.1];
/** Where the views look: the bottom's middle at 0 s, measured once (world, metres). */
const AIM = [-0.104, 0.838, -0.02];
const VIEWS = {
  "behind (the owner's screenshot)": [0, -0.1, -1],
  "behind and below": [0.1, -0.75, -0.65],
  below: [0, -1, -0.2],
};

function view(dir, target = AIM, distance = 1.7) {
  const l = Math.hypot(...dir);
  return { pos: target.map((v, k) => v + (dir[k] / l) * distance), target };
}

/** Browser side: our picture and the world position under each pixel, through one camera. */
function shotWithPositions({ cam, time, only }) {
  const S = window.stage;
  S.pose("m", "idle", time);
  S.visible("m", only);
  const png = S.shot({ width: 400, height: 400, pos: cam.pos, target: cam.target, vfov: 40 });
  const pos = S.positions("m");
  const inverse = S.models.m.bones.Bip001_Pelvis.matrixWorld.clone().invert();
  return { png, pos, inverse: inverse.elements };
}

/** Pixels of a class, as points in the pelvis bone's space within `near` metres of it. */
async function classPoints(shot, keep, near = 0.2) {
  const { data } = await sharp(pngBytes(shot.png)).raw().toBuffer({ resolveWithObject: true });
  const xyz = new Float32Array(Buffer.from(shot.pos.data, "base64").buffer.slice(0));
  const e = shot.inverse; // column major
  const out = [];
  for (let y = 0; y < 400; y += 2) {
    for (let x = 0; x < 400; x += 2) {
      const i = (y * 400 + x) * 4;
      if (xyz[i + 3] < 0.5 || !keep(data[i], data[i + 1], data[i + 2])) continue;
      const [wx, wy, wz] = [xyz[i], xyz[i + 1], xyz[i + 2]];
      const p = [
        e[0] * wx + e[4] * wy + e[8] * wz + e[12],
        e[1] * wx + e[5] * wy + e[9] * wz + e[13],
        e[2] * wx + e[6] * wy + e[10] * wz + e[14],
      ];
      if (Math.hypot(...p) < near) out.push(p);
    }
  }
  return out;
}

const luma = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
/** The shorts: dark or wine red. */
const SHORTS = (r, g, b) => luma(r, g, b) < 70 || (r > 2 * g && luma(r, g, b) < 130);
/** Bare skin: pale pink. */
const SKIN = (r, g, b) => r > 190 && g > 150 && r >= g && r - b > 12;

async function find(page) {
  const points = [];
  const classes = [];
  const eyes = [];
  let skinPoints = 0;
  for (const time of TIMES) {
    for (const dir of Object.values(VIEWS)) {
      const cam = view(dir);
      const shorts = await page.evaluate(shotWithPositions, { cam, time, only: ["body_01"] });
      const dark = await classPoints(shorts, SHORTS);
      points.push(...dark);
      const all = await page.evaluate(shotWithPositions, { cam, time, only: null });
      const skin = await classPoints(all, SKIN);
      skinPoints += skin.length;
      points.push(...skin);
      classes.push({ time, dir, dark, skin });
      const e = all.inverse;
      const [x, y, z] = cam.pos;
      eyes.push([
        e[0] * x + e[4] * y + e[8] * z + e[12],
        e[1] * x + e[5] * y + e[9] * z + e[13],
        e[2] * x + e[6] * y + e[10] * z + e[14],
      ]);
    }
  }
  await page.evaluate(() => window.stage.visible("m", null));
  writeWhole(path.join(WORK, "work", "sticker-points.json"), JSON.stringify(classes));
  const c = [0, 1, 2].map((k) => points.reduce((a, p) => a + p[k], 0) / points.length);
  const n = smallestAxis(points, c);
  // Outward is the side the measuring cameras look from.
  const side = eyes.reduce(
    (a, eye) => a + [0, 1, 2].reduce((b, k) => b + (eye[k] - c[k]) * n[k], 0),
    0,
  );
  if (side < 0) n.forEach((v, k) => (n[k] = -v));
  const along = (p) => (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2];
  const across = (p) => {
    const h = along(p);
    return Math.hypot(...[0, 1, 2].map((k) => p[k] - c[k] - h * n[k]));
  };
  const surface = Math.max(...points.filter((p) => across(p) < 0.03).map(along));
  const radii = points.map(across).sort((a, b) => a - b);
  const r = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    points: points.length,
    skinPoints,
    offset: c.map((v) => r(v)),
    surface: c.map((v, k) => r(v + n[k] * surface)),
    normal: n.map((v) => r(v)),
    radius: r(radii[Math.floor(radii.length * 0.85)], 2),
    spread: {
      p70: r(radii[Math.floor(radii.length * 0.7)], 3),
      p80: r(radii[Math.floor(radii.length * 0.8)], 3),
      p85: r(radii[Math.floor(radii.length * 0.85)], 3),
      p90: r(radii[Math.floor(radii.length * 0.9)], 3),
      max: r(radii[radii.length - 1], 3),
    },
  };
}

/** The axis of least spread of points about c (the normal of their plane), by power iteration. */
function smallestAxis(points, c) {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = [0, 1, 2].map((k) => p[k] - c[k]);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j];
  }
  const trace = C[0][0] + C[1][1] + C[2][2];
  // The largest axis of (trace I - C) is the smallest of C.
  const M = C.map((row, i) => row.map((v, j) => (i === j ? trace : 0) - v));
  let v = [0.3, -0.9, 0.1];
  for (let it = 0; it < 200; it++) {
    const w = M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
    const l = Math.hypot(...w);
    v = w.map((x) => x / l);
  }
  return v;
}

/** Browser side: the sticker's world point at a time of its clip. */
function anchorAt({ sticker, time }) {
  const S = window.stage;
  const T = S.THREE;
  S.pose("m", sticker.clip, time);
  const bone = S.models.m.bones[sticker.bone];
  return new T.Vector3(...sticker.offset).applyMatrix4(bone.matrixWorld).toArray();
}

export async function stickerViews({ file, out, sticker = STICKER }) {
  const stage = await openStage({ model: file });
  const { page } = stage;
  try {
    const info = await page.evaluate(async () => {
      await window.stage.load("m", "/file/model");
      window.stage.look("m", "unlit");
      window.stage.setBackground(0xeceef2);
      const b = window.stage.models.m.bones.Bip001_Pelvis;
      return { scale: b.getWorldScale(new window.stage.THREE.Vector3()).toArray() };
    });
    if (option("find")) {
      const found = await find(page);
      console.log(JSON.stringify({ ...found, boneWorldScale: info.scale }));
      return found;
    }
    const tiles = [];
    for (const time of TIMES) {
      const p = await page.evaluate(anchorAt, { sticker, time });
      for (const [name, dir] of Object.entries(VIEWS)) {
        const cam = view(dir, p);
        for (const withDisc of [false, true]) {
          const png = await page.evaluate(
            ({ cam, p, radius, withDisc }) => {
              window.stage.disc("sticker", 0xff2d7a, radius, withDisc ? p : null, 0.8);
              return window.stage.shot({
                width: 640,
                height: 640,
                pos: cam.pos,
                target: cam.target,
                vfov: 40,
              });
            },
            { cam, p, radius: sticker.radius, withDisc },
          );
          tiles.push({
            png: pngBytes(png),
            label: `idle ${time.toFixed(1)} s, ${name}${withDisc ? `, disc ${sticker.radius} m` : ""}`,
          });
        }
      }
    }
    writeWhole(out, await contactSheet(tiles, { columns: 6, width: 320, height: 320 }));
    return { tiles: tiles.length, boneWorldScale: info.scale };
  } finally {
    await stage.close();
  }
}

if (process.argv[1] && path.basename(process.argv[1]) === "sticker.mjs") {
  const file = option("file", path.join(WORK, "work", "model.glb"));
  const out = path.join(WORK, "sticker-views.png");
  const result = await stickerViews({ file, out });
  if (!option("find")) console.log("wrote", out, JSON.stringify(result));
}
