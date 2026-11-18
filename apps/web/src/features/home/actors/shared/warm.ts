import type { Material, Mesh, Object3D, Texture } from "three";

import type { Stage } from "../../kernel/stage";

import type { Cast } from "./cast";
import { gpuDrained, nextFrame, whenQuiet } from "./quiet";

/** Every picture a material (or a shader's uniforms) holds, once each. */
export function texturesOf(root: Object3D): Texture[] {
  const found = new Set<Texture>();
  root.traverse((node) => {
    const material = (node as Mesh).material as Material | Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(m)) {
        if ((value as Texture | null)?.isTexture) found.add(value as Texture);
      }
      const uniforms = (m as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      if (uniforms) {
        for (const u of Object.values(uniforms)) {
          if ((u.value as Texture | null)?.isTexture) found.add(u.value as Texture);
        }
      }
    }
  });
  return [...found];
}

interface Saved {
  node: Object3D;
  visible: boolean;
  culled: boolean;
}

/** Show every part of an actor, drawn whatever the camera says, for a moment. Returns the way back. */
function showAll(root: Object3D): () => void {
  const saved: Saved[] = [];
  root.traverse((node) => {
    saved.push({ node, visible: node.visible, culled: node.frustumCulled });
    node.visible = true;
    node.frustumCulled = false;
  });
  return () => {
    for (const s of saved) {
      s.node.visible = s.visible;
      s.node.frustumCulled = s.culled;
    }
  };
}

/** Show only one mesh (and the groups above it), never culled. Returns the way back. */
function showOnly(root: Object3D, mesh: Object3D): () => void {
  const saved: Saved[] = [];
  root.traverse((node) => {
    saved.push({ node, visible: node.visible, culled: node.frustumCulled });
    node.visible = false;
  });
  for (let node: Object3D | null = mesh; node; node = node === root ? null : node.parent) {
    node.visible = true;
    node.frustumCulled = false;
  }
  return () => {
    for (const s of saved) {
      s.node.visible = s.visible;
      s.node.frustumCulled = s.culled;
    }
  };
}

/** Which program a mesh asks for: its material and the parts of the mesh that change the program. */
export function programKey(mesh: Mesh): string {
  const material = mesh.material;
  const ids = (Array.isArray(material) ? material : [material]).map((m) => m.uuid).join("+");
  const skinned = (mesh as { isSkinnedMesh?: boolean }).isSkinnedMesh ? "s" : "";
  const instanced = (mesh as { isInstancedMesh?: boolean }).isInstancedMesh ? "i" : "";
  const morphs = mesh.morphTargetInfluences?.length ?? 0;
  return `${ids}:${skinned}${instanced}${morphs}`;
}

/** One mesh for each program an actor needs: the first draw of it is the one that costs. */
export function distinctMeshes(root: Object3D): Mesh[] {
  const seen = new Set<string>();
  const out: Mesh[] = [];
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const key = programKey(mesh);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(mesh);
  });
  return out;
}

/** A first draw that took this long was a program's first use (a cheap one is not worth a pause). */
const HEAVY_DRAW_MS = 6;

export interface WarmOptions {
  /** Selena's materials are clipped by planes: the programs for them are made with clipping on. */
  localClipping?: boolean;
}

/**
 * Make an actor of the shared cast ready to be shown, a step to a frame, so the first frame that
 * shows it does not stall (measured on the dev server: 0.3 to 0.8 s at each first appearance, all of
 * it the driver linking programs and the first draw waiting for the GPU's queue).
 *
 * 1. Compile every program of the cast scene with its lights, asynchronously (the programs of an
 *    object alone differ from the ones a draw in the scene needs, which is why a warm of the object
 *    alone did not help).
 * 2. Send each picture to the GPU on a frame of its own, and let the GPU finish before the next.
 * 3. Draw the cast into a single pixel once for each program the actor needs, never culled, a mesh
 *    to a frame, so the buffers, the bone textures and each program's first use are done now, with
 *    the GPU idle.
 *
 * The heavy steps wait for a quiet moment first (`whenQuiet`), so they fall between two scroll events
 * when the visitor pauses. Safe to call again: a second call finds everything done.
 */
export async function warmCast(
  stage: Stage,
  cast: Cast,
  root: Object3D,
  options: WarmOptions = {},
): Promise<void> {
  if (stage.lost || stage.failed) return;
  const { renderer } = stage;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const wasClipping = renderer.localClippingEnabled;
  if (options.localClipping) renderer.localClippingEnabled = true;

  try {
    await whenQuiet(1200);
    {
      // `compile` reads what is visible at the call, so the parts are shown only for the call.
      const back = showAll(root);
      let pending: Promise<unknown>;
      try {
        pending = renderer.compileAsync(cast.pass.scene, cast.pass.camera);
      } finally {
        back();
      }
      try {
        await pending;
      } catch {
        // A lost context compiles on the first draw instead.
      }
    }
    await gpuDrained(gl);

    for (const texture of texturesOf(root)) {
      if (stage.lost) return;
      await nextFrame();
      try {
        renderer.initTexture(texture);
      } catch {
        // As above.
      }
      await gpuDrained(gl);
    }

    // The first draw of each program, one to a frame: its first use asks the driver for the link
    // log, which is 40 to 140 ms for a lit program even when the GPU is idle. Drawn together they
    // would be one frame of half a second; a frame each, a pause of the scroll takes them in turn.
    let heavy = true;
    for (const mesh of distinctMeshes(root)) {
      if (stage.lost) return;
      if (heavy) await whenQuiet(420);
      await nextFrame();
      const back = showOnly(root, mesh);
      const scissor = renderer.getScissorTest();
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 1, 1);
      const t0 = performance.now();
      try {
        renderer.render(cast.pass.scene, cast.pass.camera);
      } catch {
        // As above.
      } finally {
        renderer.setScissorTest(scissor);
        back();
      }
      heavy = performance.now() - t0 > HEAVY_DRAW_MS;
      await gpuDrained(gl);
    }
  } finally {
    renderer.localClippingEnabled = wasClipping;
  }
}
