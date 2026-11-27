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
import type { Pass } from "../../kernel/types";

import { MirrorCopy, type Mirror } from "./mirror";
import { setToonView, toonLight, type ToonLight } from "./toon";

export type { Mirror, MirrorShow } from "./mirror";

/** Where the lit characters are drawn, above the flat passes (ortho 10, perspective 20). */
const CAST_ORDER = 30;
/** The one draw of a mirrored picture comes before every pass, on the cleared canvas. */
const MIRROR_ORDER = 1;

export interface Cast {
  /** The pass every lit actor puts its root in. Lights are already in its scene. */
  readonly pass: ScenePass;
  /** One environment for the whole cast. Give each material its own `envMap` and `envMapIntensity`. */
  readonly env: Texture;
  /** The key and the fill, to be moved by the section that wants another mood. */
  readonly key: DirectionalLight;
  readonly fill: DirectionalLight;
  readonly ambient: AmbientLight;
  /**
   * The light of the toon characters (`toon.ts`): one direction in the camera's space shared by
   * every toon material, plus an `amount` (0 flat, 1 full). A toon character needs nothing else of
   * the cast rig: no environment map, no scene lights.
   */
  readonly toon: ToonLight;
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
   *
   * `framed` (round seven) names the roots that belong to the camera's picture (Selena with her sky,
   * Silverbolt): they are drawn through `camera` and cut by `clipOnce`, and everything else in the
   * pass (the drone, the doll) is drawn after them through the pixel camera, uncut and in front, so
   * a part placed in the screen's pixels keeps its place whatever lens the picture has.
   */
  setCamera(camera: PerspectiveCamera | null, framed?: readonly Object3D[]): void;
  /** Like `clip`, for the next draw only (the same one-frame rule as `setCamera`). */
  clipOnce(rect: { x: number; y: number; w: number; h: number } | null): void;
  /**
   * For the next draw only, with a camera and its framed roots (`setCamera`): draw the framed roots
   * once into a picture of `w` by `h` CSS pixels (the camera must be aimed at that picture alone) and
   * show that one picture in every window of `shows` (`mirror.ts`). The rest of the pass is drawn
   * after them through the pixel camera, as always.
   */
  mirrorOnce(mirror: Mirror | null): void;
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
  let pendingFramed: readonly Object3D[] | null = null;
  let pendingClip: Rect | null = null;
  let camera: PerspectiveCamera | null = null;
  let framed: readonly Object3D[] | null = null;
  let onceClip: Rect | null = null;
  const shown: boolean[] = [];
  // The mirrored picture: asked while the actors update, taken by the mirror pass (which runs its
  // `active` before the cast pass does, so the camera of this frame is still pending then).
  let pendingMirror: Mirror | null = null;
  let mirror: Mirror | null = null;
  let mirrorCamera: PerspectiveCamera | null = null;
  let mirrorFramed: readonly Object3D[] | null = null;
  const copy = new MirrorCopy();
  /** Show only the framed roots (and the lights), or put every root back as it was. */
  const onlyFramed = (roots: readonly Object3D[]): void => {
    const kids = pass.scene.children;
    for (let i = 0; i < kids.length; i += 1) {
      const kid = kids[i]!;
      shown[i] = kid.visible;
      if (!isLight(kid) && !roots.includes(kid)) kid.visible = false;
    }
  };
  const restore = (): void => {
    const kids = pass.scene.children;
    for (let i = 0; i < kids.length; i += 1) kids[i]!.visible = shown[i]!;
  };
  const mirrorPass: Pass = {
    name: "cast-mirror",
    order: MIRROR_ORDER,
    active() {
      const ok =
        pendingMirror !== null && pendingCamera !== null && (pendingFramed?.length ?? 0) > 0;
      mirror = ok ? pendingMirror : null;
      mirrorCamera = ok ? pendingCamera : null;
      mirrorFramed = ok ? pendingFramed : null;
      pendingMirror = null;
      return mirror !== null;
    },
    render(renderer) {
      const m = mirror;
      const cam = mirrorCamera;
      const roots = mirrorFramed;
      if (!m || !cam || !roots) return;
      const dpr = stage.dpr;
      const canvas = renderer.domElement;
      const dw = Math.max(1, Math.min(canvas.width, Math.round(m.w * dpr)));
      const dh = Math.max(1, Math.min(canvas.height, Math.round(m.h * dpr)));
      const w = dw / dpr;
      const h = dh / dpr;
      // The picture is drawn in the bottom left corner, at its own size: the ink's width is in its
      // pixels, so the toon view is the picture's for this draw.
      renderer.setViewport(0, 0, w, h);
      renderer.setScissor(0, 0, w, h);
      renderer.setScissorTest(true);
      setToonView(w, h);
      onlyFramed(roots);
      renderer.render(pass.scene, cam);
      restore();
      copy.take(renderer, dw, dh);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, stage.width, stage.height);
      setToonView(stage.width, stage.height);
    },
    dispose() {
      copy.dispose();
    },
  };
  stage.addPass(mirrorPass);
  pass.active = () => {
    camera = pendingCamera;
    framed = pendingFramed;
    onceClip = pendingClip;
    pendingCamera = null;
    pendingFramed = null;
    pendingClip = null;
    return pass.scene.children.some((child) => child.visible && !isLight(child));
  };
  pass.render = (renderer) => {
    // The ink of the toon characters is a width in CSS pixels: it needs the canvas size.
    setToonView(stage.width, stage.height);
    const view = camera ?? pass.camera;
    const rect = onceClip ?? clipRect;
    if (mirror && framed && framed.length > 0) {
      // The framed roots were drawn once by the mirror pass: lay that picture in its windows, then
      // draw the rest through the pixel camera over them.
      copy.show(renderer, mirror, stage.height, stage.dpr);
      const kids = pass.scene.children;
      for (let i = 0; i < kids.length; i += 1) {
        const kid = kids[i]!;
        shown[i] = kid.visible;
        if (!isLight(kid) && framed.includes(kid)) kid.visible = false;
      }
      renderer.clearDepth();
      renderer.render(pass.scene, pass.camera);
      restore();
      return;
    }
    if (camera && framed && framed.length > 0) {
      // Two draws: the framed roots through the lens of the picture (cut to the window), then the
      // rest through the pixel camera over them (the depth of the first draw means nothing to it).
      const kids = pass.scene.children;
      for (let i = 0; i < kids.length; i += 1) {
        const kid = kids[i]!;
        shown[i] = kid.visible;
        if (!isLight(kid) && !framed.includes(kid)) kid.visible = false;
      }
      if (rect) {
        renderer.setScissorTest(true);
        renderer.setScissor(rect.x, stage.height - rect.y - rect.h, rect.w, rect.h);
      }
      renderer.render(pass.scene, camera);
      renderer.setScissorTest(false);
      for (let i = 0; i < kids.length; i += 1) {
        const kid = kids[i]!;
        kid.visible = shown[i]! && (isLight(kid) || !framed.includes(kid));
      }
      renderer.clearDepth();
      renderer.render(pass.scene, pass.camera);
      for (let i = 0; i < kids.length; i += 1) kids[i]!.visible = shown[i]!;
      return;
    }
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
    toon: toonLight,
    add(root) {
      pass.scene.add(root);
    },
    clip(rect) {
      clipRect = rect;
    },
    setCamera(next, group) {
      pendingCamera = next;
      pendingFramed = group ?? null;
    },
    view() {
      return camera ?? pass.camera;
    },
    clipOnce(rect) {
      pendingClip = rect;
    },
    mirrorOnce(next) {
      pendingMirror = next;
    },
  };
  made.set(stage, cast);
  return cast;
}
