/**
 * The look of Silverbolt in the shared cast pass. The loader gives every part a
 * `MeshStandardMaterial` painted with the light already in the pictures; here they get the cast's
 * environment (one PMREM for the whole home) and a crisper, metallic read, the two emissive parts
 * (the eyes and the cheek crystals) are kept for mood glows, and the flame ribbon is sorted last
 * with no depth write. A thin ink outline (a shell of the head, pushed out along the normal by a
 * fixed number of screen pixels) gives the comic edge the rest of the site has.
 */
import {
  BackSide,
  Color,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
  SkinnedMesh,
  type Texture,
  type Vector2,
} from "three";

export interface SbMaterials {
  body: MeshStandardMaterial;
  gem: MeshStandardMaterial;
  socket: MeshStandardMaterial;
  crystal: MeshStandardMaterial;
  ribbon: MeshStandardMaterial;
  outline: MeshBasicMaterial;
}

/** The outline width in CSS pixels. */
const OUTLINE_PX = 1.6;
/** The outline's colour: a deep violet ink, not black, so it sits in the palette. */
const INK = 0x1c1233;

const isStandard = (m: Material): m is MeshStandardMaterial =>
  (m as MeshStandardMaterial).isMeshStandardMaterial === true;

/**
 * Find the five materials by name, set them up and add the outline shells. Returns what the actor
 * drives and the meshes it added (to remove them on dispose).
 */
export function dress(
  scene: Object3D,
  env: Texture,
  outlineSize: Vector2,
): { materials: SbMaterials; extra: SkinnedMesh[]; skinned: SkinnedMesh[] } {
  const found: Partial<Record<keyof Omit<SbMaterials, "outline">, MeshStandardMaterial>> = {};
  const skinned: SkinnedMesh[] = [];
  scene.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    skinned.push(mesh);
    // The pose of the bones, not the quantised box, decides what is in view.
    mesh.frustumCulled = false;
    const list: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!isStandard(m)) continue;
      if (m.name === "silverbolt_body") found.body = m;
      else if (m.name === "silverbolt_gem") found.gem = m;
      else if (m.name === "silverbolt_socket") found.socket = m;
      else if (m.name === "silverbolt_crystal") found.crystal = m;
      else if (m.name === "silverbolt_ribbon") found.ribbon = m;
    }
  });
  const { body, gem, socket, crystal, ribbon } = found;
  if (!body || !gem || !socket || !crystal || !ribbon) {
    throw new Error("Silverbolt's materials are not the ones the build wrote");
  }

  // The armour: a little metal and a sheen from the cast's environment, crisp normals.
  body.envMap = env;
  body.envMapIntensity = 0.85;
  body.metalness = 0.32;
  body.roughness = 0.46;
  // The eyes and crystals glow by themselves; the environment adds a glassy highlight.
  for (const m of [gem, crystal]) {
    m.envMap = env;
    m.envMapIntensity = 0.5;
    m.metalness = 0.1;
    m.roughness = 0.25;
  }
  socket.envMap = env;
  socket.envMapIntensity = 0.7;
  socket.metalness = 0.5;
  socket.roughness = 0.4;
  // The flame ribbon is a soft sheet: no depth write, drawn after the opaque parts.
  ribbon.transparent = true;
  ribbon.depthWrite = false;
  ribbon.envMap = env;
  ribbon.envMapIntensity = 0.25;
  ribbon.metalness = 0;
  ribbon.roughness = 0.8;
  for (const m of [body, gem, socket, crystal, ribbon]) m.needsUpdate = true;

  const outline = new MeshBasicMaterial({
    color: new Color(INK),
    side: BackSide,
    // The shell sits behind the armour: push it back a little so a thin blade seen edge on does not speckle.
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  outline.name = "silverbolt_outline";
  outline.toneMapped = false;
  outline.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = { value: outlineSize };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec2 uOutline;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec3 vnOut = normalize(normalMatrix * objectNormal);
        vec2 dirOut = (projectionMatrix * vec4(vnOut, 0.0)).xy;
        float lenOut = length(dirOut);
        if (lenOut > 1e-5) gl_Position.xy += dirOut / lenOut * uOutline * gl_Position.w;`,
      );
  };

  // One shell for the head and horns. The ribbon, the eyes and the crystals are not outlined.
  const extra: SkinnedMesh[] = [];
  for (const src of skinned) {
    const list = Array.isArray(src.material) ? src.material : [src.material];
    if (!list.includes(body) || !src.parent) continue;
    const shell = new SkinnedMesh(src.geometry, outline);
    shell.name = "silverbolt_outline";
    shell.bind(src.skeleton, src.bindMatrix);
    shell.frustumCulled = false;
    shell.renderOrder = -1;
    src.parent.add(shell);
    extra.push(shell);
  }
  // The ribbon is sorted after everything opaque.
  scene.traverse((o) => {
    if (o instanceof Mesh && o.material === ribbon) o.renderOrder = 1;
  });
  return { materials: { body, gem, socket, crystal, ribbon, outline }, extra, skinned };
}

/** Write the outline's offset in normalised device units for a canvas of `w` by `h` CSS pixels. */
export function setOutlineNdc(
  out: Vector2,
  w: number,
  h: number,
  px: number = OUTLINE_PX,
): Vector2 {
  return out.set((2 * px) / Math.max(1, w), (2 * px) / Math.max(1, h));
}

/** The texture slots a model's materials hold. The cast's environment is never one of them. */
const TEXTURE_SLOTS = [
  "map",
  "normalMap",
  "emissiveMap",
  "roughnessMap",
  "metalnessMap",
  "alphaMap",
  "aoMap",
] as const;

/** Free the maps of a standard material and the material itself. */
export function disposeStandard(m: MeshStandardMaterial): void {
  for (const slot of TEXTURE_SLOTS) m[slot]?.dispose();
  m.dispose();
}
