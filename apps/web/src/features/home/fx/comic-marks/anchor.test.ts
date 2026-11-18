import { Object3D, type PerspectiveCamera, Scene } from "three";
import { describe, expect, it } from "vitest";

import { makePixelOrthoCamera, makePixelPerspectiveCamera, type Stage } from "../../kernel/stage";
import { StageProjector } from "./anchor";
import { AnchorRef } from "./mark";

const W = 800;
const H = 600;

/** The parts of the stage the projector reads: the size and the shared passes by name. */
function fakeStage(passes: Record<string, { scene: Scene; camera: PerspectiveCamera }>): Stage {
  return {
    width: W,
    height: H,
    passNames: () => Object.keys(passes),
    scenePass: (name: string) => passes[name],
  } as unknown as Stage;
}

function project(projector: StageProjector, object: Object3D, camera?: PerspectiveCamera) {
  const ref = new AnchorRef();
  ref.set(object, camera ?? null, 0, 0);
  projector.project(ref);
  return ref;
}

describe("StageProjector", () => {
  it("a thing at z 0 in the perspective pass lands on its own pixels", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const o = new Object3D();
    o.position.set(120, -80, 0);
    scene.add(o);
    const ref = project(projector, o);
    expect(ref.visible).toBe(true);
    expect(ref.x).toBeCloseTo(120, 2);
    expect(ref.y).toBeCloseTo(-80, 2);
  });

  it("a thing nearer the camera lands further from the middle (perspective)", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const o = new Object3D();
    o.position.set(100, 0, 500);
    scene.add(o);
    expect(project(projector, o).x).toBeCloseTo(200, 2);
  });

  it("follows the camera the caller names, not the pass's", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const o = new Object3D();
    o.position.set(100, 0, 0);
    scene.add(o);
    const moved = makePixelPerspectiveCamera(W, H);
    moved.position.x = 100;
    moved.updateMatrixWorld();
    expect(project(projector, o, moved).x).toBeCloseTo(0, 2);
  });

  it("a thing in the orthographic pass lands on its own pixels", () => {
    const scene = new Scene();
    const camera = makePixelOrthoCamera(W, H) as unknown as PerspectiveCamera;
    const projector = new StageProjector(fakeStage({ ortho: { scene, camera } }));
    const o = new Object3D();
    o.position.set(-300, 150, 0);
    scene.add(o);
    const ref = project(projector, o);
    expect(ref.x).toBeCloseTo(-300, 2);
    expect(ref.y).toBeCloseTo(150, 2);
  });

  it("is not visible behind the camera", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const o = new Object3D();
    o.position.set(0, 0, 1500);
    scene.add(o);
    expect(project(projector, o).visible).toBe(false);
  });

  it("is not visible when the object or a parent is hidden", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const root = new Object3D();
    const child = new Object3D();
    root.add(child);
    scene.add(root);
    expect(project(projector, child).visible).toBe(true);
    root.visible = false;
    expect(project(projector, child).visible).toBe(false);
    root.visible = true;
    child.visible = false;
    expect(project(projector, child).visible).toBe(false);
  });

  it("follows a parent that moves (a socket on a bone)", () => {
    const scene = new Scene();
    const camera = makePixelPerspectiveCamera(W, H);
    const projector = new StageProjector(fakeStage({ perspective: { scene, camera } }));
    const root = new Object3D();
    const socket = new Object3D();
    socket.position.set(10, 0, 0);
    root.add(socket);
    scene.add(root);
    root.position.set(50, 0, 0);
    expect(project(projector, socket).x).toBeCloseTo(60, 2);
    root.position.set(200, 0, 0);
    expect(project(projector, socket).x).toBeCloseTo(210, 2);
  });

  it("an object in no known scene is taken to stand in the pixel frame", () => {
    const projector = new StageProjector(fakeStage({}));
    const o = new Object3D();
    o.position.set(33, 44, 0);
    const ref = project(projector, o);
    expect(ref.visible).toBe(true);
    expect(ref.x).toBe(33);
    expect(ref.y).toBe(44);
  });

  it("adds the offset in pixels", () => {
    const projector = new StageProjector(fakeStage({}));
    const o = new Object3D();
    const ref = new AnchorRef();
    ref.set(o, null, 7, -9);
    projector.project(ref);
    expect(ref.x).toBe(7);
    expect(ref.y).toBe(-9);
  });
});
