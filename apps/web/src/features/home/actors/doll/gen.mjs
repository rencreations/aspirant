// Generates the data modules of the doll actor from the asset sources:
//   face/shader.ts  <- scripts/home/models/doll/face/face.glsl
//   face/presets.ts <- scripts/home/models/doll/face/presets.json
//   pose/poses.ts   <- scripts/home/models/doll/poses.json
//   rig.ts          <- apps/web/public/models/home/doll-rig.json
// Run from the repository root:
//   node apps/web/src/features/home/actors/doll/gen.mjs
//   npx prettier --write apps/web/src/features/home/actors/doll
// The actor's own poses (the hang) live in hang.ts, not here, so they survive a run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(OUT, "../../../../../../..");
const SRC = path.join(REPO, "scripts/home/models/doll");

const HEADER = (what, from) =>
  `// GENERATED from ${from}. ${what}
// Regenerate with gen.mjs in this folder. Do not edit by hand.
`;

function write(rel, text) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  process.stdout.write(`wrote ${rel} ${text.length}
`);
}

// ---- the face shader ----
{
  const text = fs.readFileSync(path.join(SRC, "face/face.glsl"), "utf8");
  const sections = {};
  let name = null;
  for (const line of text.split("\n")) {
    const m = /^\/\/ @section (\S+)/.exec(line);
    if (m) {
      name = m[1];
      sections[name] = [];
    } else if (name) {
      // Drop whole-line comments and blank lines: they are for the reader of the source, not the GPU.
      if (/^\s*\/\//.test(line) || line.trim() === "") continue;
      sections[name].push(line.replace(/\s+\/\/ .*$/, "").replace(/\s+$/, ""));
    }
  }
  const out = [
    HEADER(
      "The doll's face, drawn in the doll's own material (four chunks).",
      "scripts/home/models/doll/face/face.glsl",
    ),
  ];
  const consts = {
    "vertex-head": "FACE_VERTEX_HEAD",
    "vertex-body": "FACE_VERTEX_BODY",
    "fragment-head": "FACE_FRAGMENT_HEAD",
    "fragment-map": "FACE_FRAGMENT_MAP",
  };
  for (const [key, constName] of Object.entries(consts)) {
    const lines = sections[key];
    if (!lines?.length) throw new Error(`missing section ${key}`);
    out.push(
      `export const ${constName} = [\n${lines.map((l) => `  ${JSON.stringify(l)},`).join("\n")}\n].join("\\n");\n`,
    );
  }
  write("face/shader.ts", out.join("\n"));
}

// ---- the presets ----
{
  const p = JSON.parse(fs.readFileSync(path.join(SRC, "face/presets.json"), "utf8"));
  const out = [
    HEADER(
      "The 55 floats of the face and the 24 expressions (only what differs from the defaults).",
      "scripts/home/models/doll/face/presets.json",
    ),
  ];
  out.push(`export const FACE_FLOATS = ${JSON.stringify(p.names)} as const;\n`);
  out.push(`export type FaceFloat = (typeof FACE_FLOATS)[number];\n`);
  out.push(
    `export const FACE_DEFAULTS: Readonly<Record<FaceFloat, number>> = ${JSON.stringify(p.defaults)};\n`,
  );
  const names = Object.keys(p.presets);
  out.push(`export const FACE_NAMES = ${JSON.stringify(names)} as const;\n`);
  out.push(`export type FaceName = (typeof FACE_NAMES)[number];\n`);
  const diffs = {};
  for (const n of names) {
    const d = {};
    for (const k of p.names)
      if (Math.abs(p.presets[n][k] - p.defaults[k]) > 1e-9) d[k] = p.presets[n][k];
    diffs[n] = d;
  }
  out.push(
    `/** Each expression as the floats that differ from \`FACE_DEFAULTS\` (the neutral face is the defaults). */\nexport const FACE_DIFFS: Readonly<Record<FaceName, Readonly<Partial<Record<FaceFloat, number>>>>> = ${JSON.stringify(diffs)};\n`,
  );
  out.push(
    `/** Where the face is, in bind metres (see \`doll-rig.json\`): x, y of the middle of the eyes, the unit, the roll of the eye line. */\nexport const FACE_FRAME = ${JSON.stringify([0.01025, 0.898, 0.1, 0.07307])} as const;\n`,
  );
  write("face/presets.ts", out.join("\n"));
}

// ---- the poses ----
{
  const p = JSON.parse(fs.readFileSync(path.join(SRC, "poses.json"), "utf8"));
  const out = [
    HEADER(
      "The poses of the doll as turns about the model's axes (degrees), in the parent's bind frame.",
      "scripts/home/models/doll/poses.json",
    ),
  ];
  out.push(
    `export interface PoseDef {\n  /** Turns in degrees about the model's X, Y, Z (Euler XYZ), by bone. */\n  readonly turns: Readonly<Record<string, readonly [number, number, number]>>;\n  /** An offset of the root bone in the file's units (metres of the 1.7 m doll). */\n  readonly hips?: readonly [number, number, number];\n  readonly scales?: Readonly<Record<string, readonly [number, number, number]>>;\n}\n`,
  );
  const names = Object.keys(p.poses);
  out.push(`export const POSE_NAMES = ${JSON.stringify(names)} as const;\n`);
  out.push(`export type PoseName = (typeof POSE_NAMES)[number];\n`);
  const defs = {};
  for (const n of names) {
    const d = p.poses[n];
    defs[n] = {
      turns: d.turns,
      ...(d.hips ? { hips: d.hips } : {}),
      ...(d.scales ? { scales: d.scales } : {}),
    };
  }
  out.push(`export const POSES: Readonly<Record<PoseName, PoseDef>> = ${JSON.stringify(defs)};\n`);
  write("pose/poses.ts", out.join("\n"));
}

// ---- the rig ----
{
  const r = JSON.parse(
    fs.readFileSync(path.join(REPO, "apps/web/public/models/home/doll-rig.json"), "utf8"),
  );
  const out = [
    HEADER(
      "The bind pose of the doll's 22 bones, the sockets and the facts the actor needs.",
      "apps/web/public/models/home/doll-rig.json",
    ),
  ];
  const bones = Object.entries(r.bones).map(([name, b]) => ({
    name,
    parent: b.parent,
    q: b.localQuaternion,
    p: b.localPosition,
    world: b.bindWorld,
  }));
  out.push(
    `export interface RigBone {\n  readonly name: string;\n  readonly parent: string | null;\n  /** The rest rotation in the parent's frame: x, y, z, w. */\n  readonly q: readonly [number, number, number, number];\n  /** The rest position in the parent's frame (the file's metres). */\n  readonly p: readonly [number, number, number];\n  /** The bind position in the file's frame. */\n  readonly world: readonly [number, number, number];\n}\n`,
  );
  out.push(
    `/** Parents come before children. */\nexport const RIG_BONES: readonly RigBone[] = ${JSON.stringify(bones)};\n`,
  );
  out.push(`export const DOLL_HEIGHT = ${r.heightMetres};\n`);
  out.push(
    `/** The planted foot goes back at this speed (file units per second) when \`walk\` plays at rate 1. */\nexport const WALK_SPEED = ${r.walk.speedMetresPerSecond};\nexport const WALK_SECONDS = ${r.walk.seconds};\n`,
  );
  out.push(
    `export const FACE_POINTS = ${JSON.stringify({ eyeRed: r.face.eyeRed.centre, eyeBlue: r.face.eyeBlue.centre, mouth: r.face.mouth.centre, browY: r.face.browY, chinY: r.face.chinY })} as const;\n`,
  );
  write("rig.ts", out.join("\n"));
}
