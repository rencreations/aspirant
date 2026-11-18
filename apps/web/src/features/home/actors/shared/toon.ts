/**
 * The toon system: the anime look of every lit character of the home (Selena, her hand, Silverbolt,
 * the Obsidia doll, the gramophone, the record crate). Tetra and the drone are painted unlit with a
 * bold ink line; this gives the models that came with PBR materials the same drawing: cel bands
 * from one shared key light, a hue shifted shade, a thin rim on the shadow side, a crisp highlight
 * shape, and an ink hull whose width is constant on the screen. No environment map, no metalness
 * or roughness, no tone mapping, no lights of the scene.
 *
 * HOW IT IS BUILT. `ToonMaterial` is three's `MeshBasicMaterial` with its lighting replaced through
 * `onBeforeCompile` (`toon-glsl.ts`), so skinning, morph targets (and morph normals), clipping
 * planes, `map`, `alphaTest`, `transparent`, `side` and vertex colours all go through three's own
 * chunks. One program per band count (2 or 3) and one more with a glow map. The ink is a second
 * mesh, the same geometry drawn inside out with `InkMaterial`: the vertex is moved along the smooth
 * normal in CLIP space by a number of CSS pixels, so the line keeps its width at any distance and
 * any size, and pushed back a little in depth so a one sided card never fights its ink.
 *
 * API (all of it is allocation free per frame):
 *
 *   // 1. Convert a loaded glTF scene (the usual way). Keeps the textures, drops normal and
 *   //    metalness maps, puts an ink hull on every mesh.
 *   const set = toonify(gltf.scene, {
 *     pick: (mesh, source) => mesh.name.includes("hair") ? { look: "hair" } : undefined,
 *     clippingPlanes: planes,        // optional: the actor's planes go on the skin and the ink
 *   });
 *   // every frame the actor is shown:
 *   set.setHeight(heightOnScreenPx); // ink width and push from the figure's height in CSS pixels
 *   // when the actor goes:
 *   set.dispose();                   // its materials and the ink meshes (not the textures or geometry)
 *
 *   // 2. Or build by hand.
 *   const m = new ToonMaterial({ map, color, look: "skin", tune: { soft: 0.05 }, side: DoubleSide });
 *   m.setLook(TOON_LOOKS.metal);     // swap the whole look any time (changing bands recompiles once)
 *   const ink = new InkMaterial();   // ONE for the actor, shared by its hulls
 *   const hull = addInk(mesh, ink);  // a sibling mesh with the same skeleton and morphs; hull.remove()
 *   ink.setSize(heightOnScreenPx);
 *
 *   // 3. The one light all of them share (the camera's space: x right, y up, z toward the viewer).
 *   toonLight.set(-0.5, 0.55, 0.67); // a section may swing it, e.g. a slow sweep for a reveal
 *   toonLight.amount.value = 0.4;    // 0 flat colour with no shade or rim, 1 full (ease it for a fade)
 *
 * THE LOOK RULES (so every model draws alike).
 *   - Two bands for skin and cloth, three for hair and metal. Band edges are soft by 0.03 to 0.05 on
 *     the dot of normal and light: crisp but anti aliased, never a gradient.
 *   - The shade is the painted colour times a cool tint (`shade`), pushed in saturation (`sat`). Skin
 *     takes a warm tint (a pink orange shade), not a grey one.
 *   - Rim: a thin pale blue band at the silhouette, only on the side the light does not reach.
 *   - Glint: a small hard shape on metal and hair (`glint`, `glintSize`), on the lit side only.
 *   - Ink: about 2 to 3 px at 1440x900, a little thicker for a bigger figure (`outlineFor`), the
 *     colour a deep tinted dark (`INK_COLOR`), never black.
 *   - Eyes, mouths, screens and anything painted bright are drawn unlit: `unlitFrom(source)`.
 *
 * `cast.ts` keeps the pixel of the canvas (`setToonView`) up to date; `getCast(stage).toon` is the
 * light. Notes: `docs/design/home/toon.md`.
 */
