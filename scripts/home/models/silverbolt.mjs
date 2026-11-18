// Silverbolt: raw export from Blender, then the rig, the clips, the pictures and the size pass.
import fs from "node:fs";
import path from "node:path";
import { LOADER, boneTable, clipTable, writeFacts } from "./lib/facts.mjs";
import { fail, runBlender, workDir, writeWhole } from "./lib/env.mjs";
import {
  compressGeometry,
  compressTextures,
  makeIO,
  stripMaterialExtensions,
} from "./lib/optimize.mjs";
import { buildAnimations, normalizeRig } from "./lib/rig.mjs";
import {
  dominantJoint,
  extractPrimitive,
  removeTriangles,
  triangleCentre,
  triangles,
} from "./lib/split.mjs";
import { check } from "./verify/silverbolt-check.mjs";

const NAME = "silverbolt";
/** The clips and the names the page uses. The source's own spelling (`intercation`) is kept in
 * the clip name; the facts file lists the clean alias. */
const CLIP_LOOPS = ["idle", "idle_BP", "interaction_R_loop"];
const CLIP_NAME = (clip) => `city_${clip}`;
const CLIP_ALIAS = {
  idle: "idle",
  idle_BP: "idle_standing",
  interaction_R_loop: "hands_to_mouth_loop",
  intercation03: "interaction_03",
  action: "flight_path",
};

// The two gem regions of the picture (u0, v0, u1, v1; glTF v, counted from the top), found on the
// atlas and checked by drawing the selection: the eye almonds inside the gold frames (14
// triangles a side, on the head bone) and the big crystals on the cheek blades (27 a side).
// Blender counts v from the bottom of the picture and glTF from the top: v is 1 - v.
const EYE_UV = [0.115, 0.2, 0.18, 0.43];
const CRYSTAL_UV = [0.115, 0.0, 0.205, 0.23];
const inBox = (uv, box) => uv[0] >= box[0] && uv[0] <= box[2] && uv[1] >= box[1] && uv[1] <= box[3];
/** How far the dark socket sits behind the gem, in metres of the rest pose. */
const SOCKET_DEPTH = 0.0025;

/** Cuts the eye gems and the cheek crystals out of the head into their own primitives. */
function splitHead(doc) {
  const root = doc.getRoot();
  const mesh = root.listMeshes().find((m) => m.getName().endsWith("abyssal_devil_01"));
  const prim = mesh.listPrimitives()[0];
  const joints = root
    .listSkins()[0]
    .listJoints()
    .map((n) => n.getName());
  const jointOf = (name) => {
    const i = joints.indexOf(name);
    if (i < 0) fail(`the skin has no joint ${name}`);
    return i;
  };
  const indices = triangles(prim);
  const eyes = [];
  const crystals = [];
  for (let t = 0; t < indices.length / 3; t++) {
    const uv = triangleCentre(prim, "TEXCOORD_0", t, indices);
    const dominant = joints[dominantJoint(prim, t, indices)];
    if (inBox(uv, EYE_UV) && dominant === "Bone02_She_01") eyes.push(t);
    else if (inBox(uv, CRYSTAL_UV) && /She_0[56]$/.test(dominant)) crystals.push(t);
  }
  const ribbon = root.listMeshes().find((m) => m.getName().endsWith("abyssal_devil_02"));
  ribbon.listPrimitives()[0].getMaterial().setName("silverbolt_ribbon");
  ribbon.setName("silverbolt_ribbon");
  mesh.setName("silverbolt_head");
  for (const node of root.listNodes()) {
    if (node.getMesh() === mesh) node.setName("silverbolt_head");
    if (node.getMesh() === ribbon) node.setName("silverbolt_ribbon");
  }
  const body = prim.getMaterial().setName("silverbolt_body");
  const picture = body.getBaseColorTexture();
  const glowing = (name, glow) => {
    const material = body.clone().setName(name).setEmissiveFactor(glow);
    material.setEmissiveTexture(picture);
    return material;
  };
  const gem = glowing("silverbolt_gem", [0.55, 0.55, 0.6]);
  const crystal = glowing("silverbolt_crystal", [0.4, 0.4, 0.45]);
  const socket = doc
    .createMaterial("silverbolt_socket")
    .setBaseColorFactor([0.8, 0.82, 0.92, 1])
    .setRoughnessFactor(0.5)
    .setMetallicFactor(0)
    .setDoubleSided(true);

  const eyeJoint = { L: jointOf("sb_eye_L"), R: jointOf("sb_eye_R") };
  const head = jointOf("Bone02_She_01");
  const setJoint = (a, v, joint) => {
    a.JOINTS_0.array.set([joint, 0, 0, 0], v * 4);
    a.WEIGHTS_0.array.set(
      a.WEIGHTS_0.array instanceof Float32Array ? [1, 0, 0, 0] : [255, 0, 0, 0],
      v * 4,
    );
  };
  const eyePrim = extractPrimitive(doc, prim, eyes, gem, (a, count) => {
    for (let v = 0; v < count; v++)
      setJoint(a, v, a.POSITION.array[v * 3] > 0 ? eyeJoint.L : eyeJoint.R);
  });
  const socketPrim = extractPrimitive(doc, prim, eyes, socket, (a, count) => {
    for (let v = 0; v < count; v++) {
      for (let c = 0; c < 3; c++)
        a.POSITION.array[v * 3 + c] -= a.NORMAL.array[v * 3 + c] * SOCKET_DEPTH;
      setJoint(a, v, head);
    }
    for (const semantic of Object.keys(a)) if (semantic.startsWith("TEXCOORD")) delete a[semantic];
  });
  const crystalPrim = extractPrimitive(doc, prim, crystals, crystal);
  removeTriangles(prim, [...eyes, ...crystals]);
  mesh.addPrimitive(eyePrim).addPrimitive(socketPrim).addPrimitive(crystalPrim);
  return { eyeTriangles: eyes.length, crystalTriangles: crystals.length };
}

