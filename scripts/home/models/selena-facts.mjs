// The facts file of Selena: what an actor needs to know about the model, written by the build.
import { LOADER, boneTable, clipTable } from "./lib/facts.mjs";

const sane = (name) => name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const round4 = (v) => Math.round(v * 1e4) / 1e4;

/** Spring bones as rows an actor can feed a verlet solver: bone, parent, rest length to the parent. */
export function springRows(bake, table, test) {
  return bake.bones.filter(test).map((name) => {
    const parent = bake.parent[name];
    return {
      bone: name,
      three: sane(name),
      parent,
      restLength: parent ? round4(dist3(table[name].restHead, table[parent].restHead)) : 0,
    };
  });
}

/** How far the last pose of clip `a` is from the first pose of clip `b`, over every bone head (metres). */
export function seamGap(bake, a, b) {
  const last = bake.clips[a].probe[String(bake.clips[a].frames - 1)];
  const first = bake.clips[b].probe["0"];
  let worst = 0;
  let sum = 0;
  for (const name of bake.bones) {
    const d = dist3(last[name], first[name]);
    worst = Math.max(worst, d);
    sum += d;
  }
  return { worst: round4(worst), mean: round4(sum / bake.bones.length) };
}

export function assemble({
  name,
  bake,
  checked,
  morphs,
  morphCost,
  clipReport,
  alias,
  loops,
  clipName,
}) {
  const table = boneTable(bake);
  const has = (re) => (n) => re.test(n);
  const hand = (side) => ({
    hand: `Bip001 ${side} Hand`,
    forearm: `Bip001 ${side} Forearm`,
    foreTwist: `Bip001 ${side} ForeTwist`,
    upperArm: `Bip001 ${side} UpperArm`,
    clavicle: `Bip001 ${side} Clavicle`,
    fingers: checked.fingers[side],
  });
  return {
    model: name,
    schema: 1,
    space:
      "glTF world: metres, Y up. She faces +Z in the rest pose. This is the space cameras.json is in. Bones hang on the scene root (no armature node); local transforms are plain armature-space transforms. `bones[name].three` is the name three.js gives a bone (spaces become underscores).",
    loader: LOADER,
    meshes: {
      head: {
        mesh: "selena_mesh_head",
        material: "selena_head",
        note: "skinned, with the face morph targets (see morphs)",
      },
      eye: {
        mesh: "selena_mesh_eye",
        material: "selena_eye",
        note: "the two eyeballs, skinned to Bone01_Eye_L_02 and Bone01_Eye_R_02. They stay in place under every face morph; the blink closes the lids over them.",
      },
      hair: [
        {
          mesh: "selena_mesh_hair_01",
          material: "selena_hair_01",
          note: "alpha blended by the picture's alpha, UV set 3 (the loader maps it)",
        },
        { mesh: "selena_mesh_hair_02", material: "selena_hair_02", note: "opaque, UV set 3" },
      ],
      body: [
        {
          mesh: "selena_mesh_body_01",
          material: "selena_body_01",
          note: "torso, arms, gloves, armour",
        },
        {
          mesh: "selena_mesh_body_02",
          material: "selena_body_02",
          note: "legs, skirt, boots, and the two floating white claws (Bip001 Prop1 and Prop2)",
        },
        {
          mesh: "selena_mesh_body_03_claws",
          material: "selena_body_03_claws",
          note: "skirt cloth and the claws' blades",
        },
      ],
    },
    render: {
      hair_01:
        "set material.depthWrite = true, material.alphaTest = 0.02, side DoubleSide, and draw it after the head (renderOrder 1). The loader gives it transparent = true and depthWrite = false, which sorts the fringe behind the face.",
      frustumCulled: "set false on every skinned mesh (the quantised bounds are not the pose's)",
      plainStandard:
        "The pictures are painted bright. Under MeshStandardMaterial keep the hemisphere light at 0.9 or less, one directional light at 1.2 or less and an environment at envMapIntensity 0.3 or less, or the skin and the hair blow out to white (selena-material.png, left).",
      recipe: {
        what: "selena-material.png (right) is the look the build recommends: MeshToonMaterial with the base picture and a 3 step gradientMap [105, 190, 255] (NearestFilter), a thin cool rim added before opaque_fragment (vec3(0.55, 0.65, 1.0) * pow(1 - saturate(dot(normalize(vViewPosition), normal)), 3) * 0.22), an ink outline on every opaque mesh, and for hair_01 depthWrite on with alphaTest 0.02.",
        outline:
          "the same SkinnedMesh again, bound to the same skeleton, MeshBasicMaterial colour 0x1b1424 on the back faces, vertices pushed along the skinned normal by 0.0032 m (after #include <skinning_vertex>: transformed += normalize(objectNormal) * uOutline). The source normals are hard on the armour: for a closed outline there, average the normals by position into a custom attribute at load.",
        notDone:
          "the game's own toon pipeline (a colour ramp per material region, the face shadow SDF, the masks m, m2, m3, m5, m6) is not shipped: the file carries the base pictures and the normal maps only. README.md says where the ramp pictures are.",
      },
    },
    skeleton: {
      root: "root",
      pelvis: "Bip001 Pelvis",
      spine: ["Bip001 Spine", "Bip001 Spine1", "Bip001 Spine2"],
      neck: "Bip001 Neck",
      head: "Bip001 Head",
      eyes: { bones: ["Bone01_Eye_L_02", "Bone01_Eye_R_02"], ...checked.eyes },
      mouth: {
        bone: "Bone01_Mouth_01",
        note: "skins the lower face (528 weight units). Use the morph targets for speech; turn this bone only for a small jaw drop.",
      },
      left: hand("L"),
      right: hand("R"),
      legs: {
        L: ["Bip001 L Thigh", "Bip001 L Calf", "Bip001 L Foot"],
        R: ["Bip001 R Thigh", "Bip001 R Calf", "Bip001 R Foot"],
      },
      claws: {
        note: "the two white claws float at her sides. Each hangs on a prop socket; the clips key them.",
        R: { socket: "Bip001 Prop1", bones: ["Bone01_weapon_R_01", "Bone01_weapon_R_03"] },
        L: { socket: "Bip001 Prop2", bones: ["Bone01_weapon_L_01", "Bone01_weapon_L_03"] },
      },
      dollSocket: {
        bone: "Bip001 R Hand",
        three: "Bip001_R_Hand",
        note: "her RIGHT hand, the one on the screen-left side in the video. In interaction_03 the hand is empty and the doll hovers above it (cameras.facts.json has the offsets and the times).",
      },
    },
    springs: {
      note: "The clips key every one of these bones (the authored motion, including the hair whips of interaction_03). Run a spring solver on top as secondary motion: read the pose the mixer wrote, then spring toward it, so the hair follows the clip and also answers the cursor. Rows are in hierarchy order.",
      hair: springRows(bake, table, has(/Bone01_Hair_/)),
      skirt: springRows(bake, table, has(/Bone01_Skirt_/)),
      ears: springRows(bake, table, has(/Bone01_Ear_/)),
      jewelry: springRows(bake, table, has(/Bone01_shiPin_/)),
      cloth: springRows(bake, table, has(/Bone01_Cloth_|^Bone(299|30[0-4])$/)),
    },
    morphs: {
      mesh: "selena_mesh_head",
      note: "head.morphTargetDictionary[name] gives the index into head.morphTargetInfluences, 0 to 1. They are absolute shapes: two at once add their displacements. The names are ours, read from a render of each target (selena-faces.png); `source` is the game's own number.",
      transferred:
        "from the raw head to this head by the nearest vertex in world space. The two heads share every vertex (mean distance 1e-6 m), so nothing was guessed.",
      targets: morphs.names.map((n) => ({
        name: n,
        ...bake.morph.report[n],
        afterNoiseCut: morphs.report[n],
      })),
      dropped: Object.entries(morphs.report)
        .filter(([, v]) => v.dropped)
        .map(([k]) => k),
      bytesInFile: morphCost,
      match: bake.morph.stats,
    },
    clips: clipTable(bake, { alias, loops, names: clipName }),
    clipNote:
      "Durations are (frames - 1) / 24 s. The two loops end on their first key exactly. The names keep the source's spelling (intercation). Sequence for the Selena section: hands_to_mouth_loop, then hands_to_mouth_release, then idle.",
    seams: {
      note: "worst and mean distance (metres) between the bone heads at the end of the first clip and at the start of the second: cross fade over this much",
      release_to_idle: seamGap(bake, "interaction_back_R", "idle"),
      loop_to_release: seamGap(bake, "interaction_R_loop", "interaction_back_R"),
      interaction_03_to_idle: seamGap(bake, "intercation03", "idle"),
    },
    bones: table,
    checks: {
      ...bake.checks,
      worstHeadErrorMetres: Math.round(checked.worstHeadError * 1e5) / 1e5,
      loopGapMetres: Object.fromEntries(
        loops.map((c) => [clipName(c), Math.round(clipReport[c].loopGap * 1e5) / 1e5]),
      ),
    },
  };
}
