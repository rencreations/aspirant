// The bunny build's check pictures and the checks that need the loaded file. Read the pictures
// after every build (README.md lists them).
const path = require("node:path");

const { TARGETS, fail, savePng } = require("./build.cjs");

const FRONT = [0, 0, 1];
const QUARTER = [0.75, 0.3, 1];
const OTHER = [-0.75, 0.3, 1];
const SIDE = [1, 0, 0];
const BACK = [0, 0, -1];
const BACK_QUARTER = [0.8, 0.35, -1];

/** One ear's turn, as the README gives it: splay out, fold forward, twist. Same numbers both sides. */
const ear = (side, splay = 0, fold = 0, twist = 0) => {
  const s = side === "L" ? -1 : 1;
  return [fold, s * twist, s * splay];
};
/** One foot's turn: swing about the pin (forward), splay out, twist. */
const foot = (side, swing = 0, splay = 0, twist = 0) => {
  const s = side === "L" ? -1 : 1;
  return [swing, s * twist, -s * splay];
};
const ears = (...a) => {
  const out = {};
  for (const side of ["L", "R"]) out[`ear_${side}_1`] = ear(side, ...a);
  return out;
};
const feet = (...a) => {
  const out = {};
  for (const side of ["L", "R"]) out[`foot_${side}`] = foot(side, ...a);
  return out;
};
/** A bend of an ear's upper two bones, about their own X (forward) and Z (out). */
const bend = (side, forward = 0, out = 0) => {
  const s = side === "L" ? -1 : 1;
  return { [`ear_${side}_2`]: [forward, 0, s * out], [`ear_${side}_3`]: [forward, 0, s * out] };
};

