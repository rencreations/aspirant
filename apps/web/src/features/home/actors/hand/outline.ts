/**
 * The ink outline needs one normal per place, not one per vertex: the glove has hard normals at
 * every texture seam, so pushing each vertex along its own normal would open the hull. The smooth
 * normal is the average of the normals of every vertex that sits at the same place. Pure: it reads
 * and writes plain arrays.
 */
export function smoothNormals(
  /** The vertex positions, three a vertex. Equal values are the same place. */
  positions: ArrayLike<number>,
  /** The vertex normals as unit floats, three a vertex. */
  normals: ArrayLike<number>,
): Float32Array {
  const count = Math.floor(positions.length / 3);
  const out = new Float32Array(count * 3);
  const slot = new Map<string, number>();
  const sums: number[] = [];
  const which = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    const key = `${positions[i * 3]},${positions[i * 3 + 1]},${positions[i * 3 + 2]}`;
    let s = slot.get(key);
    if (s === undefined) {
      s = sums.length / 3;
      slot.set(key, s);
      sums.push(0, 0, 0);
    }
    which[i] = s;
    sums[s * 3] = (sums[s * 3] ?? 0) + normals[i * 3]!;
    sums[s * 3 + 1] = (sums[s * 3 + 1] ?? 0) + normals[i * 3 + 1]!;
    sums[s * 3 + 2] = (sums[s * 3 + 2] ?? 0) + normals[i * 3 + 2]!;
  }
  for (let i = 0; i < count; i += 1) {
    const s = which[i]! * 3;
    const x = sums[s]!;
    const y = sums[s + 1]!;
    const z = sums[s + 2]!;
    const len = Math.hypot(x, y, z);
    if (len > 1e-6) {
      out[i * 3] = x / len;
      out[i * 3 + 1] = y / len;
      out[i * 3 + 2] = z / len;
    } else {
      // Normals that cancel (a thin double sided sheet): keep this vertex's own.
      out[i * 3] = normals[i * 3]!;
      out[i * 3 + 1] = normals[i * 3 + 1]!;
      out[i * 3 + 2] = normals[i * 3 + 2]!;
    }
  }
  return out;
}
