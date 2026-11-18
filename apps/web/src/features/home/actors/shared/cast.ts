import {
  AmbientLight,
  DirectionalLight,
  type Light,
  type Object3D,
  type Texture,
  PMREMGenerator,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { Stage, ScenePass } from "../../kernel/stage";

/** Where the lit characters are drawn, above the flat passes (ortho 10, perspective 20). */
export const CAST_ORDER = 30;

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
  pass.active = () => pass.scene.children.some((child) => child.visible && !isLight(child));

  let clipRect: { x: number; y: number; w: number; h: number } | null = null;
  const drawAll = pass.render.bind(pass);
  pass.render = (renderer) => {
    if (!clipRect) {
      drawAll(renderer);
      return;
    }
    // three's scissor is in CSS pixels, from the bottom left.
    renderer.setScissorTest(true);
    renderer.setScissor(clipRect.x, stage.height - clipRect.y - clipRect.h, clipRect.w, clipRect.h);
    drawAll(renderer);
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
  };
  made.set(stage, cast);
  return cast;
}
