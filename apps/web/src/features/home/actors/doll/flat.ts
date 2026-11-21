/**
 * The doll's anime shading, the two things the shared toon system does not do for her:
 *
 *  1. THE SHADING NORMALS (`flatNormals`, on the CPU, once). The shade of a toon band is a dot of the
 *     surface normal and the light, so a head of hair made of hundreds of sheets, each with its own
 *     normal, breaks the shadow into a mess of small shapes, and the underside of the head and the
 *     jaw go dark. A cel drawing shades a head as if it were a ball: one big terminator. So the
 *     hair's normals become the normals of a ball over the head (a cylinder below it), the face's
 *     lean toward the viewer (the face is lit flat), the neck's lean up and toward the viewer (no
 *     shadow under the chin), and the cloth and the arms keep their own, smoothed. The mesh's normal
 *     attribute is replaced, so the toon materials and the skinning need no change.
 *
 *  2. THE PICTURE (`patchFlatFragment`, in the shader). Her picture has airbrushed gradients and
 *     soft highlights painted in. The lightness is cut into a few flat steps (hue kept), so every
 *     gradient becomes a hard shape; and the hair gets one crisp highlight ARC (a ring round an
 *     axis of the same ball normal, the anime hair gloss) instead of the toon glint.
 *
 * Pure text and numbers, no three.js: `flat.test.ts` would read this in node.
 */
import { FACE_FRAGMENT_MAP } from "./face/shader";
import { FLAT, type FlatSpec } from "./look";
import { PART, type PartKind } from "./parts";

const MAP_FRAGMENT = "#include <map_fragment>";
const OPAQUE_FRAGMENT = "#include <opaque_fragment>";

export interface FlatInput {
  /** Three numbers a vertex, in the bind pose. */
  position: ArrayLike<number>;
  /** The mesh's own normals, three a vertex. */
  normal: ArrayLike<number>;
  /** `PART` of each vertex. */
  part: ArrayLike<number>;
  /** 1 on the face shell. */
  face: ArrayLike<number>;
  /** The share of each vertex's weight that is on the neck bone, 0 to 1. */
  neck: ArrayLike<number>;
}

function norm(
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  own: ArrayLike<number>,
): void {
  const len = Math.hypot(x, y, z);
  if (len < 1e-6) {
    out[i * 3] = own[i * 3] ?? 0;
    out[i * 3 + 1] = own[i * 3 + 1] ?? 0;
    out[i * 3 + 2] = own[i * 3 + 2] ?? 1;
    return;
  }
  out[i * 3] = x / len;
  out[i * 3 + 1] = y / len;
  out[i * 3 + 2] = z / len;
}

/** The shading normals (unit, three a vertex) for the doll's mesh; the input is left alone. */
export function flatNormals(input: FlatInput, spec: FlatSpec = FLAT): Float32Array {
  const count = Math.floor(input.position.length / 3);
  const out = new Float32Array(count * 3);
  const [hx, hy, hz] = spec.head;
  const [fx, fy, fz] = spec.front;
  for (let i = 0; i < count; i += 1) {
    const px = input.position[i * 3] ?? 0;
    const py = input.position[i * 3 + 1] ?? 0;
    const pz = input.position[i * 3 + 2] ?? 0;
    const ox = input.normal[i * 3] ?? 0;
    const oy = input.normal[i * 3 + 1] ?? 0;
    const oz = input.normal[i * 3 + 2] ?? 1;
    const part = input.part[i] ?? PART.cloth;
    if ((input.face[i] ?? 0) > 0.5) {
      // The face: a ball, pulled hard toward the viewer so it is lit flat.
      let bx = px - hx;
      let by = py - hy;
      let bz = pz - hz;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl;
      by /= bl;
      bz /= bl;
      const k = spec.faceFront;
      norm(
        out,
        i,
        bx * (1 - k) + fx * k,
        by * (1 - k) + fy * k,
        bz * (1 - k) + fz * k,
        input.normal,
      );
    } else if (part === PART.hair) {
      // Hair: a ball over the head, a cylinder below it (the locks hang down), a touch of its own.
      const cy = py > hy ? hy : py;
      let bx = px - hx;
      let by = py - cy;
      let bz = pz - hz;
      const bl = Math.hypot(bx, by, bz) || 1;
      bx /= bl;
      by /= bl;
      bz /= bl;
      const k = spec.hairOwn;
      norm(
        out,
        i,
        bx * (1 - k) + ox * k,
        by * (1 - k) + oy * k,
        bz * (1 - k) + oz * k,
        input.normal,
      );
    } else {
      // Skin and cloth keep their own normals; the neck leans up and to the viewer.
      const n = Math.min(1, Math.max(0, input.neck[i] ?? 0)) * spec.neckFront;
      norm(
        out,
        i,
        ox * (1 - n) + fx * n,
        oy * (1 - n) + fy * n,
        oz * (1 - n) + fz * n,
        input.normal,
      );
    }
  }
  return out;
}