export async function build({ out, work, renders, skipBlender = false } = {}) {
  work ??= workDir(NAME);
  if (!skipBlender) runBlender("silverbolt.py", { work });
  const bake = JSON.parse(fs.readFileSync(path.join(work, "silverbolt.bake.json"), "utf8"));
  const io = makeIO();
  const doc = await io.read(path.join(work, "silverbolt.raw.glb"));

  const rigCheck = normalizeRig(doc, bake);
  if (rigCheck.worstTranslation > 1e-4 || rigCheck.worstRotation > 1e-5) {
    fail(`rest nodes differ from the bake: ${JSON.stringify(rigCheck)}`);
  }
  stripMaterialExtensions(doc);
  const split = splitHead(doc);
  if (split.eyeTriangles !== 28 || split.crystalTriangles !== 54) {
    fail(`the gem regions changed: ${JSON.stringify(split)}`);
  }
  const names = Object.fromEntries(Object.keys(bake.clips).map((c) => [c, CLIP_NAME(c)]));
  const clipReport = buildAnimations(doc, bake, { names, loops: CLIP_LOOPS });
  for (const [clip, info] of Object.entries(clipReport)) {
    if (info.frames !== bake.clips[clip].frames) fail(`${clip}: frame count changed`);
    if (CLIP_LOOPS.includes(clip) && (info.loopGap > 8e-3 || info.loopGapRotation > 3e-4)) {
      fail(`${clip}: first and last key differ (${info.loopGap} m)`);
    }
  }

  const textureReport = await compressTextures(doc, [
    [/weapon01_d/, { size: 512, quality: 88 }],
    [/weapon01_n5x5/, { size: 256, quality: 80 }],
    [/fx01_d/, { size: 256, quality: 90 }],
  ]);
  await compressGeometry(doc);
  const pre = path.join(work, "silverbolt.pre.glb");
  writeWhole(pre, await io.writeBinary(doc));

  // Loaded back in Chrome with the site's own three: checked, measured, drawn.
  const checked = await check({
    glb: pre,
    bake,
    renders: renders ?? path.join(work, "renders"),
    loops: CLIP_LOOPS,
  });
  const facts = assemble(bake, checked, split, clipReport);
  doc.getRoot().listScenes()[0].setExtras({ home: facts });
  const bytes = await io.writeBinary(doc);
  const file = path.join(out ?? path.join(work, "out"), `${NAME}.glb`);
  writeWhole(file, bytes);
  await writeFacts(path.join(path.dirname(file), `${NAME}.facts.json`), facts);
  console.log(NAME, "bytes", bytes.byteLength);
  return { file, bytes: bytes.byteLength, facts, textureReport, bake };
}

