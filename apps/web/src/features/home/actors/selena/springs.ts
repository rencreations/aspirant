/**
 * Which bones swing, and about what. The notes list them by name (hair, skirt, ears, jewellery,
 * cloth). This reads the rest pose of the loaded rig and gives each one its tail: the point the
 * solver simulates, in the bone's own frame. A bone with spring children aims at the middle of
 * them (a ponytail's root, which has a left and a right strand, hangs straight down between them);
 * the last bone of a chain continues the line of its parent. Pure: it works on names, parents and
 * the flat rest pose.
 */
import { qconj, qrotate } from "./quat";
import { POSE_STRIDE } from "./sampler";
import type { SpringDef, SpringGroup } from "./physics";

/** The group of a bone by its name, or null when it does not swing. */
export function springGroup(name: string): SpringGroup | null {
  if (/^Bone01_Hair_(LB|RB)_\d+$/.test(name) || name === "Bone01_Hair_B_01") return "ponytail";
  if (name.startsWith("Bone01_Hair_")) return "hair";
  if (name.startsWith("Bone01_Skirt_")) return "skirt";
  if (name.startsWith("Bone01_Ear_")) return "ear";
  if (name.startsWith("Bone01_shiPin_")) return "jewelry";
  if (name.startsWith("Bone01_Cloth_") || /^Bone(299|30[0134])$/.test(name)) return "cloth";
  return null;
}

/** The longest a leaf bone's tail may be, and the share of its own segment it continues. */
const LEAF_SHARE = 0.75;
const LEAF_MAX = 0.2;
const LEAF_MIN = 0.03;

export function buildSpringDefs(
  names: readonly string[],
  parent: ArrayLike<number>,
  rest: Float32Array,
): SpringDef[] {
  const group = names.map(springGroup);
  const defs: SpringDef[] = [];
  const t = [0, 0, 0, 0];
  for (let i = 0; i < names.length; i += 1) {
    const g = group[i];
    const p = parent[i]!;
    if (!g || p < 0) continue;
    // The spring children, or every child when none of them swings.
    const kids: number[] = [];
    for (let c = 0; c < names.length; c += 1) if (parent[c] === i && group[c]) kids.push(c);
    let tx = 0;
    let ty = 0;
    let tz = 0;
    if (kids.length > 0) {
      for (const c of kids) {
        tx += rest[c * POSE_STRIDE]! / kids.length;
        ty += rest[c * POSE_STRIDE + 1]! / kids.length;
        tz += rest[c * POSE_STRIDE + 2]! / kids.length;
      }
    } else {
      // Continue the line from the parent's head to this head, in this bone's own frame.
      const o = i * POSE_STRIDE;
      qconj(rest, o + 3, t, 0);
      qrotate(t, 0, rest[o]!, rest[o + 1]!, rest[o + 2]!, t, 0);
      const seg = Math.hypot(t[0]!, t[1]!, t[2]!);
      if (seg < 1e-5) continue;
      const len = Math.min(LEAF_MAX, Math.max(LEAF_MIN, seg * LEAF_SHARE));
      tx = (t[0]! / seg) * len;
      ty = (t[1]! / seg) * len;
      tz = (t[2]! / seg) * len;
    }
    if (Math.hypot(tx, ty, tz) < 1e-4) continue;
    defs.push({ node: i, parent: p, tail: [tx, ty, tz], group: g });
  }
  return defs;
}
