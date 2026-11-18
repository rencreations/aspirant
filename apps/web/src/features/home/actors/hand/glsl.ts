/**
 * The shader text the hand adds on top of the shared toon look (`../shared/toon-glsl.ts`). Each
 * function takes a shader the toon material has ALREADY patched (the order matters: the anchors
 * below are lines the toon patch leaves in place or writes), so `glsl.test.ts` runs the whole chain
 * on three's own basic shader and fails when an anchor moves.
 *
 * What it adds:
 *  - The claws: `aClaw` is a per vertex 0 to 1 the actor writes at load (the part of each fingertip
 *    bone beyond the finger, `claws.ts`); it reaches the fragment as `vClaw`.
 *  - The foot fade: the vertex's height on the screen is handed to the fragment, which fades the
 *    alpha to nothing at the bottom edge (the glove and its ink alike), so the end of the sleeve can
 *    never show and a hand that sinks dissolves from its lowest part upward.
 *  - The glove: dark texels are lifted to a violet black so the bands can show on black leather, a
 *    crisp violet rim goes on the edge, and the saturated texels (the claws, the gold of the
 *    bracer) are drawn as flat bright colour.
 */

export const MAP_CHUNK = "#include <map_fragment>";
export const OPAQUE_CHUNK = "#include <opaque_fragment>";
export const PROJECT_CHUNK = "#include <project_vertex>";
/** The line the toon ink patch writes its clip position with. */
export const INK_POSITION = "gl_Position = inkClip;";

function replaceOnce(source: string, anchor: string, text: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) {
    console.warn(`[hand] shader anchor not found: ${anchor}`);
    return source;
  }
  return source.slice(0, at) + text + source.slice(at + anchor.length);
}

/** The skin's vertex shader: the screen height and the claw weight of the vertex go to the fragment. */
export function patchFadeVertex(source: string): string {
  const out = replaceOnce(
    source,
    PROJECT_CHUNK,
    `${PROJECT_CHUNK}\nvFadeY = gl_Position.y / gl_Position.w;\nvClaw = aClaw;`,
  );
  return `varying float vFadeY;\nvarying float vClaw;\nattribute float aClaw;\n${out}`;
}

/** The ink's vertex shader (after the toon ink patch): the same, from the ink's own clip position. */
export function patchInkFadeVertex(source: string): string {
  const out = replaceOnce(
    source,
    INK_POSITION,
    `${INK_POSITION}\n\t\tvFadeY = inkClip.y / inkClip.w;`,
  );
  return `varying float vFadeY;\n${out}`;
}

/** The ink's fragment shader: the alpha fades with the height. */
export function patchInkFadeFragment(source: string): string {
  const out = replaceOnce(
    source,
    OPAQUE_CHUNK,
    `diffuseColor.a *= smoothstep( uFade.x, uFade.y, vFadeY );\n${OPAQUE_CHUNK}`,
  );
  return `varying float vFadeY;\nuniform vec2 uFade;\n${out}`;
}

const GLOVE_PARS = /* glsl */ `
varying float vFadeY;
varying float vClaw;
uniform vec2 uFade;
uniform vec3 uLift;
uniform vec3 uHandRim;
uniform vec2 uHandRimK;
uniform vec2 uClaw;
uniform vec3 uClawColor;
`;

/**
 * After the picture is read: find the claws, lift the leather. `gClaw` is 1 on a fingertip's claw
 * (the vertex weight) and on any saturated texel (the gold of the bracer, the crystals).
 */
const GLOVE_ALBEDO = /* glsl */ `
float gMx = max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
float gMn = min( min( diffuseColor.r, diffuseColor.g ), diffuseColor.b );
float gTex = smoothstep( 0.1, 0.26, gMx - gMn ) * smoothstep( 0.12, 0.3, gMx );
float gClaw = max( gTex, vClaw );
diffuseColor.rgb = mix( diffuseColor.rgb, uClawColor, vClaw * 0.85 );
diffuseColor.rgb += uLift * ( 1.0 - gClaw );
`;

/** After the toon shade: the crisp rim on the leather, the claws as flat bright colour, the fade. */
const GLOVE_FINISH = /* glsl */ `
{
	float gFres = 1.0 - clamp( dot( toonN, normalize( vToonV ) ), 0.0, 1.0 );
	float gRim = smoothstep( 1.0 - uHandRimK.y - 0.035, 1.0 - uHandRimK.y + 0.035, gFres );
	outgoingLight += uHandRim * ( gRim * uHandRimK.x * ( 1.0 - gClaw ) );
	// Flat bright colour, two tone: the lit side as it is, the other side a bluer violet.
	float gBand = smoothstep( -0.12, 0.12, dot( toonN, uToonL ) );
	vec3 gFlat = ( outgoingLight * uClaw.y + diffuseColor.rgb * uClaw.x ) * mix( vec3( 0.6, 0.56, 0.95 ), vec3( 1.0 ), gBand );
	outgoingLight = mix( outgoingLight, gFlat, gClaw );
	diffuseColor.a *= smoothstep( uFade.x, uFade.y, vFadeY );
}
`;

/** The glove's fragment shader (after `patchToonFragment`). */
export function patchGloveFragment(source: string): string {
  let out = replaceOnce(source, MAP_CHUNK, `${MAP_CHUNK}\n${GLOVE_ALBEDO}`);
  out = replaceOnce(out, OPAQUE_CHUNK, `${GLOVE_FINISH}\n${OPAQUE_CHUNK}`);
  return `${GLOVE_PARS}\n${out}`;
}
