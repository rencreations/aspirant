/**
 * The gramophone of the music section: a plain class that the section drives and the stage draws
 * in the shared cast pass. See `docs/design/home/actor-gramophone.md`. The contract in short:
 *
 *  - `place` puts it on the stage in pixels (the screen point of the cabinet's axis at the middle of
 *    its height, a depth and an on-screen height). Persistent setters (`setCrankSpeed`, `setNeedle`)
 *    hold until they are changed, so a section that is stateless in the scroll sets them every frame
 *    it shows the actor and a lab script sets them once.
 *  - The visitor can turn the crank: press the handle and drag round the crank's axis. The platter
 *    follows through a gear and a flywheel. `turning` says a hand is on it.
 *  - Sockets (`socket(name)`) are Object3Ds that move with the animated parts: a drone's glove, a
 *    record, a note. `bellMouth` gives the horn's mouth in stage pixels.
 *  - Nothing is allocated in `update`.
 */
import {
  Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";

import type { Actor, FrameInfo, HitTarget } from "../../kernel/types";
import { getCast } from "../shared/cast";
import { forgetGltf, loadGltf } from "../shared/gltf";
import { INK_COLOR, InkMaterial, toonify, type ToonSet } from "../shared/toon";
import type { ActorCtx } from "../shared/types";
import {
  BELL,
  CRANK,
  DRAG_SOCKETS,
  GR_HEIGHT_M,
  GR_MODEL,
  GR_NAME,
  NODE,
  PRESENT_VIEW,
  SOUNDBOX,
} from "./facts";
import {
  CAMERA_Z,
  clamp,
  clientToStage,
  depthScale,
  hitDepth,
  project,
  scaleForSize,
  segmentDistance,
  unprojectToDepth,
} from "./frame";
import { pickFor } from "./look";
import {
  TAU,
  planeAngle,
  stepArm,
  stepCrank,
  stepCrankDriven,
  stepCrankHeld,
  stepPlatter,
  unwrapNear,
  type ArmState,
  type CrankState,
  type PlatterState,
} from "./spin";

export interface GramophonePlacement {
  /** The screen point of the cabinet's axis at the middle of the model's height, CSS pixels from the middle of the screen, y up. */
  x?: number;
  y?: number;
  /** Pixels toward the camera. */
  z?: number;
  /** The on-screen height of the model's box, in CSS pixels. */
  height?: number;
  /** About the vertical axis. The horn is +X at 0 and points to the left of the screen at PI. The default is `PRESENT_VIEW.yaw`. */
  yaw?: number;
  /** Tips the top toward the camera, about the screen's X axis (after the yaw): the view from above that shows the platter. */
  pitch?: number;
}

export type GramophoneSocket =
  | "crankHandle"
  | "recordSeat"
  | "needleTip"
  | "bellMouth"
  | "elbow"
  | "dragFront"
  | "dragBack"
  | "dragSide";

/** The horn's mouth, in stage pixels (what a comic note needs). */
export interface BellView {
  /** Where the middle of the mouth is on the screen. */
  x: number;
  y: number;
  /** The depth the mouth is at (toward the camera). */
  z: number;
  /** The direction the horn points on the screen (unit length), and how much it points at the camera (-1 to 1). */
  dx: number;
  dy: number;
  dz: number;
  /** The mouth's radius on the screen. */
  r: number;
}

/** What the crank's circle looks like on the screen this frame. */
interface CrankView {
  /** The centre of the handle's circle. */
  cx: number;
  cy: number;
  /** Where the circle's local +X and +Y axes land (offsets from the centre, for the throw radius). */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** The handle's position and the hub's. */
  hx: number;
  hy: number;
  ux: number;
  uy: number;
  /** Radii of the two hit shapes, and the depth of the hit. */
  handleR: number;
  armR: number;
  depth: number;
}

/** A prop's line is a little bolder than a figure's: a gramophone has no face to carry the picture. */
const INK_WEIGHT = 1.2;
/**
 * The hull is also pushed back by the slope of the surface (polygon offset). The horn is a thin
 * shell seen at a grazing angle: a push by a fixed distance leaves the hull of its far wall poking
 * through the near one in black sawteeth (looked at), and the slope term keeps it behind.
 */
const INK_SLOPE = 60;
const HANDLE_HIT_M = 0.05;
const ARM_HIT_M = 0.03;
const MIN_HIT_PX = 16;
/** The fastest a hand can turn the crank, radians per second (about 5 turns a second). */
const MAX_HELD_OMEGA = 5 * TAU;
/** How far the cabinet rocks while it is cranked at full speed (radians). */
const ROCK = 0.006;
/** Pixels of a vertical drag per radian, when the crank's plane is seen edge on. */
const EDGE_DRAG = 0.025;

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const vD = new Vector3();
const qA = new Quaternion();
const pt = { x: 0, y: 0 };
const pt2 = { x: 0, y: 0 };

function standardMaterials(root: Object3D): MeshStandardMaterial[] {
  const found = new Set<MeshStandardMaterial>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const list: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if ((m as MeshStandardMaterial).isMeshStandardMaterial) found.add(m as MeshStandardMaterial);
    }
  });
  return Array.from(found);
}

