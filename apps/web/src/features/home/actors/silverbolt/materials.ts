/**
 * The look of Silverbolt in the shared cast pass: the anime look of the toon system
 * (`actors/shared/toon.ts`), the same drawing as Tetra and the drone. The loader gives every part a
 * `MeshStandardMaterial` painted with the light already in the pictures; `toonify` replaces them.
 *
 *  - the silver armour is cel shaded metal: three crisp bands, a hard glint, a pale rim, no
 *    reflection and no environment;
 *  - the cheek crystals are saturated colour that glows (`setEmissive`) with the same bands;
 *  - the eyes are the picture itself, unlit, tinted red when it is angry;
 *  - the flame ribbon is a flat saturated sheet with a lighter inner band and a rim, drawn last with
 *    no depth write, and an ink line round it (the card ink: copies shifted by the line width);
 *  - an ink hull of constant width on the screen round the armour (`set.setHeight` every frame).
 */
import {
  type Material,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from "three";

import {
  INK_FLOOR_BODY,
  INK_TINTS,
  toonify,
  type ToonMaterial,
  type ToonPick,
  type ToonSet,
} from "../shared/toon";

export interface SbMaterials {
  body: ToonMaterial;
  socket: ToonMaterial;
  crystal: ToonMaterial;
  ribbon: ToonMaterial;
  /** The eyes: the atlas as it is. The actor tints `color` for the glow and the anger. */
  gem: MeshBasicMaterial;
  set: ToonSet;
}

const isStandard = (m: Material): m is MeshStandardMaterial =>
  (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/** How each of the five named materials is drawn. */
const PICKS: Readonly<Record<string, ToonPick>> = {
  // The armour: metal, with a hull. The hull is the one outline of the figure.
  // Round four: softer than the stock metal. The in-game armour is white lilac with a gentle lilac
  // shade, so the shade bands are light and the hull is a fine line (the old 1.4 weight inked a
  // heavy navy rim round every panel, worst on the head).
  silverbolt_body: {
    look: "metal",
    // Round seven: the in-game hairline (about 3 px at 3840 wide) in the colour of the armour, a
    // deep lavender grey on the white and a brown on the gold, never a black navy rim.
    inkWeight: 1,
    inkTint: INK_TINTS.body,
    inkFloor: INK_FLOOR_BODY,
    tune: { shade: [0.72, 0.72, 0.93], deep: [0.52, 0.54, 0.82], sat: 1.12, rim: 0.45, glint: 0.8 },
  },
  // The two eyes: flat, bright, no hull (they are 3 px at the smallest size).
  silverbolt_gem: { unlit: true },
  // The silver lid behind each eye.
  silverbolt_socket: { look: "metal", ink: false },
  // The cheek crystals: glow, bands, no hull (the cheek blade's hull is round them).
  silverbolt_crystal: { look: "default", ink: false },
  // The flame ribbon: a sheet, a flat colour with a lighter band, ink by the card copies.
  silverbolt_ribbon: { look: "soft", ink: false, tune: { rim: 0.55, rimWidth: 0.3 } },
};

/** Where the stock fragment shader samples the picture. */
export const MAP_CHUNK = "#include <map_fragment>";

/**
 * Cut a painted gradient into steps (`levels`, in a gamma 2 space so the steps are even to the
 * eye): a flat colour for each, as a cel drawing has it, not an airbrush. `mode` "colour" cuts each
 * channel (the ribbon's flame goes cyan, blue, violet, red in flat bands); "tone" cuts only the
 * lightness and keeps the hue, so the soft highlights of the armour become hard shapes without the
 * speckle that cutting each channel makes of the noise in the paint.
 */
export function posterizeGlsl(levels: number, mode: StepMode): string {
  const n = levels.toFixed(1);
  if (mode === "colour") {
    return `${MAP_CHUNK}
	{
		vec3 stepped = sqrt( max( diffuseColor.rgb, vec3( 0.0 ) ) );
		vec3 level = stepped * ${n};
		// Where one pixel spans many steps (a small figure) keep the colour as it is: cutting
		// what is already a blur of noisy paint only speckles it.
		float span = max( max( fwidth( level.r ), fwidth( level.g ) ), fwidth( level.b ) );
		stepped = mix( floor( level + 0.5 ), level, smoothstep( 0.35, 0.9, span ) ) / ${n};
		diffuseColor.rgb = stepped * stepped;
	}`;
  }
  return `${MAP_CHUNK}
	{
		float tone = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		float toneG = sqrt( max( tone, 0.0001 ) );
		float toneLevel = toneG * ${n};
		float toneSpan = fwidth( toneLevel );
		float cut = mix( floor( toneLevel + 0.5 ), toneLevel, smoothstep( 0.35, 0.9, toneSpan ) ) / ${n};
		diffuseColor.rgb *= clamp( ( cut * cut ) / max( tone, 0.0001 ), 0.0, 1.6 );
	}`;
}

/**
 * Take the painted shading out of the armour's picture. The atlas is 512 pixels with the light
 * painted into it (airbrushed shadows, cream blotches). Cutting that into steps made the mottled
 * patches of the old head, and leaving it as it is under the toon bands doubles every shadow. Here
 * the lightness is pulled toward one value for each kind of surface (silver, gold), so the colour
 * and the panel edges stay and the blotches go; the toon bands then draw the shape. Gold gets a
 * richer saturation (the picture's gold is a muddy tan). The blue crystals are left as drawn.
 */
function flattenGlsl(): string {
  return `${MAP_CHUNK}
	{
		float tone = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
		vec3 g = sqrt( max( diffuseColor.rgb, vec3( 0.0 ) ) );
		float lum = dot( g, vec3( 0.299, 0.587, 0.114 ) );
		float hi = max( g.r, max( g.g, g.b ) );
		float lo = min( g.r, min( g.g, g.b ) );
		float sat = ( hi - lo ) / max( hi, 0.001 );
		float warm = smoothstep( 0.1, 0.26, g.r - g.b ) * smoothstep( 0.0, 0.08, g.g - g.b );
		float blue = smoothstep( 0.25, 0.5, g.b - g.r ) * smoothstep( 0.3, 0.55, sat );
		float mid = mix( 0.86, 0.68, warm );
		float amount = mix( 0.6, 0.0, blue ) * smoothstep( 0.1, 0.3, lum );
		float level = mix( lum, mid, amount );
		g *= clamp( level / max( lum, 0.001 ), 0.6, 2.0 );
		float lum2 = dot( g, vec3( 0.299, 0.587, 0.114 ) );
		g = mix( vec3( lum2 ), g, 1.0 + 0.95 * warm );
		diffuseColor.rgb = clamp( g * g, 0.0, 1.0 );
	}`;
}

export type StepMode = "colour" | "tone";

/** The same cut of one channel (or of the tone) in plain numbers; the tests hold the shader to it. */
export function posterizeChannel(value: number, levels: number): number {
  const g = Math.sqrt(Math.max(0, value));
  const cut = Math.floor(g * levels + 0.5) / levels;
  return cut * cut;
}

/** How many steps a channel of the ribbon's colour has, and of the armour's. */
const RIBBON_STEPS = 10;

/** Make a toon material draw its picture through a different fragment patch at the map chunk. */
function patchMap(material: ToonMaterial, glsl: string, key: string): void {
  const patched = material.onBeforeCompile.bind(material);
  const cache = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    patched(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(MAP_CHUNK, glsl);
  };
  material.customProgramCacheKey = () => `${cache()}-${key}`;
  material.needsUpdate = true;
}

/** Make a toon material draw its picture in steps (the painted soft light becomes flat shapes). */
function cutIntoSteps(material: ToonMaterial, levels: number, mode: StepMode): void {
  const patched = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    patched(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(MAP_CHUNK, posterizeGlsl(levels, mode));
  };
  material.customProgramCacheKey = () => `${key()}-${mode}${levels}`;
  material.needsUpdate = true;
}

/**
 * Convert the model. Finds the five materials by name (throws if the build changed them), puts the
 * toon look and the ink on them and sorts the ribbon after everything opaque.
 */
export function dress(scene: Object3D): { materials: SbMaterials; skinned: SkinnedMesh[] } {
  const skinned: SkinnedMesh[] = [];
  const sources: MeshStandardMaterial[] = [];
  scene.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinned.push(mesh);
    // The pose of the bones, not the quantised box, decides what is in view.
    mesh.frustumCulled = false;
    if (!Array.isArray(mesh.material) && isStandard(mesh.material)) sources.push(mesh.material);
  });
  const set = toonify(scene, {
    pick: (_mesh, source) => PICKS[source.name],
    anisotropy: 8,
    fineInk: true,
  });
  // The loader's own materials are not drawn any more: let go of the maps the toon look does not read.
  for (const source of sources) {
    source.normalMap?.dispose();
    source.roughnessMap?.dispose();
    source.metalnessMap?.dispose();
    source.aoMap?.dispose();
    source.dispose();
  }

  const found: Record<string, Material> = {};
  for (const m of set.materials) found[m.name] = m;
  const body = found.silverbolt_body as ToonMaterial | undefined;
  const gem = found.silverbolt_gem as MeshBasicMaterial | undefined;
  const socket = found.silverbolt_socket as ToonMaterial | undefined;
  const crystal = found.silverbolt_crystal as ToonMaterial | undefined;
  const ribbon = found.silverbolt_ribbon as ToonMaterial | undefined;
  if (!body || !gem || !socket || !crystal || !ribbon) {
    throw new Error("Silverbolt's materials are not the ones the build wrote");
  }
  // The painted gradients are cut into steps in the fragment shader, after the toon patch.
  cutIntoSteps(ribbon, RIBBON_STEPS, "colour");
  patchMap(body, flattenGlsl(), "flat1");
  // The ribbon is a soft sheet: no depth write, drawn after the opaque parts.
  ribbon.transparent = true;
  ribbon.depthWrite = false;
  scene.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (mesh.isMesh && mesh.material === ribbon) mesh.renderOrder = 1;
  });
  return { materials: { body, gem, socket, crystal, ribbon, set }, skinned };
}
