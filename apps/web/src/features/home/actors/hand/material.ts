/**
 * The hand's look: the anime recipe of the shared toon system (`../shared/toon.ts`), the same
 * drawing as Selena, Tetra and the drone. Cel bands from the cast's one toon light (a violet black
 * leather with a blue shade and a hard glint shape), a crisp violet rim, claws and a bracer drawn as
 * flat bright colour, and a bold ink line of constant width on the screen (the shared `InkMaterial`,
 * not a copy of one). The extras are in `glsl.ts`; the numbers are `LOOK` in `constants.ts`.
 *
 * The glove and its ink fade out at the foot of the screen (`FADE`), in the material, by the
 * vertex's own height on the screen: the hand dissolves into whatever is behind it, so the end of
 * the sleeve can never show and a hand that sinks goes from its lowest part upward. It is alpha
 * blending, not a quad over the page, because the page behind changes (daybreak, storm) and a quad
 * could not match it.
 *
 * Both materials chain their own patch AFTER the toon one and give a program key of their own: the
 * toon materials share one program key for the whole cast, and without a key of its own the fade
 * would reach Selena's ink or be missing here.
 *
 * Nothing here is gated on the device: one look for every screen.
 */
import {
  Vector2,
  Vector3,
  type IUniform,
  type Material,
  type MeshStandardMaterial,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

import { INK_COLOR, InkMaterial, ToonMaterial } from "../shared/toon";

import { FADE, LOOK } from "./constants";
import {
  patchFadeVertex,
  patchGloveFragment,
  patchInkFadeFragment,
  patchInkFadeVertex,
} from "./glsl";

/** What the glove and its ink share, so one write reaches both. */
export interface LookUniforms {
  fade: IUniform<Vector2>;
  lift: IUniform<Vector3>;
  rim: IUniform<Vector3>;
  /** Rim strength, rim width. */
  rimK: IUniform<Vector2>;
  /** The claws' flat brightness, the share of the shading kept under it. */
  claw: IUniform<Vector2>;
  /** The colour of a claw (linear). */
  clawColor: IUniform<Vector3>;
}

export function makeUniforms(): LookUniforms {
  return {
    fade: { value: new Vector2(FADE.lo, FADE.hi) },
    lift: { value: new Vector3(...LOOK.lift) },
    rim: { value: new Vector3(...LOOK.rim) },
    rimK: { value: new Vector2(LOOK.rimStrength, LOOK.rimWidth) },
    claw: { value: new Vector2(LOOK.clawFlat, LOOK.clawKeep) },
    clawColor: { value: new Vector3(...LOOK.clawColor) },
  };
}

/** Run `extra` after the material's own patch, and make the program key its own. */
function chain(
  material: Material,
  key: string,
  extra: (shader: WebGLProgramParametersWithUniforms) => void,
): void {
  const base = material.onBeforeCompile.bind(material);
  const baseKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    extra(shader);
  };
  material.customProgramCacheKey = () => `${key}-${baseKey()}`;
}

/**
 * The glove's material: it takes the picture of the loaded one. Its normal map is left out: the
 * game's map is not a plain tangent space one (read as one it turns every normal sideways), and
 * cel bands do not need the fine detail.
 */
export function makeGlove(
  source: MeshStandardMaterial,
  uniforms: LookUniforms,
  anisotropy: number,
): ToonMaterial {
  const map: Texture | null = source.map;
  if (map) map.anisotropy = anisotropy;
  const material = new ToonMaterial({
    map,
    color: source.color,
    look: "default",
    tune: LOOK.leather,
    transparent: true,
    depthWrite: true,
    name: "hand-glove",
  });
  chain(material, "hand-glove", (shader) => {
    Object.assign(shader.uniforms, {
      uFade: uniforms.fade,
      uLift: uniforms.lift,
      uHandRim: uniforms.rim,
      uHandRimK: uniforms.rimK,
      uClaw: uniforms.claw,
      uClawColor: uniforms.clawColor,
    });
    shader.vertexShader = patchFadeVertex(shader.vertexShader);
    shader.fragmentShader = patchGloveFragment(shader.fragmentShader);
  });
  return material;
}

/** The ink: the shared hull material, with the same fade at the foot as the glove. */
export function makeInk(uniforms: LookUniforms): InkMaterial {
  const ink = new InkMaterial(INK_COLOR);
  ink.transparent = true;
  ink.depthWrite = true;
  chain(ink, "hand-ink", (shader) => {
    shader.uniforms.uFade = uniforms.fade;
    shader.vertexShader = patchInkFadeVertex(shader.vertexShader);
    shader.fragmentShader = patchInkFadeFragment(shader.fragmentShader);
  });
  return ink;
}