export class GramophoneActor implements Actor {
  readonly name = GR_NAME;
  visible = false;
  /** The root the stage draws. `place` moves, turns and scales it. */
  readonly object = new Group();
  /** The milliseconds `update` took on average (an exponential mean). The lab reads it. */
  cost = 0;
  /** Called when the needle lands on the record, with the landing speed (degrees per second). */
  onNeedleLand: ((speed: number) => void) | null = null;
  /** The crank answers the pointer while this is true. A section turns it off to lock the crank. */
  interactive = true;

  private readonly pointer: ActorCtx["pointer"];
  private readonly viewport: ActorCtx["viewport"];
  private readonly rock = new Group();
  private readonly model: Object3D;
  private readonly crankNode: Object3D;
  private readonly platterNode: Object3D;
  private readonly soundboxNode: Object3D;
  private readonly sockets = new Map<GramophoneSocket, Object3D>();
  /** The materials the file came with (never drawn: the toon set replaces them). */
  private readonly materials: MeshStandardMaterial[];
  /** The toon look and the ink of every part (`look.ts`). */
  private readonly toon: ToonSet;
  private readonly removeTarget: () => void;
  private readonly liftAxis = new Vector3(...SOUNDBOX.liftAxis).normalize();
  private readonly soundboxBase = new Quaternion();

  private pl: { x: number; y: number; z: number; height: number; yaw: number; pitch: number } = {
    x: 0,
    y: 0,
    z: 0,
    height: 400,
    yaw: PRESENT_VIEW.yaw,
    pitch: PRESENT_VIEW.pitch,
  };
  private readonly crank: CrankState = { angle: 0, omega: 0 };
  private readonly platter: PlatterState = { angle: 0, omega: 0 };
  private readonly arm: ArmState = { angle: SOUNDBOX.liftDegrees, vel: 0 };
  private wantOmega = 0;
  private drive: number | null = null;
  private driveSeen = false;
  private armUp = true;
  private lastFrame = -1;

  private readonly view: CrankView = {
    cx: 0,
    cy: 0,
    ax: 1,
    ay: 0,
    bx: 0,
    by: 1,
    hx: 0,
    hy: 0,
    ux: 0,
    uy: 0,
    handleR: 0,
    armR: 0,
    depth: 0,
  };
  private viewFresh = false;
  private hovering = false;
  private drag = { active: false, phi0: 0, angle0: 0, prev: 0, edgeY: 0 };