import {
  BackSide,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  SkinnedMesh,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Color,
  type ColorRepresentation,
  type IUniform,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type Plane,
  type Side,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";

import {
  patchCardInkFragment,
  patchCardInkVertex,
  patchInkVertex,
  patchToonFragment,
  patchToonVertex,
} from "./toon-glsl";
import {
  outlineFor,
  smoothNormals,
  tuneLook,
  weldStep,
  type InkSize,
  type Rgb,
  type ToonLookSpec,
} from "./toon-math";

export type { InkSize, ToonLookSpec } from "./toon-math";

/** The ink: a deep violet navy, never black (the drone's and Tetra's line are of this family). */
export const INK_COLOR = 0x20182e;

// ------------------------------------------------------------------ the shared light

export interface ToonLight {
  /** Toward the light, unit length, in the camera's space (x right, y up, z toward the viewer). */
  readonly dir: IUniform<Vector3>;
  /** 0 is flat colour (no shade, no rim), 1 is the full look. */
  readonly amount: IUniform<number>;
  /** The rim colour (linear). */
  readonly rim: IUniform<Vector3>;
  /** The canvas in CSS pixels (the ink's width is in them). `cast.ts` keeps it right. */
  readonly view: IUniform<Vector2>;
  /** Point the light somewhere (it is normalised). */
  set(x: number, y: number, z: number): void;
}

/** Where the light starts: high, a little to the left, in front. Faces read well with it. */
const KEY: readonly [number, number, number] = [-0.5, 0.55, 0.67];

export const toonLight: ToonLight = {
  dir: { value: new Vector3(KEY[0], KEY[1], KEY[2]).normalize() },
  amount: { value: 1 },
  rim: { value: new Vector3(0.7, 0.85, 1.1) },
  view: { value: new Vector2(1440, 900) },
  set(x, y, z) {
    this.dir.value.set(x, y, z).normalize();
  },
};

/** Tell the toon materials how big the canvas is (CSS pixels). Called by the cast pass. */
export function setToonView(width: number, height: number): void {
  const v = toonLight.view.value;
  if (v.x !== width || v.y !== height) v.set(Math.max(1, width), Math.max(1, height));
}

// ------------------------------------------------------------------ looks

const lit1: Rgb = [1, 1, 1];

/**
 * The looks. Colours are linear multipliers of the painted colour. These are the numbers to tune
 * by eye; every model starts from one of them.
 */
export const TOON_LOOKS = {
  /** Cloth, plastic, anything: two bands, a cool violet shade. */
  default: {
    bands: 2,
    cut: [-0.25, 0.1],
    soft: 0.04,
    shade: [0.62, 0.68, 0.94],
    deep: [0.45, 0.5, 0.85],
    lit: lit1,
    sat: 1.15,
    rim: 0.5,
    rimWidth: 0.3,
    glint: 0,
    glintSize: 0.97,
  },
  /** Skin: a warm pink orange shade, a faint rim. */
  skin: {
    bands: 2,
    cut: [-0.25, 0.08],
    soft: 0.05,
    shade: [0.93, 0.68, 0.76],
    deep: [0.8, 0.52, 0.66],
    lit: lit1,
    sat: 1.2,
    rim: 0.35,
    rimWidth: 0.28,
    glint: 0,
    glintSize: 0.97,
  },
  /** Hair: three bands (a deep cool core), a crisp highlight shape. */
  hair: {
    bands: 3,
    cut: [-0.2, 0.12],
    soft: 0.04,
    shade: [0.66, 0.66, 0.92],
    deep: [0.42, 0.42, 0.78],
    lit: [1.04, 1.03, 1],
    sat: 1.2,
    rim: 0.5,
    rimWidth: 0.3,
    glint: 0.45,
    glintSize: 0.975,
  },
  /** Metal and armour: three bands with strong contrast and a hard glint. */
  metal: {
    bands: 3,
    cut: [-0.12, 0.14],
    soft: 0.03,
    shade: [0.52, 0.6, 0.9],
    deep: [0.3, 0.36, 0.7],
    lit: [1.06, 1.04, 1],
    sat: 1.25,
    rim: 0.65,
    rimWidth: 0.26,
    glint: 0.9,
    glintSize: 0.94,
  },
  /** Soft goods and paper: two bands, a gentler shade, no rim. */
  soft: {
    bands: 2,
    cut: [-0.25, 0.05],
    soft: 0.06,
    shade: [0.72, 0.74, 0.95],
    deep: [0.55, 0.58, 0.88],
    lit: lit1,
    sat: 1.1,
    rim: 0.2,
    rimWidth: 0.25,
    glint: 0,
    glintSize: 0.97,
  },
} as const satisfies Record<string, ToonLookSpec>;

type ToonLookName = keyof typeof TOON_LOOKS;

// ------------------------------------------------------------------ the material

export interface ToonParams {
  map?: Texture | null;
  color?: ColorRepresentation;
  look?: ToonLookName;
  /** Overrides of the look's numbers. */
  tune?: Partial<ToonLookSpec>;
  /** Light the surface itself gives (linear), not shaded. With `emissiveMap` it is the multiplier. */
  emissive?: Rgb;
  /** Only with `map` (it is read with the map's UV). */
  emissiveMap?: Texture | null;
  alphaTest?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  opacity?: number;
  side?: Side;
  vertexColors?: boolean;
  name?: string;
  clippingPlanes?: Plane[] | null;
}

/** The uniforms one toon material owns. */
interface OwnUniforms {
  shade: IUniform<Vector3>;
  deep: IUniform<Vector3>;
  lit: IUniform<Vector3>;
  sat: IUniform<number>;
  soft: IUniform<number>;
  cut: IUniform<Vector2>;
  rim: IUniform<Vector2>;
  glint: IUniform<Vector2>;
  emissive: IUniform<Vector3>;
  emissiveMap: IUniform<Texture | null>;
}

export class ToonMaterial extends MeshBasicMaterial {
  private readonly own: OwnUniforms = {
    shade: { value: new Vector3() },
    deep: { value: new Vector3() },
    lit: { value: new Vector3() },
    sat: { value: 1 },
    soft: { value: 0.04 },
    cut: { value: new Vector2() },
    rim: { value: new Vector2() },
    glint: { value: new Vector2() },
    emissive: { value: new Vector3() },
    emissiveMap: { value: null },
  };
  private bands: 2 | 3 = 2;
  private readonly glowMap: boolean;

  constructor(params: ToonParams = {}) {
    super({
      map: params.map ?? null,
      color: params.color ?? 0xffffff,
      side: params.side ?? DoubleSide,
      transparent: params.transparent ?? false,
      alphaTest: params.alphaTest ?? 0,
      opacity: params.opacity ?? 1,
      vertexColors: params.vertexColors ?? false,
      toneMapped: false,
      fog: false,
    });
    if (params.name) this.name = params.name;
    if (params.depthWrite !== undefined) this.depthWrite = params.depthWrite;
    if (params.clippingPlanes !== undefined) this.clippingPlanes = params.clippingPlanes;
    this.glowMap = !!(params.emissiveMap && params.map);
    this.own.emissiveMap.value = this.glowMap ? (params.emissiveMap ?? null) : null;
    const e = params.emissive ?? [0, 0, 0];
    this.own.emissive.value.set(e[0], e[1], e[2]);
    this.setLook(tuneLook(TOON_LOOKS[params.look ?? "default"], params.tune));
    this.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, {
        uToonL: toonLight.dir,
        uToonAmt: toonLight.amount,
        uToonRim: toonLight.rim,
        uShade: this.own.shade,
        uDeep: this.own.deep,
        uLit: this.own.lit,
        uSat: this.own.sat,
        uSoft: this.own.soft,
        uCut: this.own.cut,
        uRim: this.own.rim,
        uGlint: this.own.glint,
        uEmissive: this.own.emissive,
        uEmissiveMap: this.own.emissiveMap,
      });
      shader.vertexShader = patchToonVertex(shader.vertexShader);
      shader.fragmentShader = patchToonFragment(shader.fragmentShader);
    };
    this.customProgramCacheKey = () => `home-toon-b${this.bands}${this.glowMap ? "e" : ""}`;
  }

  /** Write a look into the uniforms. A different band count compiles the other program once. */
  setLook(look: ToonLookSpec): void {
    const u = this.own;
    u.shade.value.set(look.shade[0], look.shade[1], look.shade[2]);
    u.deep.value.set(look.deep[0], look.deep[1], look.deep[2]);
    u.lit.value.set(look.lit[0], look.lit[1], look.lit[2]);
    u.sat.value = look.sat;
    u.soft.value = look.soft;
    u.cut.value.set(look.cut[0], look.cut[1]);
    u.rim.value.set(look.rim, look.rimWidth);
    u.glint.value.set(look.glint, look.glintSize);
    if (look.bands !== this.bands || !this.defines) {
      this.bands = look.bands;
      this.defines = { TOON_BANDS: look.bands, ...(this.glowMap ? { TOON_EMISSIVE_MAP: 1 } : {}) };
      this.needsUpdate = true;
    }
  }

  /** The glow (linear), for a section that lights a part up. */
  setEmissive(r: number, g: number, b: number): void {
    this.own.emissive.value.set(r, g, b);
  }
}

