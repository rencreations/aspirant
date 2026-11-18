/**
 * Selena's look, the recipe of the models' notes: toon steps instead of the plain physical
 * material (which blows the skin and the hair out to white), a thin cool rim, an ink outline made
 * by drawing the skinned mesh again on its back faces pushed along a smooth normal, and the alpha
 * hair with depth write on. It works with the cast's own lights (the toon material reads the
 * ambient and the directional lights) and with skinning and the face morph targets.
 *
 * Nothing here is gated on the device: one look for every screen.
 */
import {
  BackSide,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  SkinnedMesh,
  UnsignedByteType,
  type BufferGeometry,
  type IUniform,
  type MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { LOOK_RECIPE } from "./constants";
import { smoothNormals } from "./outline";

/** What every toon material of the figure shares, so one write reaches all of them. */
export interface ToonShared {
  /** The three light steps, nearest filtered so the steps stay hard. */
  gradient: DataTexture;
  gain: IUniform<number>;
  rimStrength: IUniform<number>;
  rim: IUniform<[number, number, number]>;
}

export function makeShared(gain: number): ToonShared {
  return {
    gradient: stepsTexture(),
    gain: { value: gain },
    rimStrength: { value: LOOK_RECIPE.rimStrength },
    rim: { value: [...LOOK_RECIPE.rim] },
  };
}

function stepsTexture(): DataTexture {
  const tex = new DataTexture(
    new Uint8Array(LOOK_RECIPE.steps),
    LOOK_RECIPE.steps.length,
    1,
    RedFormat,
    UnsignedByteType,
  );
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export interface ToonOptions {
  /** The picture carries the alpha (the fringe of hair): alpha test and depth write on. */
  alpha: boolean;
  /** A little brighter: the eyes must not fall into the shadow step. */
  lift?: number;
}

/** A toon material that takes the picture of a loaded material. */
export function makeToon(
  source: MeshStandardMaterial,
  shared: ToonShared,
  options: ToonOptions,
  anisotropy: number,
): MeshToonMaterial {
  const map: Texture | null = source.map;
  if (map) map.anisotropy = anisotropy;
  const toon = new MeshToonMaterial({
    map,
    color: source.color,
    gradientMap: shared.gradient,
    side: DoubleSide,
    transparent: options.alpha,
    alphaTest: options.alpha ? 0.02 : 0,
    depthWrite: true,
  });
  const lift = { value: options.lift ?? 1 };
  toon.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uGain = shared.gain;
    shader.uniforms.uRimStrength = shared.rimStrength;
    shader.uniforms.uRim = shared.rim;
    shader.uniforms.uLift = lift;
    shader.fragmentShader = [
      "uniform float uGain;",
      "uniform float uLift;",
      "uniform float uRimStrength;",
      "uniform vec3 uRim;",
      shader.fragmentShader,
    ]
      .join("\n")
      .replace(
        "#include <opaque_fragment>",
        [
          "outgoingLight = outgoingLight * (uGain * uLift) + uRim * pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0) * uRimStrength;",
          "#include <opaque_fragment>",
        ].join("\n"),
      );
  };
  toon.customProgramCacheKey = () => "selena-toon";
  return toon;
}

/** The ink: the mesh's back faces, pushed out along the smooth normal by `uOutline` (mesh units). */
export interface Ink {
  mesh: SkinnedMesh;
  width: IUniform<number>;
}

export function makeInk(source: SkinnedMesh, geometry: BufferGeometry): Ink {
  if (!geometry.getAttribute("smoothNormal")) {
    const pos = geometry.getAttribute("position");
    const nor = geometry.getAttribute("normal");
    // Read through the accessors: the file may keep its attributes interleaved or quantised.
    const places = new Float32Array(pos.count * 3);
    const normals = new Float32Array(nor.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      places[i * 3] = pos.getX(i);
      places[i * 3 + 1] = pos.getY(i);
      places[i * 3 + 2] = pos.getZ(i);
      normals[i * 3] = nor.getX(i);
      normals[i * 3 + 1] = nor.getY(i);
      normals[i * 3 + 2] = nor.getZ(i);
    }
    geometry.setAttribute(
      "smoothNormal",
      new Float32BufferAttribute(smoothNormals(places, normals), 3),
    );
  }
  const width: IUniform<number> = { value: 0.003 };
  const material = new MeshBasicMaterial({ color: LOOK_RECIPE.ink, side: BackSide });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uOutline = width;
    shader.vertexShader = [
      "uniform float uOutline;",
      "attribute vec3 smoothNormal;",
      shader.vertexShader,
    ]
      .join("\n")
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = normalize( smoothNormal );")
      .replace(
        "#include <skinning_vertex>",
        ["#include <skinning_vertex>", "transformed += normalize( objectNormal ) * uOutline;"].join(
          "\n",
        ),
      );
  };
  material.customProgramCacheKey = () => "selena-ink";
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = `${source.name}_ink`;
  // A sibling with the same transform: an attached skin takes its bind from its own world matrix.
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  mesh.updateMatrix();
  mesh.bind(source.skeleton, source.bindMatrix);
  mesh.frustumCulled = false;
  // The ink follows the face: it shares the morph weights of its mesh.
  if (source.morphTargetInfluences) {
    mesh.morphTargetInfluences = source.morphTargetInfluences;
    mesh.morphTargetDictionary = source.morphTargetDictionary;
  }
  return { mesh, width };
}
