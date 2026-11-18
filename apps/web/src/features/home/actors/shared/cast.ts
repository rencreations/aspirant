import {
  AmbientLight,
  DirectionalLight,
  type Camera,
  type Light,
  type Object3D,
  type PerspectiveCamera,
  type Texture,
  PMREMGenerator,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { Stage, ScenePass } from "../../kernel/stage";

/** Where the lit characters are drawn, above the flat passes (ortho 10, perspective 20). */
const CAST_ORDER = 30;

export interface Cast {
  /** The pass every lit actor puts its root in. Lights are already in its scene. */
  readonly pass: ScenePass;
  /** One environment for the whole cast. Give each material its own `envMap` and `envMapIntensity`. */
  readonly env: Texture;
  /** The key and the fill, to be moved by the section that wants another mood. */
  readonly key: DirectionalLight;
  readonly fill: DirectionalLight;
  readonly ambient: AmbientLight;
  add(root: Object3D): void;
  /**
   * Draw the cast only inside a rectangle (CSS pixels, origin top left), or everywhere with null.
   * The list's 3D frame uses it: the actor stands in a frame and nothing of it shows outside.
   */
  clip(rect: { x: number; y: number; w: number; h: number } | null): void;
  /**
   * Draw the next frame through this camera instead of the pixel camera (a baked camera, a close
   * up). It lasts for one draw: call it every frame while it is wanted. A frame without a call, or
   * with null, uses the pixel camera again, so a hidden actor never leaves another one framed wrong.
   */
  setCamera(camera: PerspectiveCamera | null): void;
  /** Like `clip`, for the next draw only (the same one-frame rule as `setCamera`). */
  clipOnce(rect: { x: number; y: number; w: number; h: number } | null): void;
  /** The camera this frame's draw uses (a baked camera, or the pixel camera). The comic marks project through it. */
  view(): Camera;
}

const made = new WeakMap<Stage, Cast>();

/**
 * The shared lit scene of the home (Silverbolt, the doll, Selena, the hand, the gramophone, Tetra
 * when she is lit). All of them are drawn in one pass so that the doll can sit in Silverbolt's
 * mouth and in Selena's palm and the depth between them is right. One light rig, one environment.
 * The renderer has no tone mapping, so a material's colour is what it says.
 *
 * Lights are children of the scene, and a pass is drawn while any child is visible, so the pass
 * is told here that a light does not count.
 */
export function getCast(stage: Stage): Cast {
  const known = made.get(stage);
  if (known) return known;

  const pass = stage.scenePass("cast", "perspective", CAST_ORDER);
  const isLight = (child: Object3D): boolean => (child as Light).isLight === true;
  type Rect = { x: number; y: number; w: number; h: number };
  let clipRect: Rect | null = null;
  // A camera or a rectangle set for one draw: set while the actors update, taken by `active()`.
  let pendingCamera: PerspectiveCamera | null = null;
  let pendingClip: Rect | null = null;
  let camera: PerspectiveCamera | null = null;
  let onceClip: Rect | null = null;
  pass.active = () => {
    camera = pendingCamera;
    onceClip = pendingClip;
    pendingCamera = null;
    pendingClip = null;
    return pass.scene.children.some((child) => child.visible && !isLight(child));
  };
  pass.render = (renderer) => {
    const view = camera ?? pass.camera;
    const rect = onceClip ?? clipRect;
    if (!rect) {
      renderer.render(pass.scene, view);
      return;
    }
    // three's scissor is in CSS pixels, from the bottom left.
    renderer.setScissorTest(true);
    renderer.setScissor(rect.x, stage.height - rect.y - rect.h, rect.w, rect.h);
    renderer.render(pass.scene, view);
    renderer.setScissorTest(false);
  };

  const ambient = new AmbientLight(0xffffff, 0.35);
  const key = new DirectionalLight(0xfff4e6, 2.2);
  key.position.set(-300, 500, 800);
  const fill = new DirectionalLight(0xdbe8ff, 0.7);
  fill.position.set(400, -100, 500);
  pass.scene.add(ambient, key, fill);

  const pmrem = new PMREMGenerator(stage.renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const cast: Cast = {
    pass,
    env,
    key,
    fill,
    ambient,
    add(root) {
      pass.scene.add(root);
    },
    clip(rect) {
      clipRect = rect;
    },
    setCamera(next) {
      pendingCamera = next;
    },
    view() {
      return camera ?? pass.camera;
    },
    clipOnce(rect) {
      pendingClip = rect;
    },
  };
  made.set(stage, cast);
  return cast;
}
