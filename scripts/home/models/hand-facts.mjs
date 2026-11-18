// The facts file of the hand.
import { LOADER, boneTable, clipTable } from "./lib/facts.mjs";

export function assemble({ name, bake, checked, clipReport, alias, loops, clipName, view }) {
  return {
    model: name,
    schema: 1,
    space:
      "glTF world, metres, Y up, the hand turned for the page: the WRIST is the origin, the forearm lies along +Z toward the camera and a little rising, the palm faces up and a little toward the camera (+Y, +Z), the fingers point away (-Z), the thumb is on the left (-X). Bones hang on the scene root (no armature node).",
    loader: LOADER,
    variant:
      "Selena's LEFT hand in her black clawed glove with the gold and violet bracer on the back of the forearm. A white glove or a bare hand cannot be made from the sources (the file has this glove only, no skin); the black glove is the design.",
    meshes: {
      mesh: "selena_hand",
      material: "selena_hand_glove",
      note: "opaque, double sided. The whole atlas of the body picture is kept (the bracer's pieces lie all over it), at 1024.",
      sleeve:
        "The glove's cuff is open in the source (a ring of 14 edges). The build grows a sleeve from it along the arm (0.16 m, tapering to half, five rings) and closes it with a soft cone, so there is no flat cap and no hole. Everything of the sleeve is skinned to the forearm bone. The end lies about 0.3 m behind the wrist, outside any frame of the view below.",
    },
    view: {
      camera: view,
      note: "The page starts from this camera (the owner's elbow: behind and above the wrist, 0.43 m from the palm). With the hand root at the origin the wrist is just under the bottom edge at 16:9, 21:9 (fov 38) and 9:16 (position the same, target and fov from `portrait`), the palm and the claws of the four fingers are in the frame, the end of the sleeve is not, and the palm faces the camera within 55 degrees (`framing`, asserted by the build). Lay a soft fade over the bottom of the canvas. hand-views.png shows it and hand-closed*.png shows with culling on that nothing is open from six sides and at the three aspects.",
      framing: checked.framing,
    },
    skeleton: {
      root: "Bip001 L UpperArm",
      forearm: "Bip001 L Forearm",
      foreTwist: "Bip001 L ForeTwist",
      hand: "Bip001 L Hand",
      bracer: "Bone01_JianJia_L_03",
      fingers: checked.fingers,
      fingerNote:
        "Per finger: the chain (base to tip, three.js names), the local axis a positive angle about which curls it toward the palm (flexAxisLocal) and the axis that spreads it toward the thumb (spreadAxisLocal). Measured in three on this file by turning the base bone and following the claw tip. Apply on top of the mixer: bone.quaternion.multiply(q.setFromAxisAngle(axis, angle)) on every bone of the chain.",
    },
    curl: {
      suggestion:
        "Per joint [knuckle, middle, tip] at weight 1: [0.18, 0.28, 0.20] rad, scaled by finger: index 0.8, middle 1.0, ring 1.1, pinky 1.25. Thumb: 0.35 rad about its flexAxisLocal over the chain. A cursor reaching over a finger flexes it; add up to 0.12 rad of spread toward the cursor. Spring each finger (frequency 1.5, damping 0.5) and ripple 25 to 40 ms from the nearest finger.",
    },
    palm: {
      ...checked.palm,
      note: "At the end of palm_up. offsetInBoneFrame is where a thing laid on the palm sits, in the frame of the bone `bone` (parent the doll to that bone with this offset and it stays on the palm through the breath). normal is the palm's normal in world space; the doll stands along it. spanAcross is knuckle to knuckle (index to pinky), spanAlong wrist to knuckles.",
    },
    clips: clipTable(bake, { alias, loops, names: clipName }),
    clipNote:
      "palm_up is a reach: 25 frames (1 s) from the bind pose (a flat hand, fingers together) to the open palm of hand.jpg, eased. Scrub it with the scroll (mixer.setTime) or play it once. breath is a 4 s loop of 1 to 2 degrees on every joint, ending on its first key. The last key of palm_up is the pose breath moves around.",
    pose: {
      degrees: bake.pose,
      note: "bone-local Euler XYZ at the end of palm_up, X roll, Y spread (positive toward the thumb), Z flex (positive toward the palm)",
    },
    bones: boneTable(bake),
    checks: {
      worstHeadErrorMetres: Math.round(checked.worstHeadError * 1e6) / 1e6,
      closestFingersMetres: Math.round(checked.closestFingers.worst * 1e4) / 1e4,
    },
  };
}