async function drawAll(page, { renders, report, loaded, made }) {
  const shoot = async (name, tiles, options) => {
    const png = await page.evaluate(([t, o]) => window.bunnyBuild.sheet(t, o), [tiles, options]);
    savePng(png, path.join(renders, name));
  };
  const checks = {};
  const origin = report.originInSource;

  // 1. The source as it is.
  await page.evaluate(() => window.bunnyBuild.loadFbx("/source/change.fbx", { which: "whole" }));
  await shoot(
    "source-whole.png",
    [{ label: "change.fbx, all of it", view: FRONT, target: [-0.3, 1.0, 0.3] }],
    {
      size: 640,
      cols: 1,
      across: 2.4,
    },
  );
  await page.evaluate(
    (o) => window.bunnyBuild.loadFbx("/source/change.fbx", { origin: o }),
    origin,
  );
  const sourceViews = [
    ["front", FRONT],
    ["three-quarter", QUARTER],
    ["side (+X)", SIDE],
    ["back", BACK],
  ];
  await shoot(
    "source.png",
    sourceViews.map(([label, view]) => ({ label: `source, ${label}`, view, outline: false })),
    { size: 420, cols: 4 },
  );
  for (const [label, view] of sourceViews) {
    await page.evaluate(
      ([k, v]) => window.bunnyBuild.capture(k, { view: v, outline: false }),
      [`source ${label}`, view],
    );
  }
  // The source's face, close up on the screen, for the face check.
  const screen = loaded.extras.screen;
  const faceView = { view: screen.normal, target: screen.centre, across: 0.3, outline: false };
  await page.evaluate((t) => window.bunnyBuild.capture("source face", t, 600), faceView);

  // 2. The built file.
  await page.evaluate(() => window.bunnyBuild.loadGlb("/build/bunny.glb"));
  await shoot(
    "views.png",
    [
      { label: "front", view: FRONT },
      { label: "three-quarter", view: QUARTER },
      { label: "side (+X, its left)", view: SIDE },
      { label: "back", view: BACK },
      { label: "the other three-quarter", view: OTHER },
      { label: "top", view: [0, 1, 0] },
      { label: "bottom", view: [0, -1, 0] },
      { label: "back three-quarter", view: BACK_QUARTER },
    ],
    { size: 420, cols: 4 },
  );

  // 3. Source against build, view by view: the same paint, nothing torn or left behind.
  checks.againstSource = [];
  for (const [label, view] of sourceViews) {
    await page.evaluate(
      ([k, v]) => window.bunnyBuild.capture(k, { view: v, outline: false }),
      [`built ${label}`, view],
    );
    const c = await page.evaluate(
      ([a, b]) => window.bunnyBuild.compare(a, b),
      [`source ${label}`, `built ${label}`],
    );
    checks.againstSource.push({ view: label, ...c });
  }
  const pairs = await page.evaluate(
    (labels) =>
      window.bunnyBuild.composite(
        labels.flatMap((l) => [
          [`source ${l}`, `source, ${l}`],
          [`built ${l}`, `built, ${l}`],
        ]),
      ),
    sourceViews.map(([label]) => label),
  );
  savePng(pairs, path.join(renders, "compare.png"));
  for (const c of checks.againstSource) {
    if (c.silhouetteMismatch > 0.02 || c.pixelsOver40 > 0.03) {
      fail(`the build does not look like the source from the ${c.view}: ${JSON.stringify(c)}`);
    }
  }

  // 4. The face against the source's painted face, close up.
  await page.evaluate(
    (t) => window.bunnyBuild.capture("built face", { ...t, face: "neutral" }, 600),
    faceView,
  );
  checks.face = await page.evaluate(() => window.bunnyBuild.compare("source face", "built face"));
  // The page's `neutral` must stay the source's face.
  if (checks.face.litOverlap < 0.8)
    fail(`neutral no longer matches the source's face: ${JSON.stringify(checks.face)}`);
  const faceSheet = await page.evaluate(() =>
    window.bunnyBuild.faceDiff("source face", "built face", [
      "the source's painted face",
      "neutral, drawn by face.ts",
      "both dark; red source only; blue face.ts only",
    ]),
  );
  savePng(faceSheet, path.join(renders, "face-source.png"));

  // 5. Every bone to both ends of its range.
  await shoot(
    "bones-ears.png",
    [
      { label: "rest", view: FRONT },
      { label: "ear_1 splay 60 (out)", view: FRONT, pose: { bones: ears(60) } },
      { label: "ear_1 splay -25 (in)", view: FRONT, pose: { bones: ears(-25) } },
      { label: "ear_1 fold 40 (forward)", view: SIDE, pose: { bones: ears(0, 40) } },
      { label: "ear_1 fold -60 (back)", view: SIDE, pose: { bones: ears(0, -60) } },
      { label: "ear_1 twist 45", view: FRONT, pose: { bones: ears(0, 0, 45) } },
      { label: "ear_1 twist -45", view: FRONT, pose: { bones: ears(0, 0, -45) } },
      {
        label: "ears 2 and 3 bend 35 forward",
        view: SIDE,
        pose: { bones: { ...bend("L", 35), ...bend("R", 35) } },
      },
      {
        label: "ears 2 and 3 bend -35 back",
        view: SIDE,
        pose: { bones: { ...bend("L", -35), ...bend("R", -35) } },
      },
      {
        label: "ears 2 and 3 bend 40 out",
        view: FRONT,
        pose: { bones: { ...bend("L", 0, 40), ...bend("R", 0, 40) } },
      },
      {
        label: "ears 2 and 3 bend -30 in",
        view: FRONT,
        pose: { bones: { ...bend("L", 0, -30), ...bend("R", 0, -30) } },
      },
      {
        label: "a flop: left 1 out 30, 2 and 3 out 45",
        view: FRONT,
        pose: { bones: { ear_L_1: ear("L", 30), ...bend("L", 0, 45) } },
      },
      {
        label: "only ear_3 forward 60",
        view: SIDE,
        pose: { bones: { ear_L_3: [60, 0, 0], ear_R_3: [60, 0, 0] } },
      },
      { label: "fold 40, three-quarter", view: QUARTER, pose: { bones: ears(0, 40) } },
      { label: "fold -60, back three-quarter", view: BACK_QUARTER, pose: { bones: ears(0, -60) } },
      { label: "splay 60, back", view: BACK, pose: { bones: ears(60) } },
    ],
    { size: 360, cols: 4 },
  );
  await shoot(
    "bones-feet.png",
    [
      { label: "rest, front", view: FRONT },
      { label: "rest, side", view: SIDE },
      { label: "swing 70 (forward)", view: SIDE, pose: { bones: feet(70) } },
      { label: "swing -70 (back)", view: SIDE, pose: { bones: feet(-70) } },
      { label: "swing 70, front", view: FRONT, pose: { bones: feet(70) } },
      { label: "splay 30 (out)", view: FRONT, pose: { bones: feet(0, 30) } },
      { label: "splay -15 (in)", view: FRONT, pose: { bones: feet(0, -15) } },
      { label: "twist 40", view: FRONT, pose: { bones: feet(0, 0, 40) } },
      { label: "twist -40", view: FRONT, pose: { bones: feet(0, 0, -40) } },
      { label: "a wave: left swing 110", view: FRONT, pose: { bones: { foot_L: foot("L", 110) } } },
      {
        label: "a wave: left swing 110, side",
        view: SIDE,
        pose: { bones: { foot_L: foot("L", 110) } },
      },
      { label: "tucked: swing -100", view: QUARTER, pose: { bones: feet(-100) } },
    ],
    { size: 360, cols: 4 },
  );
  await shoot(
    "bones-body.png",
    [
      { label: "body yaw 40", view: FRONT, pose: { bones: { body: [0, 40, 0] } } },
      { label: "body pitch 25 (nose down)", view: FRONT, pose: { bones: { body: [25, 0, 0] } } },
      { label: "body pitch -25", view: FRONT, pose: { bones: { body: [-25, 0, 0] } } },
      { label: "body roll 25", view: FRONT, pose: { bones: { body: [0, 0, 25] } } },
    ],
    { size: 360, cols: 4 },
  );

  // 6. Every target at a half and at one.
  const viewOf = (t) =>
    /fold|curl|perk|lens/.test(t)
      ? t === "lens_out"
        ? BACK_QUARTER
        : SIDE
      : /pods/.test(t)
        ? [0, 1, 0]
        : FRONT;
  await shoot(
    "targets.png",
    TARGETS.flatMap((t) => [
      { label: `${t} 0.5`, view: viewOf(t), pose: { targets: { [t]: 0.5 } } },
      { label: `${t} 1`, view: viewOf(t), pose: { targets: { [t]: 1 } } },
    ]),
    { size: 300, cols: 6 },
  );
  await shoot(
    "targets-front.png",
    TARGETS.map((t) => ({ label: `${t} 1`, view: QUARTER, pose: { targets: { [t]: 1 } } })),
    { size: 300, cols: 6 },
  );
  // The brow and the face together, close up: the targets carry the face with the glass.
  await shoot(
    "targets-face.png",
    [
      { label: "neutral", ...faceView, outline: true, across: 0.36 },
      {
        label: "brow_down 1",
        ...faceView,
        outline: true,
        across: 0.36,
        pose: { targets: { brow_down: 1 } },
      },
      {
        label: "brow_up 1",
        ...faceView,
        outline: true,
        across: 0.36,
        pose: { targets: { brow_up: 1 } },
      },
      {
        label: "angry + brow_down",
        ...faceView,
        outline: true,
        across: 0.36,
        face: "angry",
        pose: { targets: { brow_down: 1 } },
      },
      {
        label: "squash 1",
        ...faceView,
        outline: true,
        across: 0.36,
        pose: { targets: { squash: 1 } },
      },
      {
        label: "stretch 1",
        ...faceView,
        outline: true,
        across: 0.36,
        pose: { targets: { stretch: 1 } },
      },
    ],
    { size: 360, cols: 3 },
  );

  // 7. Body targets with the ears and the feet turned: the hinge recipe keeps them on.
  const turned = [
    ["ears out", { ...ears(55) }],
    ["ears back", { ...ears(0, -55) }],
    ["feet swung", { ...feet(70) }],
  ];
  const bodyTargets = ["squash", "stretch", "puff", "lean_L"];
  const flop = {
    ...ears(30),
    ...bend("L", 0, 40),
    ...bend("R", 0, 40),
  };
  await shoot(
    "targets-bones.png",
    bodyTargets.flatMap((t) =>
      turned.map(([what, bones]) => ({
        label: `${t} 1, ${what}`,
        view: /back/.test(what) ? SIDE : FRONT,
        pose: { targets: { [t]: 1 }, bones },
      })),
    ),
    { size: 330, cols: 6 },
  );
  await shoot(
    "targets-bones-recipe.png",
    [
      {
        label: "squash, ears out: recipe",
        view: FRONT,
        pose: { targets: { squash: 1 }, bones: ears(60) },
      },
      {
        label: "squash, ears out: no shift",
        view: FRONT,
        pose: { targets: { squash: 1 }, bones: ears(60), shift: false },
      },
      { label: "lean_L, with the tilt", view: FRONT, pose: { targets: { lean_L: 1 } } },
      { label: "lean_L, no tilt", view: FRONT, pose: { targets: { lean_L: 1 }, tilt: false } },
      {
        label: "squash, ears flopped: recipe",
        view: FRONT,
        pose: { targets: { squash: 1 }, bones: flop },
      },
      {
        label: "squash, ears flopped: no shift",
        view: FRONT,
        pose: { targets: { squash: 1 }, bones: flop, shift: false },
      },
      { label: "lean_L, ears flopped", view: FRONT, pose: { targets: { lean_L: 1 }, bones: flop } },
      {
        label: "stretch, ears bent forward",
        view: SIDE,
        pose: { targets: { stretch: 1 }, bones: { ...bend("L", 35), ...bend("R", 35) } },
      },
    ],
    { size: 360, cols: 4 },
  );
  // The same in numbers, on real vertices: the tip of the left ear with all three of its bones
  // turned, and the tip of the left foot turned. Under a body target at 1 (no tilt) each tip must
  // land where it lands with no target, plus the shift of its hinge: the piece rides whole.
  checks.hinges = await page.evaluate(
    ([bodyTargets, extras]) => {
      const B = window.bunnyBuild;
      const out = {};
      const pieces = {
        ear_L_1: {
          tip: B.farVertex("ear_L_3", B.bindPlace("ear_L_1")),
          bones: { ear_L_1: [-30, 0, -40], ear_L_2: [35, 0, -30], ear_L_3: [35, 0, -30] },
        },
        foot_L: {
          tip: B.farVertex("foot_L", B.bindPlace("foot_L")),
          bones: { foot_L: [70, 0, 0] },
        },
      };
      for (const [bone, piece] of Object.entries(pieces)) {
        B.setPose({ bones: piece.bones });
        const base = B.vertexAt(piece.tip);
        for (const t of bodyTargets) {
          const want = base.map((v, k) => v + extras.hinges[t][bone].shift[k]);
          const miss = (pose) => {
            B.setPose(pose);
            return Math.hypot(...B.vertexAt(piece.tip).map((v, k) => v - want[k]));
          };
          const pose = { targets: { [t]: 1 }, bones: piece.bones, tilt: false };
          out[`${t} ${bone}`] = {
            recipe: +(miss(pose) * 1000).toFixed(4),
            withoutShift: +(miss({ ...pose, shift: false }) * 1000).toFixed(2),
          };
        }
      }
      B.setPose({});
      return out;
    },
    [loaded.extras.bodyTargets, loaded.extras],
  );
  for (const [what, c] of Object.entries(checks.hinges)) {
    if (c.recipe > 0.1) fail(`the hinge recipe misses by ${c.recipe} mm: ${what}`);
  }

  // 8. The faces.
  const names = loaded.faces;
  const close = { ...faceView, outline: true, across: 0.34 };
  await shoot(
    "faces.png",
    names.flatMap((name) => [
      { label: name, ...close, face: name },
      { label: `${name}, three-quarter`, view: QUARTER, face: name, across: 0.6 },
    ]),
    { size: 300, cols: 6 },
  );
  const steps = [0, 0.25, 0.5, 0.75, 1];
  await shoot(
    "faces-live.png",
    [
      ...steps.map((b) => ({ label: `blink ${b}`, ...close, live: { blinkL: b, blinkR: b } })),
      ...steps.map((b) => ({
        label: `happy, blink ${b}`,
        ...close,
        face: "happy",
        live: { blinkL: b, blinkR: b },
      })),
      { label: "blink the left eye", ...close, live: { blinkL: 1 } },
      { label: "look right (+x)", ...close, live: { lookX: 4 } },
      { label: "look left and up", ...close, live: { lookX: -4, lookY: 2 } },
      { label: "look down", ...close, live: { lookY: -3 } },
      { label: "dizzy, spin 2", ...close, face: "dizzy", live: { spin: 2 } },
      ...steps.map((t) => ({ label: `talk ${t}`, ...close, live: { talk: t } })),
      ...steps.map((t) => ({
        label: `singing, talk ${t}`,
        ...close,
        face: "singing",
        live: { talk: t },
      })),
      ...steps.map((t) => ({
        label: `neutral to happy ${t}`,
        ...close,
        face: { from: "neutral", to: "happy", t },
      })),
      ...steps.map((t) => ({
        label: `neutral to love ${t}`,
        ...close,
        face: { from: "neutral", to: "love", t },
      })),
      ...steps.map((t) => ({
        label: `angry to sad ${t}`,
        ...close,
        face: { from: "angry", to: "sad", t },
      })),
      ...steps.map((t) => ({ label: `lit ${t}`, ...close, live: { on: t } })),
      { label: "smooth (pixel 0)", ...close, live: { pixel: 0 } },
      { label: "pixel 0.5", ...close, live: { pixel: 0.5 } },
      { label: "glow 1", ...close, live: { glow: 1 } },
      { label: "love, glow 1", ...close, face: "love", live: { glow: 1 } },
      { label: "laugh, smooth", ...close, face: "laugh", live: { pixel: 0 } },
    ],
    { size: 240, cols: 5 },
  );
  // At the size the page may show it: the bunny about 150 pixels wide.
  await shoot(
    "faces-small.png",
    names.map((name) => ({ label: name, view: FRONT, face: name, across: 0.52 * (200 / 150) })),
    { size: 200, cols: 7 },
  );
  await shoot(
    "faces-small-quarter.png",
    names.map((name) => ({ label: name, view: QUARTER, face: name, across: 0.52 * (200 / 150) })),
    { size: 200, cols: 7 },
  );
  return checks;
}

module.exports = { drawAll };
