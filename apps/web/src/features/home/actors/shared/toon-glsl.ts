/**
 * The shader text of the toon look (see `toon.ts`). The material is three's own `MeshBasicMaterial`
 * (so skinning, morph targets, clipping planes, the map, the alpha test and vertex colours all keep
 * working through three's chunks) with its lighting replaced by cel bands. These functions patch the
 * stock shader text at four anchors; `toon-glsl.test.ts` checks the anchors still exist in the
 * installed three, so an upgrade that moves them fails a test instead of drawing a plain model.
 */

/** The line of the stock vertex shader that guards the normal chunks (they only run with skinning or an env map). */
export const NORMAL_GUARD = "#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )";
export const PROJECT_CHUNK = "#include <project_vertex>";
export const BEGIN_NORMAL_CHUNK = "#include <beginnormal_vertex>";
export const MAIN_OPEN = "void main() {";
export const OUTGOING = "vec3 outgoingLight = reflectedLight.indirectDiffuse;";

function replaceOnce(source: string, anchor: string, text: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) {
    console.warn(`[toon] shader anchor not found: ${anchor}`);
    return source;
  }
  return source.slice(0, at) + text + source.slice(at + anchor.length);
}

/** The skin's vertex shader: the same, plus the view space normal and view vector for the fragment. */
export function patchToonVertex(source: string): string {
  let out = replaceOnce(source, NORMAL_GUARD, "#if 1");
  out = replaceOnce(
    out,
    PROJECT_CHUNK,
    `${PROJECT_CHUNK}\nvToonN = transformedNormal;\nvToonV = - mvPosition.xyz;`,
  );
  return `varying vec3 vToonN;\nvarying vec3 vToonV;\n${out}`;
}

const FRAGMENT_PARS = /* glsl */ `
uniform vec3 uToonL;
uniform float uToonAmt;
uniform vec3 uToonRim;
uniform vec3 uShade;
uniform vec3 uDeep;
uniform vec3 uLit;
uniform float uSat;
uniform float uSoft;
uniform vec2 uCut;
uniform vec2 uRim;
uniform vec2 uGlint;
uniform vec3 uEmissive;
uniform float uSkinSplit;
uniform vec3 uWarm;
uniform vec3 uWarmDeep;
#ifdef TOON_EMISSIVE_MAP
uniform sampler2D uEmissiveMap;
#endif
varying vec3 vToonN;
varying vec3 vToonV;

vec3 toonTint( vec3 albedo, vec3 m ) {
	vec3 c = albedo * m;
	float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
	return mix( vec3( l ), c, uSat );
}

// Skin by its colour, for a body painted on one sheet with its armour: pink to peach (green about
// half and blue about half of the red), not white, grey, violet, red or gold. 0 to 1.
float toonSkin( vec3 a ) {
	float r = max( a.r, 0.0001 );
	float gr = a.g / r;
	float br = a.b / r;
	float lum = dot( a, vec3( 0.2126, 0.7152, 0.0722 ) );
	return smoothstep( 0.28, 0.36, br ) * ( 1.0 - smoothstep( 0.66, 0.78, br ) )
		* smoothstep( 0.46, 0.54, gr ) * ( 1.0 - smoothstep( 0.82, 0.9, gr ) )
		* smoothstep( 0.18, 0.3, lum );
}

vec3 toonShade( vec3 albedo, vec3 N, vec3 V ) {
	float ndl = dot( N, uToonL );
	float lit = smoothstep( uCut.y - uSoft, uCut.y + uSoft, ndl );
	float skinK = uSkinSplit > 0.0 ? uSkinSplit * toonSkin( albedo ) : 0.0;
	vec3 shade = mix( albedo, toonTint( albedo, mix( uShade, uWarm, skinK ) ), uToonAmt );
	vec3 col;
	#if TOON_BANDS == 3
		float mid = smoothstep( uCut.x - uSoft, uCut.x + uSoft, ndl );
		vec3 deep = mix( albedo, toonTint( albedo, mix( uDeep, uWarmDeep, skinK ) ), uToonAmt );
		col = mix( mix( deep, shade, mid ), albedo * uLit, lit );
	#else
		col = mix( shade, albedo * uLit, lit );
	#endif
	// A thin rim on the silhouette: full on the shadow side, a third of it on the lit side. A pale
	// glow on a dark surface; on a light one (where a glow would vanish) a cool deepening instead.
	float fres = 1.0 - clamp( dot( N, V ), 0.0, 1.0 );
	float rimBand = smoothstep( 1.0 - uRim.y - 0.06, 1.0 - uRim.y + 0.06, fres );
	float rimK = rimBand * ( 0.3 + 0.7 * ( 1.0 - lit ) ) * uRim.x * uToonAmt;
	float onLight = smoothstep( 0.55, 0.85, dot( col, vec3( 0.2126, 0.7152, 0.0722 ) ) );
	col = mix( col + uToonRim * rimK, mix( col, col * vec3( 0.6, 0.68, 1.0 ), min( 1.0, rimK * 1.4 ) ), onLight );
	// A small crisp highlight on the lit side: a shape, not a reflection. The edge is one pixel
	// wide whatever the curvature (a fixed width spans a whole horn).
	vec3 H = normalize( uToonL + V );
	float nh = dot( N, H );
	float glintEdge = clamp( fwidth( nh ) * 0.75, 0.0004, 0.012 );
	float glint = smoothstep( uGlint.y - glintEdge, uGlint.y + glintEdge, nh ) * uGlint.x * lit;
	col = mix( col, mix( vec3( 1.0 ), albedo, 0.18 ), glint );
	return col;
}
`;