/**
 * A plain unlit material from a loaded one: the picture as it is, no bands, no ink. For eyes,
 * mouths and anything painted bright.
 */
export function unlitFrom(
  source: MeshStandardMaterial,
  extra: { clippingPlanes?: Plane[] | null } = {},
): MeshBasicMaterial {
  const material = new MeshBasicMaterial({
    map: source.map,
    color: source.color,
    side: DoubleSide,
    transparent: source.transparent,
    alphaTest: source.alphaTest,
    opacity: source.opacity,
    toneMapped: false,
    fog: false,
  });
  material.name = source.name;
  if (extra.clippingPlanes !== undefined) material.clippingPlanes = extra.clippingPlanes;
  return material;
}

// ------------------------------------------------------------------ the ink

/** The hull's material: one for an actor, shared by its hulls. */
export class InkMaterial extends MeshBasicMaterial {
  /** The width and the push, shared with the card ink copies of the same figure. */
  readonly px: IUniform<number> = { value: 2 };
  readonly push: IUniform<number> = { value: 1 };
  readonly card: IUniform<number> = { value: 0.5 };
  private readonly size: InkSize = { px: 2, push: 1, card: 0.5 };

  /**
   * `weight` scales the line of this material (hair is fine: a full hull on thin locks fills them
   * with ink). The width, the push and the card line are set by `setSize`.
   */
  constructor(
    color: ColorRepresentation = INK_COLOR,
    clippingPlanes?: Plane[] | null,
    private readonly weight = 1,
  ) {
    super({ color, side: BackSide, toneMapped: false, fog: false });
    if (clippingPlanes !== undefined) this.clippingPlanes = clippingPlanes;
    this.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, {
        uInkPx: this.px,
        uInkPush: this.push,
        uToonView: toonLight.view,
      });
      shader.vertexShader = patchInkVertex(shader.vertexShader);
    };
    this.customProgramCacheKey = () => "home-toon-ink";
  }

  /** The line for a figure `heightPx` tall on the screen (CSS pixels). */
  setSize(heightPx: number): void {
    outlineFor(heightPx, this.size);
    this.px.value = this.size.px * this.weight;
    this.push.value = this.size.push;
    this.card.value = this.size.card;
  }

  /** The line as it is, in CSS pixels (a section that wants it thicker, say for a flash). */
  setWidth(px: number): void {
    this.px.value = px;
  }

  /** The line's width now, CSS pixels. */
  get width(): number {
    return this.px.value;
  }
}