  private constructor(ctx: ActorCtx, scene: Object3D) {
    this.pointer = ctx.pointer;
    this.viewport = ctx.viewport;
    const cast = getCast(ctx.stage);

    const model = scene.getObjectByName(NODE.root);
    const crank = scene.getObjectByName(NODE.crank);
    const platter = scene.getObjectByName(NODE.platter);
    const soundbox = scene.getObjectByName(NODE.soundbox);
    if (!model || !crank || !platter || !soundbox) {
      throw new Error("The gramophone's nodes are not the ones the build wrote");
    }
    this.model = model;
    this.crankNode = crank;
    this.platterNode = platter;
    this.soundboxNode = soundbox;
    this.soundboxBase.copy(soundbox.quaternion);

    // The box's middle is the object's origin, the floor is below it. The rock tilts about the floor.
    this.model.removeFromParent();
    this.rock.position.y = -GR_HEIGHT_M / 2;
    this.rock.add(this.model);
    this.object.add(this.rock);

    const wanted: Array<[GramophoneSocket, string]> = [
      ["crankHandle", NODE.handle],
      ["recordSeat", NODE.seat],
      ["needleTip", NODE.needle],
      ["bellMouth", NODE.bell],
      ["elbow", NODE.elbow],
    ];
    for (const [key, node] of wanted) {
      const found = scene.getObjectByName(node) ?? this.model.getObjectByName(node);
      if (!found) throw new Error(`The gramophone has no node "${node}"`);
      this.sockets.set(key, found);
    }
    const drag: Array<[GramophoneSocket, readonly [number, number, number]]> = [
      ["dragFront", DRAG_SOCKETS.front],
      ["dragBack", DRAG_SOCKETS.back],
      ["dragSide", DRAG_SOCKETS.side],
    ];
    for (const [key, at] of drag) {
      const node = new Object3D();
      node.name = `socket_${key}`;
      node.position.set(at[0], at[1], at[2]);
      this.model.add(node);
      this.sockets.set(key, node);
    }

    // The anime look: cel bands from the cast's one toon light, an ink line of constant width.
    // The environment, the metalness and the roughness of the file are not read any more.
    this.materials = standardMaterials(this.model);
    const aniso = Math.min(8, ctx.stage.renderer.capabilities.getMaxAnisotropy());
    const ink = new InkMaterial(INK_COLOR, undefined, INK_WEIGHT);
    ink.polygonOffset = true;
    ink.polygonOffsetFactor = INK_SLOPE;
    ink.polygonOffsetUnits = 8;
    this.toon = toonify(this.model, {
      pick: (mesh) => pickFor(mesh.name),
      anisotropy: aniso,
      ink,
    });

    this.object.visible = false;
    this.object.name = "gramophone";
    cast.add(this.object);
    this.applyPlacement();
    this.applyParts();

    const target: HitTarget = {
      id: "gramophone-crank",
      cursor: "TURN",
      test: (cx, cy) => this.testCrank(cx, cy),
      enter: () => {
        this.hovering = true;
      },
      leave: () => {
        this.hovering = false;
      },
      press: (cx, cy) => {
        this.beginTurn(cx, cy);
      },
      release: () => {
        this.endTurn();
      },
    };
    this.removeTarget = ctx.pointer.add(target);
  }

  static async create(ctx: ActorCtx): Promise<GramophoneActor> {
    const gltf = await loadGltf(GR_MODEL);
    return new GramophoneActor(ctx, gltf.scene);
  }

  // ---- what a section sets ---------------------------------------------------------------

  /** Put the gramophone on the stage. Only the fields given change. The transform is applied at once. */
  place(p: GramophonePlacement): void {
    const pl = this.pl;
    if (p.x !== undefined) pl.x = p.x;
    if (p.y !== undefined) pl.y = p.y;
    if (p.z !== undefined) pl.z = p.z;
    if (p.height !== undefined) pl.height = Math.max(1, p.height);
    if (p.yaw !== undefined) pl.yaw = p.yaw;
    if (p.pitch !== undefined) pl.pitch = p.pitch;
    this.applyPlacement();
  }

  /**
   * How fast a drone cranks, in turns per second (about 1.5 to 2 is a comfortable winding; 0 lets it
   * coast to a stop). The crank speeds up quickly and slows down slowly, so a loop that starts and
   * stops looks like a hand. Positive turns clockwise on the screen at the presentation yaw.
   */
  setCrankSpeed(rps: number): void {
    this.wantOmega = Number.isFinite(rps) ? rps * TAU : 0;
  }