/** The skin's fragment shader: the stock lighting is replaced by `toonShade` (and the glow). */
export function patchToonFragment(source: string): string {
  let out = replaceOnce(source, MAIN_OPEN, `${FRAGMENT_PARS}\n${MAIN_OPEN}`);
  out = replaceOnce(
    out,
    OUTGOING,
    /* glsl */ `vec3 toonN = normalize( vToonN );
	#ifdef DOUBLE_SIDED
		toonN *= gl_FrontFacing ? 1.0 : - 1.0;
	#endif
	vec3 outgoingLight = toonShade( diffuseColor.rgb, toonN, normalize( vToonV ) );
	vec3 toonGlow = uEmissive;
	#ifdef TOON_EMISSIVE_MAP
		toonGlow *= texture2D( uEmissiveMap, vMapUv ).rgb;
	#endif
	outgoingLight += toonGlow;`,
  );
  return out;
}

/**
 * The ink hull's vertex shader. The smooth normal (`aSmooth`) is skinned and morphed like the
 * normal of the skin, turned to the screen, and the vertex is moved along it by a number of CSS
 * pixels in clip space (times w, so the line keeps its width at any distance). The hull is also
 * pushed back in view space so a one sided card does not fight its own ink.
 */
export function patchInkVertex(source: string): string {
  let out = replaceOnce(source, NORMAL_GUARD, "#if 1");
  out = replaceOnce(out, BEGIN_NORMAL_CHUNK, "vec3 objectNormal = aSmooth;");
  out = replaceOnce(
    out,
    PROJECT_CHUNK,
    /* glsl */ `${PROJECT_CHUNK}
	{
		vec4 inkView = mvPosition;
		inkView.z -= uInkPush;
		vec4 inkClip = projectionMatrix * inkView;
		// The hull is a back side material: three turns its normal inside out (FLIP_SIDED). The
		// push goes along the outward normal, so turn it back.
		vec3 inkNormal = transformedNormal;
		#ifdef FLIP_SIDED
			inkNormal = - inkNormal;
		#endif
		vec2 inkDir = ( projectionMatrix * vec4( inkNormal, 0.0 ) ).xy * uToonView;
		float inkLen = length( inkDir );
		inkDir = inkLen > 0.00001 ? inkDir / inkLen : vec2( 0.0 );
		inkClip.xy += inkDir * ( 2.0 * uInkPx ) / uToonView * inkClip.w;
		gl_Position = inkClip;
	}`,
  );
  return `attribute vec3 aSmooth;\nuniform float uInkPx;\nuniform float uInkPush;\nuniform vec2 uToonView;\n${out}`;
}

/**
 * The ink of an alpha card (the fringe of hair): the same card drawn again, shifted on the screen
 * by `uInkShift` (a unit vector) times the line width, in ink colour, with the picture's alpha
 * cutting the shape. Several copies round the circle make a line round the alpha shape, which a
 * hull along the normal cannot (a card has no thickness).
 */
export function patchCardInkVertex(source: string): string {
  const out = replaceOnce(
    source,
    PROJECT_CHUNK,
    /* glsl */ `${PROJECT_CHUNK}
	{
		vec4 inkView = mvPosition;
		inkView.z -= uInkPush;
		vec4 inkClip = projectionMatrix * inkView;
		inkClip.xy += uInkShift * ( 2.0 * uInkPx * uInkCard ) / uToonView * inkClip.w;
		gl_Position = inkClip;
	}`,
  );
  return `uniform float uInkPx;\nuniform float uInkPush;\nuniform float uInkCard;\nuniform vec2 uToonView;\nuniform vec2 uInkShift;\n${out}`;
}

/** The card ink's fragment: the picture only decides the shape, the colour is the ink's. */
export function patchCardInkFragment(source: string): string {
  const out = replaceOnce(source, OUTGOING, "vec3 outgoingLight = uInkColor;");
  return `uniform vec3 uInkColor;\n${out}`;
}
