/**
 * Puts `flat.ts` on the doll: the shading normals into her mesh (once, at dress time) and the
 * picture's steps (and the hair's highlight arc) into a part's toon material, chained after the
 * toon patch (and after the face patch for the skin). The only three.js part of the flat look.
 */
import { BufferAttribute, type BufferGeometry } from "three";

import type { ToonMaterial } from "../shared/toon";

import { patchFlatFragment, flatNormals } from "./flat";
import { FLAT } from "./look";
import { PART, vertexPart, type PartInput } from "./parts";
import type { PartKind } from "./parts";

/** Replace the mesh's normal attribute with the shading normals. `input` is the same the part sort read. */
export function applyFlatNormals(
  geo: BufferGeometry,
  input: PartInput,
  boneNames: readonly string[],
): void {
  const position = geo.getAttribute("position");
  const normal = geo.getAttribute("normal");
  if (!normal) return;
  const count = position.count;
  const part = new Uint8Array(count);
  const neck = new Float32Array(count);
  const neckBone = boneNames.indexOf("neck");
  for (let v = 0; v < count; v += 1) {
    part[v] = vertexPart(input, v);
    let total = 0;
    let mine = 0;
    for (let k = 0; k < 4; k += 1) {
      const w = input.skinWeight[v * 4 + k] ?? 0;
      total += w;
      if ((input.skinIndex[v * 4 + k] ?? -1) === neckBone) mine += w;
    }
    neck[v] = total > 0 ? mine / total : 0;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  for (let v = 0; v < count; v += 1) {
    positions[v * 3] = position.getX(v);
    positions[v * 3 + 1] = position.getY(v);
    positions[v * 3 + 2] = position.getZ(v);
    normals[v * 3] = normal.getX(v);
    normals[v * 3 + 1] = normal.getY(v);
    normals[v * 3 + 2] = normal.getZ(v);
  }
  const shaded = flatNormals({
    position: positions,
    normal: normals,
    part,
    face: input.face,
    neck,
  });
  geo.setAttribute("normal", new BufferAttribute(shaded, 3));
}

/** Chain the flat patch after whatever `onBeforeCompile` the material has, and give it its own program key. */
export function chainFlat(material: ToonMaterial, part: PartKind): void {
  const before = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.fragmentShader = patchFlatFragment(shader.fragmentShader, part);
  };
  const key = material.customProgramCacheKey.bind(material);
  // The key carries the numbers, so a probe that edits `FLAT` and sets `needsUpdate` gets a new program.
  material.customProgramCacheKey = () =>
    `${key()}-doll-flat-v1-${part === PART.hair ? "h" : part}-${FLAT.levels[part]}-${FLAT.ringFrom}-${FLAT.ringTo}-${FLAT.ringWhite}-${FLAT.ringAmount}-${FLAT.ringAxis.join(",")}`;
  material.needsUpdate = true;
}
