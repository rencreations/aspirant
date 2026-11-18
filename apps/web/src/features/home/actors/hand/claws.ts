/**
 * Which part of the mesh is a claw. The glove's picture paints a claw as a violet to black gradient
 * with the reflections baked in, which cel bands cannot read, so the claws are found by the
 * geometry instead: on each fingertip bone, a vertex belongs to the claw when it lies far enough
 * along the finger (a share of the bone's reach, a soft edge) and the shader draws that part as
 * flat bright colour. Pure arithmetic: the actor reads the positions.
 */

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The claw weight of a vertex, 0 to 1. `along` is how far the vertex is from the head of the
 * fingertip bone, measured along the finger; `reach` is the farthest vertex of that bone. The weight
 * rises from 0 at `from` of the reach to 1 at `to` of it.
 */
export function clawWeight(along: number, reach: number, from: number, to: number): number {
  if (!(reach > 0)) return 0;
  return smooth(from, to, along / reach);
}