/** One copy of the card ink: a card drawn shifted on the screen in ink colour, shaped by its alpha. */
export class CardInkMaterial extends MeshBasicMaterial {
  constructor(source: MeshBasicMaterial, ink: InkMaterial, dx: number, dy: number) {
    super({
      map: source.map,
      side: source.side,
      alphaTest: 0.3,
      toneMapped: false,
      fog: false,
    });
    const shift: IUniform<Vector2> = { value: new Vector2(dx, dy) };
    const color: IUniform<Color> = { value: ink.color };
    if (source.clippingPlanes) this.clippingPlanes = source.clippingPlanes;
    this.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, {
        uInkPx: ink.px,
        uInkPush: ink.push,
        uInkCard: ink.card,
        uToonView: toonLight.view,
        uInkShift: shift,
        uInkColor: color,
      });
      shader.vertexShader = patchCardInkVertex(shader.vertexShader);
      shader.fragmentShader = patchCardInkFragment(shader.fragmentShader);
    };
    this.customProgramCacheKey = () => "home-toon-card-ink";
  }
}

/** The smooth normal the hull is pushed along: one per place, so the hull has no gaps. Idempotent. */
export function ensureSmoothNormals(geometry: BufferGeometry): void {
  if (geometry.getAttribute("aSmooth")) return;
  const pos = geometry.getAttribute("position");
  const nor = geometry.getAttribute("normal");
  if (!nor) return;
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
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of places) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  geometry.setAttribute(
    "aSmooth",
    new Float32BufferAttribute(smoothNormals(places, normals, weldStep((hi - lo) * 1.7)), 3),
  );
}

export interface Ink {
  readonly mesh: Mesh;
  /** Take the hull away (the geometry and the material are not disposed). */
  remove(): void;
}

