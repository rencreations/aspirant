import { Vector3, type Camera, type Object3D, type Scene } from "three";

import { getCast } from "../../actors/shared/cast";
import type { Stage } from "../../kernel/stage";
import { ndcToPixels } from "./math";
import type { AnchorRef, Projector } from "./mark";

/** The shared scene passes a 3D anchor can live in. */
const PASSES = [
  { name: "cast", kind: "perspective", order: 30 },
  { name: "perspective", kind: "perspective", order: 20 },
  { name: "ortho", kind: "ortho", order: 10 },
] as const;

/** A name that is not a pass yet is looked for again after this long. */
const RECHECK_MS = 250;

interface Entry {
  scene: Scene;
  camera: () => Camera;
}

/**
 * Turns a 3D anchor into the stage's pixel frame (origin in the middle, x right, y up).
 *
 * Which camera: the one the pass that draws the anchor's scene uses THIS frame. The anchor is walked
 * up to its root `Scene` and that is matched against the shared passes (`cast`, `perspective`,
 * `ortho`), so a drone in the perspective pass and Silverbolt in the cast pass each project through
 * their own camera. For the cast that is `getCast(stage).view()`: a section can draw the cast through
 * a baked camera for one frame (the fall follows the doll), and a mark must be placed by the camera
 * the picture was drawn with. A pass is only asked for when it already exists (`passNames`), never
 * made here. A caller can force a camera with the `camera` option. An anchor in no known scene is
 * taken to stand in the pixel frame already: its x and y are the pixels (right for anything at z = 0).
 *
 * The anchor's world matrix is refreshed first: the actors have moved this frame but the stage has
 * not drawn yet, so the matrices are one frame old otherwise. A point behind a perspective camera
 * is reported not visible, and so is an anchor with a hidden ancestor (the kernel hides an actor's
 * root when no section shows it, and its marks go with it).
 */
export class StageProjector implements Projector {
  private readonly world = new Vector3();
  private readonly view = new Vector3();
  private readonly pixels = { x: 0, y: 0 };
  private readonly found = new Map<string, Entry>();
  private readonly checked = new Map<string, number>();

  constructor(private readonly stage: Stage) {}

  project(ref: AnchorRef): void {
    const object = ref.object;
    if (!object) return;
    if (hidden(object)) {
      ref.visible = false;
      return;
    }
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(this.world);
    const camera = ref.camera ?? this.cameraFor(object);
    if (!camera) {
      ref.x = this.world.x + ref.offX;
      ref.y = this.world.y + ref.offY;
      ref.visible = true;
      return;
    }
    camera.updateMatrixWorld();
    this.view.copy(this.world).applyMatrix4(camera.matrixWorldInverse);
    const perspective = (camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera === true;
    if (perspective && this.view.z >= -1e-4) {
      ref.visible = false;
      return;
    }
    this.view.applyMatrix4(camera.projectionMatrix);
    ndcToPixels(this.view.x, this.view.y, this.stage.width, this.stage.height, this.pixels);
    ref.x = this.pixels.x + ref.offX;
    ref.y = this.pixels.y + ref.offY;
    ref.visible = true;
  }

  private cameraFor(object: Object3D): Camera | null {
    let root: Object3D = object;
    while (root.parent) root = root.parent;
    let fallback: Camera | null = null;
    for (const p of PASSES) {
      const entry = this.pass(p.name, p.kind, p.order);
      if (!entry) continue;
      if (entry.scene === root) return entry.camera();
      if (p.kind === "perspective") fallback ??= entry.camera();
    }
    // An object that is in no pass yet (a socket not attached): the nearest guess.
    return fallback;
  }

  private pass(name: string, kind: "ortho" | "perspective", order: number): Entry | null {
    const known = this.found.get(name);
    if (known) return known;
    const last = this.checked.get(name) ?? -Infinity;
    const now = performance.now();
    if (now - last < RECHECK_MS) return null;
    this.checked.set(name, now);
    if (!this.stage.passNames().includes(name)) return null;
    const pass = this.stage.scenePass(name, kind, order);
    const entry: Entry =
      name === "cast"
        ? { scene: pass.scene, camera: () => getCast(this.stage).view() }
        : { scene: pass.scene, camera: () => pass.camera };
    this.found.set(name, entry);
    return entry;
  }
}

/** True when the object or any of its parents is hidden. */
function hidden(object: Object3D): boolean {
  for (let o: Object3D | null = object; o; o = o.parent) if (!o.visible) return true;
  return false;
}