  /**
   * Give the crank's angle every frame (radians): a drone that cranks counts its own turn
   * (`duo.crankAngle`), and the handle and the glove must agree. The crank is exactly at this angle,
   * and the platter follows the speed it implies. Null gives the crank back (it coasts, or follows
   * `setCrankSpeed`). A hand on the crank wins over it while it is there.
   */
  driveCrank(angle: number | null): void {
    this.drive = angle !== null && Number.isFinite(angle) ? angle : null;
    if (this.drive === null) this.driveSeen = false;
  }

  /** Lower the needle onto the record (true) or lift it (false). It eases and clicks when it lands. */
  setNeedle(down: boolean): void {
    this.armUp = !down;
  }

  /**
   * Put the crank at an angle (radians about its own axis) and stop it. A drone that holds the
   * handle sets this from its own pose; a lab script uses it to look at the crank.
   */
  setCrankAngle(angle: number): void {
    if (!Number.isFinite(angle)) return;
    this.crank.angle = angle;
    this.crank.omega = 0;
    this.platter.omega = 0;
    this.applyParts();
    this.object.updateMatrixWorld(true);
    this.viewFresh = false;
  }

  // ---- what a section reads --------------------------------------------------------------

  /** A hand is on the crank. */
  get turning(): boolean {
    return this.drag.active;
  }

  /** The crank's speed, turns per second (signed). */
  get crankRps(): number {
    return this.crank.omega / TAU;
  }

  /** The platter's speed, turns per second (signed). A record plays properly above about 0.4. */
  get platterRps(): number {
    return this.platter.omega / TAU;
  }

  /** The needle is on the record and the arm has settled. */
  get needleDown(): boolean {
    return this.arm.angle <= 0.05 && Math.abs(this.arm.vel) < 1;
  }

  /** 0 when the needle is down, 1 when it is lifted. */
  get needleLift(): number {
    return this.arm.angle / SOUNDBOX.liftDegrees;
  }

  /** The crank's angle, radians (about its own Z axis). */
  get crankAngle(): number {
    return this.crank.angle;
  }

  /** The pointer is over the crank. */
  get hot(): boolean {
    return this.hovering;
  }

  /** Where a thing attaches. A child of the socket moves with the animated part. */
  socket(name: GramophoneSocket): Object3D {
    const found = this.sockets.get(name);
    if (!found) throw new Error(`The gramophone has no socket "${name}"`);
    return found;
  }

  /** Where the record sits, on the platter. A child of it spins with the platter. */
  get recordSeat(): Object3D {
    return this.socket("recordSeat");
  }

  /**
   * The gramophone's own frame (it does not turn with the platter): the horn is +X, the crank's face
   * is -Z. A record is slid in from the -Z side at the platter's height, because the horn hangs over
   * the platter and the crank's face is the one that is clear.
   */
  get recordApproach(): Object3D {
    return this.model;
  }

  /**
   * The horn's mouth on the stage, for the comic notes: its centre on the screen, the direction the
   * horn points, and its radius. Valid after `place` and after the last `update`.
   */
  bellMouth(out: BellView): BellView {
    const bell = this.socket("bellMouth");
    bell.getWorldPosition(vA);
    this.model.getWorldQuaternion(qA);
    const dir = vB.set(BELL.axis[0], BELL.axis[1], BELL.axis[2]).applyQuaternion(qA);
    const scale = this.rootScale();
    project(pt, vA.x, vA.y, vA.z);
    // The mouth's edge, a radius away across the screen, and a step along the axis.
    const radius = (BELL.across / 2) * scale;
    vC.set(vA.x + radius, vA.y, vA.z);
    project(pt2, vC.x, vC.y, vC.z);
    out.x = pt.x;
    out.y = pt.y;
    out.z = vA.z;
    out.r = Math.abs(pt2.x - pt.x);
    vD.copy(vA).addScaledVector(dir, 0.1 * scale);
    project(pt2, vD.x, vD.y, vD.z);
    const sx = pt2.x - pt.x;
    const sy = pt2.y - pt.y;
    const len = Math.hypot(sx, sy) || 1;
    out.dx = sx / len;
    out.dy = sy / len;
    out.dz = dir.z;
    return out;
  }

