/**
 * The doll's face inside the toon material. The face shader of the asset (`shader.ts`, generated)
 * paints the eyes, brows, mouth and cues over the skin colour. Here it is wired into a
 * `ToonMaterial` (three's basic material with its lighting replaced, `actors/shared/toon.ts`):
 *
 *  - the drawn features (eyes, glyphs, brows, tears, mouth, sweat) write how much they cover into
 *    `gPaint`, and the final colour is the toon shade of the SKIN with the features put on top
 *    unshaded, so a band edge never crosses an eye and the lines stay crisp;
 *  - the skin colour under them (blush, flush, shock, the gloom lines) is shaded with the face.
 *
 * Everything here is text: `patchFaceVertex` and `patchFaceFragment` take a shader's source and
 * return it with the face added. `toon-face.test.ts` checks every anchor against the installed
 * three, so an upgrade that moves one fails a test and does not draw a blank face.
 */
import {
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
} from "./shader";

/** The lines of the generated face shader that lay a feature over the skin, and what each adds to `gPaint`. */
export const PAINT_PATCHES: ReadonlyArray<readonly [string, string]> = [
  ["col = mix(col, eL.rgb, eL.a * (1.0 - G));", "gPaint = max(gPaint, eL.a * (1.0 - G));"],
  ["col = mix(col, eR.rgb, eR.a * (1.0 - G));", "gPaint = max(gPaint, eR.a * (1.0 - G));"],
  ["col = mix(col, gcL, gaL * gw[i]);", "gPaint = max(gPaint, gaL * gw[i]);"],
  ["col = mix(col, gcR, gaR * gw[i]);", "gPaint = max(gPaint, gaR * gw[i]);"],
  ["col = mix(col, uInk, max(bL, bR));", "gPaint = max(gPaint, max(bL, bR));"],
  ["col = mix(col, tc, a * 0.92);", "gPaint = max(gPaint, a * 0.92);"],
  ["col = mix(col, mouth.rgb, mouth.a);", "gPaint = max(gPaint, mouth.a);"],
  ["col = mix(col, TEAR, sa * 0.95);", "gPaint = max(gPaint, sa * 0.95);"],
];

const FACE_FUNCTION = "vec3 gFace(vec3 base, vec2 bind) {";

/** The generated face functions, with the feature coverage written to `gPaint`. */
export function toonFaceHead(): string {
  let out = FACE_FRAGMENT_HEAD;
  for (const [line, paint] of PAINT_PATCHES) out = replaceOnce(out, line, `${line}\n  ${paint}`);
  return replaceOnce(out, FACE_FUNCTION, `float gPaint = 0.0;\n${FACE_FUNCTION}\n  gPaint = 0.0;`);
}

function replaceOnce(source: string, anchor: string, text: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) {
    console.warn(`[doll face] shader anchor not found: ${anchor}`);
    return source;
  }
  return source.slice(0, at) + text + source.slice(at + anchor.length);
}

const COMMON = "#include <common>";
const BEGIN_VERTEX = "#include <begin_vertex>";
const MAP_FRAGMENT = "#include <map_fragment>";
const OPAQUE_FRAGMENT = "#include <opaque_fragment>";

/** The vertex shader with the face's attribute and its bind position. */
export function patchFaceVertex(source: string): string {
  const out = replaceOnce(source, COMMON, `${COMMON}\n${FACE_VERTEX_HEAD}`);
  return replaceOnce(out, BEGIN_VERTEX, `${BEGIN_VERTEX}\n${FACE_VERTEX_BODY}`);
}

/**
 * The fragment shader with the face drawn into the colour (before the toon shade reads it) and the
 * features laid back over the shaded skin (after it). Two thirds of a pixel's coverage is enough to
 * take it out of the shade, so the line's soft edge does not turn pale.
 */
export function patchFaceFragment(source: string): string {
  let out = replaceOnce(source, COMMON, `${COMMON}\n${toonFaceHead()}`);
  out = replaceOnce(out, MAP_FRAGMENT, `${MAP_FRAGMENT}\n${FACE_FRAGMENT_MAP}`);
  return replaceOnce(
    out,
    OPAQUE_FRAGMENT,
    "outgoingLight = mix( outgoingLight, diffuseColor.rgb, clamp( gPaint * 1.5, 0.0, 1.0 ) );\n" +
      OPAQUE_FRAGMENT,
  );
}
