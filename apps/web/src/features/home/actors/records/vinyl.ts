/**
 * One vinyl disc, made in code: a thin black disc with a groove shader and a paper label that
 * carries the cover. The disc lies in the XZ plane (its axis is Y, the label side is +Y), in metres, with its bottom face at y 0 and its top at the disc's thickness: on the platter's seat it stands on the platter, as the rig's seat height says.
 *
 * The groove shader is the standard material of the cast with three additions, written in
 * `onBeforeCompile`: fine concentric rings that fade with the pixel size (so a small disc never
 * moires), smooth gaps between tracks, a smooth run-out and lead-in, a little dust, and the sheen
 * of a record, which is a highlight that stays where the light is while the disc turns (grooves
 * run round the disc, so the light is caught in two opposite wedges, found from the groove's
 * tangent and the half vector of the light and the view).
 */
import {
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  type BufferGeometry,
  type Texture,
  type Vector3,
  Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

const FRAG_HEAD = /* glsl */ `
varying vec3 vObjPos;
varying vec3 vObjNormal;
uniform mat3 normalMatrix;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
float grHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float grSheen(vec3 t, vec3 l, vec3 v, float power) {
  vec3 h = normalize(l + v);
  float th = dot(t, h);
  return pow(sqrt(max(0.0, 1.0 - th * th)), power);
}
`;

const FRAG_GROOVES = /* glsl */ `
float grR = length(vObjPos.xz);
float grTop = step(0.5, abs(vObjNormal.y));
float grPh = grR / ${DISC.groovePitch.toFixed(5)};
float grFw = fwidth(grPh);
float grVis = (1.0 - smoothstep(0.30, 0.85, grFw)) * grTop;
float grRing = 0.5 + 0.5 * sin(6.2831853 * grPh);
float grGap = 0.0;
grGap = max(grGap, 1.0 - smoothstep(0.0009, 0.0022, abs(grR - 0.081)));
grGap = max(grGap, 1.0 - smoothstep(0.0009, 0.0022, abs(grR - 0.103)));
grGap = max(grGap, 1.0 - smoothstep(0.0009, 0.0022, abs(grR - 0.121)));
float grLead = smoothstep(0.1335, 0.1385, grR);
float grDead = 1.0 - smoothstep(0.052, 0.060, grR);
float grSmooth = clamp(grGap + grLead + grDead, 0.0, 1.0);
float grGroove = grVis * (1.0 - grSmooth);
roughnessFactor = mix(roughnessFactor, mix(0.5, 0.2, grRing), grGroove);
roughnessFactor = mix(roughnessFactor, 0.14, grSmooth * grTop);
diffuseColor.rgb *= 1.0 + (grRing - 0.5) * 0.9 * grGroove;
vec2 grCell = floor(vObjPos.xz * 1300.0);
float grDust = step(0.9992, grHash(grCell)) * grTop;
diffuseColor.rgb += vec3(0.2) * grDust;
`;

const FRAG_SHEEN = /* glsl */ `
vec3 grTObj = normalize(vec3(-vObjPos.z, 0.0, vObjPos.x) + vec3(1e-6, 0.0, 0.0));
vec3 grT = normalize(normalMatrix * grTObj);
vec3 grV = normalize(vViewPosition);
float grS = grSheen(grT, normalize(uKeyDir), grV, 150.0) * 0.3 + grSheen(grT, normalize(uFillDir), grV, 100.0) * 0.1;
outgoingLight += vec3(0.86, 0.9, 1.0) * grS * (0.2 + 0.8 * grGroove) * grTop;
`;

export interface VinylLight {
  /** Direction toward the key light, in view space (the cast's camera does not turn: world space). Updated by the actor. */
  key: Vector3;
  fill: Vector3;
}

/** The black vinyl with its grooves. `env` is the cast's environment. */
function vinylMaterial(env: Texture, light: VinylLight): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: 0x0b0b0e,
    roughness: 0.46,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.32,
  });
  material.name = "vinyl";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uKeyDir = { value: light.key };
    shader.uniforms.uFillDir = { value: light.fill };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvObjPos = position;\nvObjNormal = normal;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>\n${FRAG_GROOVES}`,
      )
      .replace("#include <opaque_fragment>", `${FRAG_SHEEN}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "home-vinyl-1";
  return material;
}

export interface Vinyl {
  /** The root of the disc. Its origin is the middle of the disc, the label side is +Y. */
  readonly group: Group;
  /** The cover on the label. Null leaves a plain paper label. */
  setCover(texture: Texture | null, tint?: string | null): void;
  dispose(): void;
}

/** Build a disc. The cover texture is shared with the sleeve: the disc never disposes it. */
export function createVinyl(env: Texture, light: VinylLight): Vinyl {
  const group = new Group();
  group.name = "vinyl";
  const bodyGeometry = discGeometry();
  const bodyMaterial = vinylMaterial(env, light);
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.name = "vinyl_body";
  group.add(body);

  const labelGeometry = new RingGeometry(DISC.hole, DISC.labelRadius, 64, 1);
  labelGeometry.rotateX(-Math.PI / 2);
  labelGeometry.translate(0, DISC.thickness + 0.0004, 0);
  const labelMaterial = new MeshStandardMaterial({
    color: 0xe9e3d6,
    roughness: 0.7,
    metalness: 0,
    envMap: env,
    envMapIntensity: 0.25,
    side: DoubleSide,
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
      // A covered label shows the picture as it is (a little under white: the cast's light is strong).
      labelMaterial.color.set(texture ? 0xdedede : 0xe9e3d6);
      if (!texture && tint) labelMaterial.color.set(tint);
      labelMaterial.needsUpdate = true;
    },
    dispose() {
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      labelGeometry.dispose();
      labelMaterial.dispose();
      group.removeFromParent();
    },
  };
}