/** The step cut of one part's picture, as GLSL that follows `#include <map_fragment>`. */
function stepsGlsl(levels: number): string {
  const n = levels.toFixed(1);
  return `{
	float flatTone = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
	float flatLevel = sqrt( max( flatTone, 0.0001 ) ) * ${n};
	float flatSpan = fwidth( flatLevel );
	float flatCut = mix( floor( flatLevel + 0.5 ), flatLevel, smoothstep( 0.35, 0.9, flatSpan ) ) / ${n};
	diffuseColor.rgb *= clamp( ( flatCut * flatCut ) / max( flatTone, 0.0001 ), 0.0, 1.5 );
}`;
}

/**
 * The hair's highlight arc: a ring round an axis of the ball normal (view space), crisp, one pixel
 * of edge. It is laid over the shaded colour just before the end of the fragment.
 */
function ringGlsl(spec: FlatSpec = FLAT): string {
  const [ax, ay, az] = spec.ringAxis;
  const f = (v: number): string => v.toFixed(4);
  return `{
	vec3 ringAxis = normalize( vec3( ${f(ax)}, ${f(ay)}, ${f(az)} ) );
	float ringDot = dot( toonN, ringAxis );
	float ringEdge = max( fwidth( ringDot ) * 0.75, 0.002 );
	float ring = smoothstep( ${f(spec.ringFrom)} - ringEdge, ${f(spec.ringFrom)} + ringEdge, ringDot )
		* ( 1.0 - smoothstep( ${f(spec.ringTo)} - ringEdge, ${f(spec.ringTo)} + ringEdge, ringDot ) );
	outgoingLight = mix( outgoingLight, mix( diffuseColor.rgb, vec3( 1.0, 0.95, 0.97 ), ${f(spec.ringWhite)} ), ring * ${f(spec.ringAmount)} );
}`;
}

function replaceOnce(source: string, anchor: string, text: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) {
    console.warn(`[doll flat] shader anchor not found: ${anchor}`);
    return source;
  }
  return source.slice(0, at) + text + source.slice(at + anchor.length);
}

/**
 * A part's fragment shader with the picture cut into steps and, for hair, the highlight arc. Apply it
 * AFTER the toon patch and, for the skin, after the face patch (the cut goes in front of the face, which
 * is drawn on the cut skin and stays crisp).
 */
export function patchFlatFragment(source: string, part: PartKind, spec: FlatSpec = FLAT): string {
  const levels = spec.levels[part] ?? 0;
  let out = source;
  // Zero levels leave the picture as it is (the skin and the cloth are flat already).
  if (levels > 0) {
    out = source.includes(FACE_FRAGMENT_MAP)
      ? replaceOnce(
          source,
          FACE_FRAGMENT_MAP,
          `${stepsGlsl(levels)}
${FACE_FRAGMENT_MAP}`,
        )
      : replaceOnce(
          source,
          MAP_FRAGMENT,
          `${MAP_FRAGMENT}
${stepsGlsl(levels)}`,
        );
  }
  if (part === PART.hair)
    out = replaceOnce(out, OPAQUE_FRAGMENT, `${ringGlsl(spec)}\n${OPAQUE_FRAGMENT}`);
  return out;
}