/**
 * The ink of one mesh: a sibling with the same transform, geometry, skeleton and morph weights,
 * drawn with `material` (shared). A skinned hull binds to the skin's own skeleton, so it follows
 * every bone and every spring.
 */
export function addInk(source: Mesh, material: InkMaterial): Ink {
  ensureSmoothNormals(source.geometry);
  const skinned = (source as SkinnedMesh).isSkinnedMesh ? (source as SkinnedMesh) : null;
  const hull: Mesh = skinned
    ? new SkinnedMesh(source.geometry, material)
    : new Mesh(source.geometry, material);
  hull.name = `${source.name}_ink`;
  hull.position.copy(source.position);
  hull.quaternion.copy(source.quaternion);
  hull.scale.copy(source.scale);
  hull.updateMatrix();
  if (skinned) (hull as SkinnedMesh).bind(skinned.skeleton, skinned.bindMatrix);
  hull.frustumCulled = false;
  hull.renderOrder = source.renderOrder;
  // The ink follows the face and every other morph: it shares the weights of its mesh.
  if (source.morphTargetInfluences) {
    hull.morphTargetInfluences = source.morphTargetInfluences;
    hull.morphTargetDictionary = source.morphTargetDictionary;
  }
  source.parent?.add(hull);
  return {
    mesh: hull,
    remove: () => {
      hull.removeFromParent();
    },
  };
}

/**
 * The ink of an alpha card: `copies` (8) siblings of the mesh, each drawn shifted by the line width
 * in another direction round the circle, in ink colour, cut by the card's own alpha. They share the
 * mesh's skeleton and the width of `ink`. `look` is the material the card is drawn with.
 */
export function addCardInk(
  source: Mesh,
  look: MeshBasicMaterial,
  ink: InkMaterial,
  copies = 8,
): Ink {
  const hulls: Mesh[] = [];
  const skinned = (source as SkinnedMesh).isSkinnedMesh ? (source as SkinnedMesh) : null;
  for (let i = 0; i < copies; i += 1) {
    const a = (i / copies) * Math.PI * 2;
    const material = new CardInkMaterial(look, ink, Math.cos(a), Math.sin(a));
    const hull: Mesh = skinned
      ? new SkinnedMesh(source.geometry, material)
      : new Mesh(source.geometry, material);
    hull.name = `${source.name}_card_ink_${i}`;
    hull.position.copy(source.position);
    hull.quaternion.copy(source.quaternion);
    hull.scale.copy(source.scale);
    hull.updateMatrix();
    if (skinned) (hull as SkinnedMesh).bind(skinned.skeleton, skinned.bindMatrix);
    hull.frustumCulled = false;
    if (source.morphTargetInfluences) {
      hull.morphTargetInfluences = source.morphTargetInfluences;
      hull.morphTargetDictionary = source.morphTargetDictionary;
    }
    source.parent?.add(hull);
    hulls.push(hull);
  }
  return {
    mesh: hulls[0]!,
    remove: () => {
      for (const hull of hulls) {
        hull.removeFromParent();
        (hull.material as Material).dispose();
      }
    },
  };
}

// ------------------------------------------------------------------ converting a scene

/** What a section or an actor may say about one mesh while a scene is converted. */
export interface ToonPick {
  look?: ToonLookName;
  tune?: Partial<ToonLookSpec>;
  /** Draw it as the picture it is: no bands, no ink. */
  unlit?: boolean;
  /**
   * `true` a hull (the default for an opaque mesh), `"card"` shifted copies cut by the alpha (the
   * fringe of hair, eight more draws of the mesh), `false` none (the default for alpha cards).
   */
  ink?: boolean | "card";
  /** The hull's line, as a share of the figure's (hair 0.6). Only for a hull. */
  inkWeight?: number;
  /** Glow of the surface (linear). */
  emissive?: Rgb;
}

export interface ToonifyOptions {
  /** Say how a mesh is drawn. Return nothing for the default (metal by its metalness, else `default`). */
  pick?: (mesh: Mesh, source: Material) => ToonPick | undefined;
  /** The hull's material, shared with other work of the actor. Made here when left out. */
  ink?: InkMaterial;
  /** The planes that cut the skin and the ink (a frame). */
  clippingPlanes?: Plane[] | null;
  /** Anisotropy to set on every picture. */
  anisotropy?: number;
}