function assemble(bake, checked, split, clipReport) {
  const m = checked.measured;
  const segment = (name) => {
    const a = bake.restLocal[name];
    return Math.round(Math.hypot(a[0], a[1], a[2]) * 1e4) / 1e4;
  };
  return {
    model: NAME,
    schema: 1,
    space:
      "glTF world: metres, Y up. The head faces +Z and the tail trails toward -Z. This is the space cameras.json is in. Bones hang on the scene root (no armature node) and every local transform is a plain armature-space transform.",
    loader: LOADER,
    sizes: {
      restLength: "about 3.5 m from the snout to the tail tip in the rest pose",
      clipScale:
        "every source clip scales the whole dragon through D_she_root: 0.4 in the loops, 0.4 to 0.64 in interaction_03, 0.105 to 1 in flight_path",
    },
    meshes: {
      head: {
        material: "silverbolt_body",
        note: "armour, horns, jaw, tongue, wing blades. Opaque, double sided.",
      },
      eyes: {
        material: "silverbolt_gem",
        note: "the two eye almonds, skinned to sb_eye_L and sb_eye_R. Scale the eye bones in Y to blink. Emissive (the picture itself): drive material.emissiveIntensity for a glow.",
      },
      socket: {
        material: "silverbolt_socket",
        note: "a flat silver backing 2.5 mm behind each eye gem, on the head bone. It shows when the gem is squashed, so a shut eye reads as a lid and the head never shows through.",
      },
      crystals: {
        material: "silverbolt_crystal",
        note: "the big cheek crystals (cheek blades She_05 and She_06). Emissive, for a glow that follows a mood.",
      },
      ribbon: {
        material: "silverbolt_ribbon",
        note: "the flame tail and the body. Alpha blended, double sided.",
      },
      triangles: split,
    },
    render: {
      ribbon: {
        transparent: true,
        depthWrite: false,
        side: "DoubleSide",
        renderOrder:
          "draw it after the head (renderOrder 1 against 0); the loader already sets transparent and depthWrite false",
      },
      head: "opaque; set frustumCulled = false on every skinned mesh (the quantised bounds are not the pose's)",
      lighting:
        "the pictures are painted with the light in them: under MeshBasicMaterial with no lights the model reads well (silverbolt-angles.png), under MeshStandardMaterial with one environment map it reads better. Metalness and roughness are the exporter's defaults; envMapIntensity 0.6 to 1 against a bright ground.",
    },
    root: {
      bone: "D_she_root",
      note: "the body root. Clips key its translation in world metres and its uniform scale. Move and scale the dragon with a parent Group; drive this bone only if you play no clip.",
    },
    head: {
      bone: "Bone02_She_01",
      note: "turn this bone to look at things. Its children (jaw, cheek blades, crest, tongue, eyes) follow.",
    },
    jaw: {
      ...m.jaw,
      restAngle: 0,
      closedAngle: -0.3,
      openMax: 1.0,
      note: "As modelled the mouth is a little open (angle 0). Angles below about -0.3 push the lower jaw through the snout. Open to 1.0 for a wide mouth. gaps: the distance in metres between the front of the upper jaw and the front of the lower jaw at rest scale (it never reaches 0 because it measures between two centres): multiply by the dragon's scale (0.4 in the clips) to compare with the doll.",
    },
    eyes: {
      ...m.eyes,
      centre: { sb_eye_L: [0.108, 3.576, 0.151], sb_eye_R: [-0.108, 3.576, 0.151] },
      note: "sb_eye_L is on the +X side. Blink: scale.y 1 to 0.06 and back in about 120 ms on both bones, with material emissiveIntensity dipping with it.",
    },
    tongue: m.tongue,
    wings: {
      note: "raise: the local axis (sign included) that a positive angle turns about to lift the blade tip. spread: the same for moving the tip away from the body line. Left and right come out with opposite signs by themselves. She_08 is the root of the six blades.",
      root: "Bone02_She_08",
      pairs: [
        ["Bone02_She_13", "Bone02_She_14"],
        ["Bone02_She_15", "Bone02_She_16"],
        ["Bone02_She_17", "Bone02_She_18"],
      ],
      cheekBlades: ["Bone02_She_05", "Bone02_She_06"],
      crest: "Bone02_She_07",
      bones: m.blades,
    },
    tail: {
      ...m.tail,
      segmentLengths: m.tail.chain.slice(1).map(segment),
      yawAxisLocal: [0, 0, 1],
      note: "A chain: She_09 hangs on D_she_root, each bone on the one before, each aimed at the next (local +Y), local +X across the tail, +Z up. segmentLengths are between joints. Drive it with FABRIK on the heads, or spring each bone's rotation about pitchAxisLocal and yawAxisLocal.",
    },
    clips: clipTable(bake, {
      alias: CLIP_ALIAS,
      loops: CLIP_LOOPS,
      names: CLIP_NAME,
      rootBone: "D_she_root",
    }),
    clipNote:
      "Durations are (frames - 1) / 24 s: a clip ends on its last key. The loops end on their first key exactly, so wrap by the duration. The names keep the source's spelling (intercation).",
    bones: boneTable(bake),
    checks: {
      ...bake.checks,
      materials: checked.materials.map((x) => x[0]),
      worstHeadErrorMetres: Math.round(checked.worstHeadError * 1e5) / 1e5,
      loopGapMetres: Object.fromEntries(
        CLIP_LOOPS.map((c) => [CLIP_NAME(c), Math.round(clipReport[c].loopGap * 1e5) / 1e5]),
      ),
    },
  };
}
