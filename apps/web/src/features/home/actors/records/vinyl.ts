/**
 * One vinyl disc, made in code: a thin dark disc with a paper label that carries the cover. The
 * disc lies in the XZ plane (its axis is Y, the label side is +Y), in metres, with its bottom face
 * at y 0 and its top at the disc's thickness: on the platter's seat it stands on the platter, as
 * the rig's seat height says.
 *
 * It is drawn in the anime look of the shared toon system (`../shared/toon.ts`): a flat navy black
 * body with an ink line, a few crisp lighter rings where the tracks part (and fine grooves that
 * fade out with the pixel size, so a small disc never moires), and the shine of a record as a
 * crisp shape: two hard edged fans of light, a narrow bright one inside a wide faint one, found
 * from the groove's tangent and the half vector of the toon light and the view, so they stay where
 * the light is while the disc turns. The label is the cover, unlit, so the picture reads as it is.
 */
import {
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type BufferGeometry,
  type Texture,
  type WebGLProgramParametersWithUniforms,
  Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { addInk, ToonMaterial, type Ink, type InkMaterial } from "../shared/toon";

import { DISC } from "./facts";

const SEGMENTS = 96;

/** The disc's body: the two faces with the spindle's hole, and the rim. One geometry. */
function discGeometry(): BufferGeometry {
  const half = DISC.thickness / 2;
  const top = new RingGeometry(DISC.hole, DISC.radius, SEGMENTS, 1);
  top.rotateX(-Math.PI / 2);
  top.translate(0, DISC.thickness, 0);
  const bottom = new RingGeometry(DISC.hole, DISC.radius, SEGMENTS, 1);
  bottom.rotateX(Math.PI / 2);
  bottom.translate(0, 0, 0);
  const rim = new CylinderGeometry(DISC.radius, DISC.radius, DISC.thickness, SEGMENTS, 1, true);
  rim.translate(0, half, 0);
  const merged = mergeGeometries([top, bottom, rim]);
  top.dispose();
  bottom.dispose();
  rim.dispose();
  return merged;
}

const MAP_CHUNK = "#include <map_fragment>";
const OPAQUE_CHUNK = "#include <opaque_fragment>";
const BEGIN_CHUNK = "#include <begin_vertex>";

function replaceOnce(source: string, anchor: string, text: string): string {
  const at = source.indexOf(anchor);
  if (at < 0) {
    console.warn(`[vinyl] shader anchor not found: ${anchor}`);
    return source;
  }
  return source.slice(0, at) + text + source.slice(at + anchor.length);
}

const VERTEX_PARS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
uniform mat3 normalMatrix;
`;

/** After the picture is read: the rings of the grooves and the lighter lines where the tracks part. */
const FRAG_GROOVES = /* glsl */ `
float grR = length( vObjPos.xz );
float grTop = step( 0.5, abs( vObjNormal.y ) );
float grPh = grR / ${DISC.groovePitch.toFixed(5)};
float grFw = fwidth( grPh );
float grVis = ( 1.0 - smoothstep( 0.30, 0.85, grFw ) ) * grTop;
float grRing = 0.5 + 0.5 * sin( 6.2831853 * grPh );
float grGap = 0.0;
grGap = max( grGap, 1.0 - smoothstep( 0.0009, 0.0022, abs( grR - 0.081 ) ) );
grGap = max( grGap, 1.0 - smoothstep( 0.0009, 0.0022, abs( grR - 0.103 ) ) );
grGap = max( grGap, 1.0 - smoothstep( 0.0009, 0.0022, abs( grR - 0.121 ) ) );
float grLead = smoothstep( 0.1335, 0.1385, grR );
float grDead = 1.0 - smoothstep( 0.052, 0.060, grR );
float grSmooth = clamp( grGap + grLead + grDead, 0.0, 1.0 );
float grGroove = grVis * ( 1.0 - grSmooth );
diffuseColor.rgb *= 1.0 + ( grRing - 0.5 ) * 0.7 * grGroove;
diffuseColor.rgb += vec3( 0.05, 0.05, 0.1 ) * grGap * grTop;
`;

/** After the toon shade: two hard edged fans of light (Kajiya Kay's term, cut by smoothstep). */
const FRAG_SHEEN = /* glsl */ `
{
	vec3 grT = normalize( normalMatrix * vec3( -vObjPos.z, 0.0, vObjPos.x ) + vec3( 1e-5, 0.0, 0.0 ) );
	vec3 grH = normalize( uToonL + normalize( vToonV ) );
	float grTH = dot( grT, grH );
	float grS = sqrt( max( 0.0, 1.0 - grTH * grTH ) );
	float grFan = smoothstep( 0.988, 0.992, grS ) * 0.5 + smoothstep( 0.972, 0.976, grS ) * 0.14;
	float grArea = grTop * smoothstep( 0.052, 0.062, grR ) * ( 1.0 - smoothstep( 0.1385, 0.1395, grR ) );
	outgoingLight += vec3( 0.8, 0.85, 1.0 ) * ( grFan * grArea * uToonAmt );
}
`;

/** The disc's vertex shader: the position and the normal in the disc's own frame, for the rings. */
export function patchVinylVertex(source: string): string {
  const out = replaceOnce(
    source,
    BEGIN_CHUNK,
    `${BEGIN_CHUNK}\nvObjPos = position;\nvObjNormal = normal;`,
  );
  return `${VERTEX_PARS}${out}`;
}

/** The disc's fragment shader (after the toon patch, which declares `uToonL`, `uToonAmt` and `vToonV`). */
export function patchVinylFragment(source: string): string {
  let out = replaceOnce(source, MAP_CHUNK, `${MAP_CHUNK}\n${FRAG_GROOVES}`);
  out = replaceOnce(out, OPAQUE_CHUNK, `${FRAG_SHEEN}\n${OPAQUE_CHUNK}`);
  return `${FRAG_PARS}${out}`;
}

/** The body: a navy black with the grooves and the shine. */
function vinylMaterial(): ToonMaterial {
  const material = new ToonMaterial({
    color: 0x22223a,
    look: "default",
    tune: { shade: [0.6, 0.64, 1.0], rim: 0.35, rimWidth: 0.22 },
    name: "vinyl",
  });
  const base = material.onBeforeCompile.bind(material);
  const baseKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    base(shader, renderer);
    shader.vertexShader = patchVinylVertex(shader.vertexShader);
    shader.fragmentShader = patchVinylFragment(shader.fragmentShader);
  };
  // The toon materials share one program key: this one has its own shader.
  material.customProgramCacheKey = () => `vinyl-${baseKey()}`;
  return material;
}

export interface Vinyl {
  /** The root of the disc. Its origin is the middle of the disc, the label side is +Y. */
  readonly group: Group;
  /** The cover on the label. Null leaves a plain paper label. */
  setCover(texture: Texture | null, tint?: string | null): void;
  dispose(): void;
}

/** Build a disc. `ink` is the actor's hull material. The cover texture is shared with the sleeve: the disc never disposes it. */
export function createVinyl(ink: InkMaterial): Vinyl {
  const group = new Group();
  group.name = "vinyl";
  const bodyGeometry = discGeometry();
  const bodyMaterial = vinylMaterial();
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.name = "vinyl_body";
  group.add(body);
  const hull: Ink = addInk(body, ink);

  const labelGeometry = new RingGeometry(DISC.hole, DISC.labelRadius, 64, 1);
  labelGeometry.rotateX(-Math.PI / 2);
  labelGeometry.translate(0, DISC.thickness + 0.0004, 0);
  // Unlit: the picture as it is. It sits a hair over the disc, so it is pulled forward in depth.
  const labelMaterial = new MeshBasicMaterial({
    color: 0xe9e3d6,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  labelMaterial.name = "vinyl_label";
  const label = new Mesh(labelGeometry, labelMaterial);
  label.name = "vinyl_label";
  group.add(label);

  return {
    group,
    setCover(texture, tint) {
      if (labelMaterial.map === texture) return;
      labelMaterial.map = texture;
      labelMaterial.color.set(texture ? 0xffffff : (tint ?? 0xe9e3d6));
      labelMaterial.needsUpdate = true;
    },
    dispose() {
      hull.remove();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      labelGeometry.dispose();
      labelMaterial.dispose();
      group.removeFromParent();
    },
  };
}