  // ---- the frame -------------------------------------------------------------------------

  update(frame: FrameInfo): void {
    const t0 = performance.now();
    const dt = frame.dt;
    // A frame that does not follow the last one (the actor was hidden) must not carry old motion.
    const gap = this.lastFrame < 0 || frame.frame - this.lastFrame > 1;
    this.lastFrame = frame.frame;
    if (gap) this.driveSeen = false;
    if (gap && !this.drag.active) this.viewFresh = false;

    this.applyPlacement();
    // The ink keeps its width in pixels: it needs the box's height on the screen.
    this.toon.setHeight(this.pl.height * depthScale(this.pl.z));
    this.stepCrankAndPlatter(dt);

    const impact = stepArm(this.arm, this.armUp ? SOUNDBOX.liftDegrees : 0, dt);
    if (impact > 0) this.onNeedleLand?.(impact);

    this.applyParts();
    this.object.updateMatrixWorld(true);
    this.measureCrank();

    this.cost += (performance.now() - t0 - this.cost) * 0.05;
  }

  dispose(): void {
    this.removeTarget();
    this.onNeedleLand = null;
    this.object.removeFromParent();
    this.toon.dispose();
    const textures = new Set<{ dispose(): void }>();
    this.model.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
    });
    for (const m of this.materials) {
      for (const slot of [
        "map",
        "normalMap",
        "roughnessMap",
        "metalnessMap",
        "emissiveMap",
      ] as const) {
        const tex = m[slot];
        if (tex) textures.add(tex);
      }
      m.dispose();
    }
    textures.forEach((t) => {
      t.dispose();
    });
    forgetGltf(GR_MODEL);
  }

  // ---- placement -------------------------------------------------------------------------

  private rootScale(): number {
    return scaleForSize(this.pl.height, this.pl.z, GR_HEIGHT_M);
  }

  private applyPlacement(): void {
    const pl = this.pl;
    const o = this.object;
    unprojectToDepth(pt, pl.x, pl.y, pl.z);
    o.position.set(pt.x, pt.y, Math.min(pl.z, CAMERA_Z * 0.9));
    o.scale.setScalar(this.rootScale());
    o.rotation.set(pl.pitch, pl.yaw, 0);
    this.viewFresh = false;
    o.updateMatrixWorld(true);
  }

  /** Write the moving parts: the crank, the platter, the tonearm and the rock. */
  private applyParts(): void {
    this.crankNode.rotation.z = this.crank.angle;
    this.platterNode.rotation.y = -this.platter.angle;
    this.soundboxNode.quaternion
      .setFromAxisAngle(this.liftAxis, (this.arm.angle * Math.PI) / 180)
      .multiply(this.soundboxBase);
    const speed = clamp(Math.abs(this.crank.omega) / (2 * TAU), 0, 1);
    this.rock.rotation.z = ROCK * speed * Math.sin(this.crank.angle * 2);
  }

  private stepCrankAndPlatter(dt: number): void {
    const d = this.drag;
    if (d.active) {
      if (!this.pointer.state.down) {
        this.endTurn();
      } else {
        const target = this.pointerCrankAngle(this.pointer.state.x, this.pointer.state.y);
        stepCrankHeld(this.crank, target, dt, MAX_HELD_OMEGA);
      }
    }
    if (!d.active) {
      if (this.drive !== null) {
        stepCrankDriven(this.crank, this.drive, dt, !this.driveSeen, MAX_HELD_OMEGA);
        this.driveSeen = true;
      } else {
        stepCrank(this.crank, this.wantOmega, dt);
      }
    }
    stepPlatter(this.platter, this.crank.omega, dt);
  }

  // ---- the crank under the pointer -------------------------------------------------------

  /** Measure the crank's circle on the screen from the current matrices. */
  private measureCrank(): void {
    const v = this.view;
    const scale = this.rootScale();
    const throwWorld = CRANK.throwRadius * scale;
    // The circle's centre: on the crank's axis, at the handle's height along it.
    vA.set(0, 0, CRANK.handleZ);
    this.crankNode.localToWorld(vA);
    project(pt, vA.x, vA.y, vA.z);
    v.cx = pt.x;
    v.cy = pt.y;
    v.depth = hitDepth(vA.z);
    // The circle's two axes are the crank's parent frame's X and Y.
    const parent = this.crankNode.parent;
    if (!parent) return;
    const e = parent.matrixWorld.elements;
    vB.set(e[0], e[1], e[2]).normalize();
    vC.set(e[4], e[5], e[6]).normalize();
    project(pt2, vA.x + vB.x * throwWorld, vA.y + vB.y * throwWorld, vA.z + vB.z * throwWorld);
    v.ax = pt2.x - v.cx;
    v.ay = pt2.y - v.cy;
    project(pt2, vA.x + vC.x * throwWorld, vA.y + vC.y * throwWorld, vA.z + vC.z * throwWorld);
    v.bx = pt2.x - v.cx;
    v.by = pt2.y - v.cy;
    // The handle and the hub on the screen.
    this.socket("crankHandle").getWorldPosition(vD);
    project(pt, vD.x, vD.y, vD.z);
    v.hx = pt.x;
    v.hy = pt.y;
    this.crankNode.getWorldPosition(vD);
    project(pt, vD.x, vD.y, vD.z);
    v.ux = pt.x;
    v.uy = pt.y;
    const depthF = 1 / Math.max(0.1, 1 - vA.z / CAMERA_Z);
    v.handleR = Math.max(MIN_HIT_PX, HANDLE_HIT_M * scale * depthF);
    v.armR = Math.max(MIN_HIT_PX * 0.8, ARM_HIT_M * scale * depthF);
    this.viewFresh = true;
  }

  private ensureView(): CrankView {
    if (!this.viewFresh) this.measureCrank();
    return this.view;
  }

  /** The angle the pointer asks of the crank, in the crank's own turning direction, near the current one. */
  private pointerCrankAngle(clientX: number, clientY: number): number {
    const d = this.drag;
    const v = this.ensureView();
    const vp = this.viewport();
    clientToStage(pt, clientX, clientY, vp.w, vp.h);
    const phi = planeAngle(v.ax, v.ay, v.bx, v.by, pt.x - v.cx, pt.y - v.cy);
    if (phi === null) {
      // Edge on: a vertical drag turns it. Down turns it one way.
      const target = d.angle0 + (pt.y - d.edgeY) * EDGE_DRAG;
      return target;
    }
    d.prev = unwrapNear(d.prev, phi);
    return d.angle0 + (d.prev - d.phi0);
  }

  private testCrank(clientX: number, clientY: number): number | null {
    if (!this.visible || !this.interactive) return null;
    const v = this.ensureView();
    const vp = this.viewport();
    clientToStage(pt, clientX, clientY, vp.w, vp.h);
    if (Math.hypot(pt.x - v.hx, pt.y - v.hy) <= v.handleR) return v.depth - 20;
    const near = segmentDistance(pt.x, pt.y, v.ux, v.uy, v.hx, v.hy);
    return near.d <= v.armR ? v.depth : null;
  }

  private beginTurn(clientX: number, clientY: number): void {
    if (!this.interactive) return;
    const d = this.drag;
    const v = this.ensureView();
    const vp = this.viewport();
    clientToStage(pt, clientX, clientY, vp.w, vp.h);
    d.active = true;
    d.angle0 = this.crank.angle;
    d.edgeY = pt.y;
    const phi = planeAngle(v.ax, v.ay, v.bx, v.by, pt.x - v.cx, pt.y - v.cy);
    d.phi0 = phi ?? 0;
    d.prev = d.phi0;
    // A hand takes the crank at the speed it has: the held step reads the speed again from the angle.
  }

  private endTurn(): void {
    this.drag.active = false;
  }
}
