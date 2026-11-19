/**
 * The white sheet the out animation pulls down (round seven). An actor of the cast pass, so it shares
 * the depth buffer with Selena: the sheet is a view aligned plane that cuts through her hand, so the
 * fingers in front of it show over it and the fingers behind it are hidden by it, as in real 3D.
 *
 * Each frame the section calls `drive` and shows it. The sheet reads the fingertips (sockets pinned on
 * her bones), puts its bottom edge on the grip, the plane at the depth between the thumb and the
 * other fingers, and unprojects the grid of `cloth.ts` onto that plane through the camera the cast is
 * drawn with. The paper is the daybreak ground itself (colour and dot grid), so a screen full of it is
 * the next section's ground.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  ShaderMaterial,
  Vector3,
  type PerspectiveCamera,
} from "three";

import type { SelenaActor } from "../../actors/selena";
import { fingerBones, type Finger } from "../../actors/selena/pull";
import type { Cast } from "../../actors/shared/cast";
import type { Actor, FrameInfo } from "../../kernel/types";

import { VERTS, fillGrid, gridIndex, newGrid, newShape } from "./cloth";
import { FRAGMENT, VERTEX } from "./shader";

export interface SheetDrive {
  sl: SelenaActor;
  /** The camera the cast is drawn with this frame (its matrices are current). */
  camera: PerspectiveCamera;
  /** Where the edge hangs before the fingers have it, in the picture (y up, 1 is the top of the screen). */
  hang: number;
  /** 0 the edge hangs, 1 the fingers hold it. */
  grip: number;
  /** How much the folds and the trail show, 0 to 1. */
  fold: number;
  /** A phase for the folds. */
  phase: number;
}

/** Where on each fingertip's last bone the sheet's anchors sit, metres along it. */
const TIP = 0.028;
/** The plane's depth between the thumb (0) and the mean of the other fingers (1). */
const BETWEEN = 0.5;
/** How far the edge trails above the grip at most, in the picture. */
const TRAIL = 0.3;
const FINGER_LIST: readonly Finger[] = ["thumb", "index", "middle", "ring", "pinky"];

export class SheetActor implements Actor {
  readonly name = "sheet";
  visible = false;
  readonly object: Mesh;

  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly position = new BufferAttribute(new Float32Array(VERTS * 3), 3);
  private readonly shade = new BufferAttribute(new Float32Array(VERTS), 1);
  private readonly ink = new BufferAttribute(new Float32Array(VERTS), 1);
  private readonly grid = newGrid();
  private readonly shape = newShape();
  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly pins: Array<ReturnType<SelenaActor["pin"]>> = [];
  private readonly view = [900, 1];
  private bound: SelenaActor | null = null;
  private input: SheetDrive | null = null;
  /** What the last frame did, for the probes: where the grip is in the picture and the plane's depth. */
  readonly state = { gripX: 0, gripY: 2, depth: 1 };

  constructor(
    cast: Cast,
    private readonly size: () => { h: number; dpr: number },
  ) {
    const g = this.geometry;
    g.setAttribute("position", this.position);
    g.setAttribute("aShade", this.shade);
    g.setAttribute("aInk", this.ink);
    g.setIndex(new BufferAttribute(gridIndex(), 1));
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: DoubleSide,
      uniforms: {
        uPaper: { value: new Color(244 / 255, 246 / 255, 249 / 255) },
        uShadeCol: { value: new Color(222 / 255, 227 / 255, 239 / 255) },
        uInk: { value: new Color(22 / 255, 24 / 255, 40 / 255) },
        uShade: { value: 1 },
        uView: { value: this.view },
      },
    });
    // The geometry is rewritten every frame in world space: never culled, no transform of its own.
    this.object = new Mesh(g, this.material);
    this.object.frustumCulled = false;
    this.object.matrixAutoUpdate = false;
    this.object.visible = false;
    cast.add(this.object);
  }

  /** Ask for the next frame: the sheet is drawn with this state. Set `visible` too. */
  drive(input: SheetDrive): void {
    this.input = input;
  }

  private bind(sl: SelenaActor): void {
    this.bound = sl;
    this.pins.length = 0;
    for (const finger of FINGER_LIST) {
      const bones = fingerBones(finger);
      this.pins.push(sl.pin(bones[2], TIP));
    }
  }

  update(_frame: FrameInfo): void {
    const input = this.input;
    this.input = null;
    if (!input) return;
    const { sl, camera } = input;
    if (this.bound !== sl) this.bind(sl);
    const v = this.v;
    const w = this.w;
    const inv = camera.matrixWorldInverse;

    // The fingertips: where they are in the picture and how far from the camera.
    let thumbDepth = 0;
    let othersDepth = 0;
    let gx = 0;
    let gy = 0;
    let ix = 0;
    let iy = 0;
    let px = 0;
    let py = 0;
    for (let f = 0; f < 5; f += 1) {
      const pin = this.pins[f]!;
      pin.updateWorldMatrix(true, false);
      v.setFromMatrixPosition(pin.matrixWorld);
      const depth = -w.copy(v).applyMatrix4(inv).z;
      v.project(camera);
      if (f === 0) thumbDepth = depth;
      else othersDepth += depth * 0.25;
      if (f === 1) {
        ix = v.x;
        iy = v.y;
      } else if (f === 2) {
        gx = v.x;
        gy = v.y;
      } else if (f === 4) {
        px = v.x;
        py = v.y;
      }
    }
    // The sheet's plane: between the thumb and the other fingers.
    const depth = thumbDepth + (othersDepth - thumbDepth) * BETWEEN;
    const run = px - ix;
    const slope = Math.abs(run) > 0.02 ? Math.max(-0.3, Math.min(0.3, (py - iy) / run)) : 0;

    // The edge: it hangs at `hang` until the fingers take it.
    const k = input.grip * input.grip * (3 - 2 * input.grip);
    const gripY = input.hang + (gy - input.hang) * k;
    // The trail dies out as the edge leaves the bottom of the screen, so a full screen is flat paper.
    const low = Math.min(1, Math.max(0, (gripY + 1.25) / 1.0));
    const s = this.shape;
    s.gripX = gx;
    s.gripY = gripY;
    s.slope = slope * k;
    s.lag = TRAIL * input.fold * low * k;
    s.fold = input.fold * low;
    s.phase = input.phase;
    fillGrid(s, this.grid);
    this.state.gripX = gx;
    this.state.gripY = gripY;
    this.state.depth = depth;

    // Onto the plane: every vertex at its depth, through the camera's own projection.
    const P = camera.projectionMatrix.elements;
    const pos = this.position.array as Float32Array;
    const g = this.grid;
    const near = Math.max(0.01, depth);
    for (let i = 0; i < VERTS; i += 1) {
      const d = near * (1 + g.pos[i * 3 + 2]!);
      const zClip = P[10]! * -d + P[14]!;
      const wClip = P[11]! * -d + P[15]!;
      v.set(g.pos[i * 3]!, g.pos[i * 3 + 1]!, zClip / wClip)
        .applyMatrix4(camera.projectionMatrixInverse)
        .applyMatrix4(camera.matrixWorld);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    }
    this.position.needsUpdate = true;
    (this.shade.array as Float32Array).set(g.shade);
    (this.ink.array as Float32Array).set(g.ink);
    this.shade.needsUpdate = true;
    this.ink.needsUpdate = true;
    const size = this.size();
    this.view[0] = size.h;
    this.view[1] = size.dpr;
    this.object.matrix.identity();
    this.object.matrixWorld.identity();
  }

  dispose(): void {
    this.object.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
