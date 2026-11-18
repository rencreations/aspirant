/**
 * The doll is one skinned mesh with one picture, but she is drawn with three looks: cloth, skin and
 * hair (hair has three bands and a crisp glint, skin a warm shade, cloth a cool one). This sorts her
 * triangles into those three parts so the mesh can be drawn in three groups with three materials.
 * Pure arithmetic on typed arrays, no three.js.
 *
 * A vertex is hair when its weight is mostly on the head bone and it is not part of the face shell,
 * skin when it belongs to the face shell or mostly to a shoulder, arm or hand, and cloth otherwise
 * (the leotard, the legs, the boots). A triangle takes the part most of its corners have.
 */

export const PART = { cloth: 0, skin: 1, hair: 2 } as const;
export type PartKind = (typeof PART)[keyof typeof PART];
export const PART_COUNT = 3;

/** The bone names that are skin (the arms and the face shell's neck); the head bone is hair. */
const SKIN_BONES: readonly string[] = [
  "neck",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
];
const HAIR_BONE = "Head";

/** The part each bone's weight counts for. */
export function boneParts(names: readonly string[]): Uint8Array {
  const out = new Uint8Array(names.length).fill(PART.cloth);
  names.forEach((name, i) => {
    if (name === HAIR_BONE) out[i] = PART.hair;
    else if (SKIN_BONES.includes(name)) out[i] = PART.skin;
  });
  return out;
}

interface PartGroup {
  start: number;
  count: number;
  part: PartKind;
}

export interface PartSplit {
  /** The triangle list, sorted by part. */
  index: Uint32Array;
  /** One group per part that has triangles, in the order cloth, skin, hair. */
  groups: PartGroup[];
  /** The number of triangles of each part. */
  triangles: [number, number, number];
}

export interface PartInput {
  /** The triangle list, or null for a mesh that is not indexed. */
  index: ArrayLike<number> | null;
  vertexCount: number;
  /** Four bone indices a vertex. */
  skinIndex: ArrayLike<number>;
  /** Four weights a vertex (any scale: only the ratios count). */
  skinWeight: ArrayLike<number>;
  /** 1 for a vertex of the face shell, 0 elsewhere. */
  face: ArrayLike<number>;
  /** `boneParts(names)`. */
  boneKind: ArrayLike<number>;
}

/** The part of one vertex. */
export function vertexPart(input: PartInput, v: number): PartKind {
  if ((input.face[v] ?? 0) > 0.5) return PART.skin;
  const sum = [0, 0, 0];
  for (let k = 0; k < 4; k += 1) {
    const bone = input.skinIndex[v * 4 + k] ?? 0;
    const kind = input.boneKind[bone] ?? PART.cloth;
    sum[kind] = (sum[kind] ?? 0) + (input.skinWeight[v * 4 + k] ?? 0);
  }
  let best: PartKind = PART.cloth;
  if ((sum[PART.skin] ?? 0) > (sum[best] ?? 0)) best = PART.skin;
  if ((sum[PART.hair] ?? 0) > (sum[best] ?? 0)) best = PART.hair;
  return best;
}

/** The part of a triangle: the one most of its corners have, or its first corner's when all differ. */
export function trianglePart(a: PartKind, b: PartKind, c: PartKind): PartKind {
  if (a === b || a === c) return a;
  if (b === c) return b;
  return a;
}

/** Sort the triangles by part (a stable counting sort) and say where each part's run is. */
export function splitParts(input: PartInput): PartSplit {
  const parts = new Uint8Array(input.vertexCount);
  for (let v = 0; v < input.vertexCount; v += 1) parts[v] = vertexPart(input, v);
  const count = input.index
    ? Math.floor(input.index.length / 3)
    : Math.floor(input.vertexCount / 3);
  const corner = (t: number, k: number): number =>
    input.index ? (input.index[t * 3 + k] ?? 0) : t * 3 + k;
  const kind = new Uint8Array(count);
  const triangles: [number, number, number] = [0, 0, 0];
  for (let t = 0; t < count; t += 1) {
    const p = trianglePart(
      (parts[corner(t, 0)] ?? 0) as PartKind,
      (parts[corner(t, 1)] ?? 0) as PartKind,
      (parts[corner(t, 2)] ?? 0) as PartKind,
    );
    kind[t] = p;
    triangles[p] += 1;
  }
  const start: [number, number, number] = [0, triangles[0], triangles[0] + triangles[1]];
  const cursor: [number, number, number] = [start[0], start[1], start[2]];
  const index = new Uint32Array(count * 3);
  for (let t = 0; t < count; t += 1) {
    const p = (kind[t] ?? 0) as PartKind;
    const at = cursor[p] * 3;
    cursor[p] += 1;
    index[at] = corner(t, 0);
    index[at + 1] = corner(t, 1);
    index[at + 2] = corner(t, 2);
  }
  const groups: PartGroup[] = [];
  for (const part of [PART.cloth, PART.skin, PART.hair] as const) {
    if (triangles[part] > 0) {
      groups.push({ start: start[part] * 3, count: triangles[part] * 3, part });
    }
  }
  return { index, groups, triangles };
}