/** A converted scene: its materials, its hulls, and the way to size and drop them. */
export class ToonSet {
  readonly materials: Material[] = [];
  readonly toons: ToonMaterial[] = [];
  readonly inks: Ink[] = [];
  /** The textures the converted materials use (the caller disposes them with the geometry). */
  readonly textures = new Set<Texture>();
  /** The hull materials of a different weight (`ToonPick.inkWeight`), by weight. */
  private readonly weighted = new Map<number, InkMaterial>();
  constructor(
    readonly ink: InkMaterial,
    private readonly planes?: Plane[] | null,
  ) {}

  /** The hull material for a mesh that wants a finer or a bolder line than the rest. */
  inkFor(weight: number): InkMaterial {
    if (weight === 1) return this.ink;
    let made = this.weighted.get(weight);
    if (!made) {
      made = new InkMaterial(INK_COLOR, this.planes, weight);
      this.weighted.set(weight, made);
    }
    return made;
  }

  /** Size the ink for a figure this tall on the screen (CSS pixels). Call it every frame it is shown. */
  setHeight(heightPx: number): void {
    this.ink.setSize(heightPx);
    for (const ink of this.weighted.values()) ink.setSize(heightPx);
  }

  dispose(): void {
    for (const hull of this.inks) hull.remove();
    for (const material of this.materials) material.dispose();
    this.ink.dispose();
    for (const ink of this.weighted.values()) ink.dispose();
    this.weighted.clear();
    this.materials.length = 0;
    this.toons.length = 0;
    this.inks.length = 0;
  }
}

function isStandard(material: Material): material is MeshStandardMaterial {
  return (material as MeshStandardMaterial).isMeshStandardMaterial === true;
}

/**
 * Convert every mesh of a loaded scene. The pictures stay; normal, roughness, metalness and ao maps
 * are dropped (cel bands read the geometry's normals). A metal material (metalness 0.6 and up) takes
 * the metal look. Skinned meshes get a skinned ink hull.
 */
export function toonify(root: Object3D, options: ToonifyOptions = {}): ToonSet {
  const set = new ToonSet(
    options.ink ?? new InkMaterial(INK_COLOR, options.clippingPlanes),
    options.clippingPlanes,
  );
  const made = new Map<string, ToonMaterial | MeshBasicMaterial>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const source = mesh.material;
    if (Array.isArray(source) || !isStandard(source)) return;
    const pick = options.pick?.(mesh, source) ?? {};
    const look: ToonLookName = pick.look ?? (source.metalness >= 0.6 ? "metal" : "default");
    const key = `${source.uuid}|${pick.unlit ? "u" : look}|${JSON.stringify(pick.tune ?? null)}`;
    let material = made.get(key);
    if (!material) {
      if (source.map && options.anisotropy) source.map.anisotropy = options.anisotropy;
      if (pick.unlit) {
        material = unlitFrom(source, { clippingPlanes: options.clippingPlanes });
      } else {
        const glow = source.emissive;
        const lit = Math.max(glow.r, glow.g, glow.b) * source.emissiveIntensity;
        const toon = new ToonMaterial({
          map: source.map,
          color: source.color,
          look,
          tune: pick.tune,
          emissive:
            pick.emissive ??
            (lit > 0.02
              ? [
                  glow.r * source.emissiveIntensity,
                  glow.g * source.emissiveIntensity,
                  glow.b * source.emissiveIntensity,
                ]
              : undefined),
          emissiveMap: lit > 0.02 ? source.emissiveMap : null,
          alphaTest: source.alphaTest,
          transparent: source.transparent,
          opacity: source.opacity,
          depthWrite: source.depthWrite,
          side: source.side === BackSide ? DoubleSide : source.side,
          vertexColors: source.vertexColors,
          name: source.name,
          clippingPlanes: options.clippingPlanes,
        });
        set.toons.push(toon);
        material = toon;
      }
      made.set(key, material);
      set.materials.push(material);
    }
    if (source.map) set.textures.add(source.map);
    if (source.emissiveMap) set.textures.add(source.emissiveMap);
    mesh.material = material;
    // Alpha cards and unlit parts have no hull by default: a line along a card's edge is a box.
    const alpha = source.alphaTest > 0 || source.transparent;
    const wants = pick.ink ?? (!pick.unlit && !alpha);
    if (wants === "card") set.inks.push(addCardInk(mesh, material, set.ink));
    else if (wants) set.inks.push(addInk(mesh, set.inkFor(pick.inkWeight ?? 1)));
  });
  return set;
}
