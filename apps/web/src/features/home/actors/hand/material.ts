/**
 * The hand's look, in the family of Selena's: toon steps instead of the plain physical material
 * (which turns a black glove into a flat hole), a cool rim so the dark glove stands off a dark
 * ground, a stepped gloss on the key light, claws that glow with their own colour, and an ink
 * outline made by drawing the skinned mesh again on its back faces pushed along a smooth normal.
 *
 * The glove and the ink fade out at the foot of the screen (`FADE`), in the material, by the
 * vertex's own height on the screen: the hand dissolves into whatever is behind it, so the end of
 * the sleeve can never show and a hand that sinks goes from its lowest part upward. It is alpha
 * blending, not a quad over the page, because the page behind changes (daybreak, storm) and a quad
 * could not match it.
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
  Vector2,
  Vector3,
  type BufferGeometry,
  type IUniform,
  type MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { FADE, LOOK } from "./constants";
import { smoothNormals } from "./outline";

/** What the glove and its ink share, so one write reaches both. */
export interface LookUniforms {
  fade: IUniform<Vector2>;
  rim: IUniform<Vector3>;
  rimStrength: IUniform<number>;
  gloss: IUniform<number>;
  glossStrength: IUniform<number>;
  clawGlow: IUniform<number>;
  /** How much of the key's colour the gloss takes: it follows the cast's light rig. */
  spec: IUniform<Vector3>;
}

export function makeUniforms(): LookUniforms {
  return {
    fade: { value: new Vector2(FADE.lo, FADE.hi) },
    rim: { value: new Vector3(...LOOK.rim) },
    rimStrength: { value: LOOK.rimStrength },
    gloss: { value: LOOK.gloss },
    glossStrength: { value: LOOK.glossStrength },
    clawGlow: { value: LOOK.clawGlow },
    spec: { value: new Vector3(0.82, 0.78, 1) },
  };
}

function stepsTexture(): DataTexture {
  const tex = new DataTexture(
    new Uint8Array(LOOK.steps),
    LOOK.steps.length,
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

/** The fade at the foot of the screen, written into a vertex and a fragment shader. */
function addFade(shader: WebGLProgramParametersWithUniforms, uniforms: LookUniforms): void {
  shader.uniforms.uFade = uniforms.fade;
  shader.vertexShader = ["varying float vFadeY;", shader.vertexShader]
    .join("\n")
    .replace(
      "#include <project_vertex>",
      ["#include <project_vertex>", "vFadeY = gl_Position.y / gl_Position.w;"].join("\n"),
    );
}

export interface Glove {
  material: MeshToonMaterial;
  gradient: DataTexture;
}

/**
 * The glove's material: it takes the picture of the loaded one. Its normal map is left out: the
 * game's map is not a plain tangent space one (read as one it turns every normal sideways), and
 * the toon steps do not need the fine detail.
 */
export function makeGlove(
  source: MeshStandardMaterial,
  uniforms: LookUniforms,
  anisotropy: number,
): Glove {
  const gradient = stepsTexture();
  const map: Texture | null = source.map;
  if (map) map.anisotropy = anisotropy;
  const material = new MeshToonMaterial({
    map,
    color: source.color,
    gradientMap: gradient,
    side: DoubleSide,
    transparent: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    addFade(shader, uniforms);
    shader.uniforms.uRim = uniforms.rim;
    shader.uniforms.uRimStrength = uniforms.rimStrength;
    shader.uniforms.uGloss = uniforms.gloss;
    shader.uniforms.uGlossStrength = uniforms.glossStrength;
    shader.uniforms.uClawGlow = uniforms.clawGlow;
    shader.uniforms.uSpec = uniforms.spec;
    shader.fragmentShader = [
      "varying float vFadeY;",
      "uniform vec2 uFade;",
      "uniform vec3 uRim;",
      "uniform float uRimStrength;",
      "uniform float uGloss;",
      "uniform float uGlossStrength;",
      "uniform float uClawGlow;",
      "uniform vec3 uSpec;",
      shader.fragmentShader,
    ]
      .join("\n")
      .replace(
        "#include <opaque_fragment>",
        [
          "{",
          "  vec3 V = normalize( vViewPosition );",
          "  float mx = max( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b );",
          "  float mn = min( min( diffuseColor.r, diffuseColor.g ), diffuseColor.b );",
          "  float claw = smoothstep( 0.1, 0.26, mx - mn ) * smoothstep( 0.12, 0.3, mx );",
          "  vec3 lit = outgoingLight + diffuseColor.rgb * claw * uClawGlow;",
          "  #if NUM_DIR_LIGHTS > 0",
          "  vec3 Hh = normalize( directionalLights[ 0 ].direction + V );",
          "  float band = smoothstep( 0.3, 0.62, pow( saturate( dot( normal, Hh ) ), uGloss ) );",
          "  lit += uSpec * band * uGlossStrength * ( 1.0 - 0.5 * claw );",
          "  #endif",
          "  lit += uRim * pow( 1.0 - saturate( dot( V, normal ) ), 3.0 ) * uRimStrength;",
          "  outgoingLight = lit;",
          "  diffuseColor.a *= smoothstep( uFade.x, uFade.y, vFadeY );",
          "}",
          "#include <opaque_fragment>",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "hand-glove";
  return { material, gradient };
}

/** The ink: the mesh's back faces, pushed out along the smooth normal by `width` (mesh units). */
export interface Ink {
  mesh: SkinnedMesh;
  width: IUniform<number>;
  material: MeshBasicMaterial;
}

export function makeInk(
  source: SkinnedMesh,
  geometry: BufferGeometry,
  uniforms: LookUniforms,
): Ink {
  if (!geometry.getAttribute("smoothNormal")) {
    const pos = geometry.getAttribute("position");
    const nor = geometry.getAttribute("normal");
    // Read through the accessors: the file keeps its attributes quantised.
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
  const width: IUniform<number> = { value: 0.001 };
  const material = new MeshBasicMaterial({
    color: LOOK.ink,
    side: BackSide,
    transparent: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    addFade(shader, uniforms);
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
    shader.fragmentShader = ["varying float vFadeY;", "uniform vec2 uFade;", shader.fragmentShader]
      .join("\n")
      .replace(
        "#include <opaque_fragment>",
        [
          "diffuseColor.a *= smoothstep( uFade.x, uFade.y, vFadeY );",
          "#include <opaque_fragment>",
        ].join("\n"),
      );
  };
  material.customProgramCacheKey = () => "hand-ink";
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = `${source.name}_ink`;
  // A sibling with the same transform: an attached skin takes its bind from its own world matrix.
  mesh.position.copy(source.position);
  mesh.quaternion.copy(source.quaternion);
  mesh.scale.copy(source.scale);
  mesh.updateMatrix();
  mesh.bind(source.skeleton, source.bindMatrix);
  mesh.frustumCulled = false;
  return { mesh, width, material };
}
