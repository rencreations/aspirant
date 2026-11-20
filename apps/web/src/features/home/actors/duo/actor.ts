import {
  BackSide,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
  type PerspectiveCamera,
  type Texture,
} from "three";

import { clamp01 } from "@/features/about/choreo/ease";
import { BALL_RADIUS } from "@/features/about/companions/model";

import type { ScenePass } from "../../kernel/stage";
import type { Actor, FrameInfo, HitTarget } from "../../kernel/types";
import type { ActorCtx } from "../shared/types";

import { EASE, seeded } from "./curves";
import {
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_GOLD,
  FACE_PINK,
  FACE_RED,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
  makeFaceUniforms,
  packFace,
  type FaceName,
  type FaceUniforms,
} from "./face";
import { isJump, newDroneState, stepDrone, type DroneState, type Held } from "./follow";
import {
  buildGoal,
  id as droneId,
  type CarryMemory,
  type CarryParams,
  type Ctx,
  type CrankParams,
  type HaulParams,
  type PairMode,
  type PullParams,
  type SimplePose,
  type SoloMode,
} from "./goals";
import { clientToStage, insideAny, newDiscs, project, type Disc } from "./hit";
import {
  newGoal,
  type DroneGoal,
  type DroneId,
  type DuoMark,
  type DuoMarkKind,
  type DuoMarkTone,
  type EarPose,
  type GlovePose,
  type Hand,
  type DronePose,
  type Vec2,
} from "./pose";
import {
  ANSWERS,
  DIZZY_PRESSES,
  DIZZY_WINDOW,
  hoverGoal,
  isGesture,
  nextAmbient,
  react,
  startMove,
  TOGETHER,
  type Move,
  type Reaction,
} from "./reactions";

/**
 * The two Guinevere drones, in the home's one renderer. The drawing is /about's own: six rigid
 * shapes per drone (a ball with its screen, two ears, two floating gloves), unlit, with a thin ink
 * line round every part, and a face drawn by the screen's shader. What is new is that they live
 * in the stage's pixel frame (a perspective pass, so a place is the place on screen whatever its
 * depth), play the performance of `goals.ts` on springs (`follow.ts`), carry a payload between
 * their hands, pull it bigger, crank, haul, dance, stare and ask each other what is going on.
 *
 * A section drives it by setting the target state every frame it shows it (`place`, then one `pose`
 * or `carry` or `pull`, and `crank` or `haul` for one of them). One-shot reactions (a hover, a
 * press, a bump) are timed inside and always finish. See `docs/design/home/actor-duo.md`.
 */

const INK = 0x2a3342;
/** The outline's width on the screen, in CSS pixels. */
const OUTLINE_PX = 1.15;
/** A pointer farther than this many radii is not looked at. */
const SIGHT = 9;

type PartName = "body" | "face" | "ear_L" | "ear_R" | "glove_L" | "glove_R";
const PARTS: readonly PartName[] = ["body", "face", "ear_L", "ear_R", "glove_L", "glove_R"];

interface Extras {
  screen?: { y: number; halfWidth: number };
}

interface Built {
  actor: Group;
  ball: Group;
  lean: Group;
  body: Mesh;
  earL: Mesh;
  earR: Mesh;
  gloveL: Mesh;
  gloveR: Mesh;
  anchorL: Object3D;
  anchorR: Object3D;
  earRestL: Quaternion;
  earRestR: Quaternion;
  face: FaceUniforms;
  outline: { value: number };
}

interface PlaceOne {
  /** The middle of the ball, in stage pixels (origin in the middle of the screen, y up). */
  x: number;
  y: number;
  /** The ball's height on the screen, in CSS pixels (its diameter). */
  height: number;
  /** A turn added to the drone's own, in radians, anticlockwise. */
  roll?: number;
}

interface PoseOptions {
  /** What they look at (stare, confused, and now and then the float), a point of the stage. */
  target?: Vec2 | null;
  /** The way each leaves, for `leave`. By default each goes outward, away from the other. */
  dirs?: readonly [Vec2, Vec2];
}

interface CrankOptions {
  /** Turns a second. 0 stops it where it is. */
  speed: number;
}

interface HaulOptions {
  /** The way the drone pulls, from the handle to the drone. Default: to the left. */
  dir?: Vec2;
  /** How hard it pulls, 0 to 1. */
  strain?: number;
}

type PairKind = SimplePose | "carry" | "pull";

const index = (who: DroneId): 0 | 1 => (who === "a" ? 0 : 1);
const handOf = (hand: Hand): "L" | "R" => (hand === "L" ? "L" : "R");

interface DuoState {
  mode: PairKind;
  weight: number;
  time: number;
  placed: Array<{ x: number; y: number; height: number }>;
  poses: Array<{ x: number; y: number; z: number; radius: number; face: string }>;
  moves: Array<string | null>;
  solo: Array<string | null>;
  crank: number[];
}

export class DuoActor implements Actor {
  readonly name = "duo";
  visible = false;
  /** A section that wants no answers to the pointer (a scene on the scroll) sets this: the hit targets are off. */
  locked = false;
  /**
   * The pose's clock, in seconds, when a section makes the dance a function of the scroll. `null`: the
   * pose runs on the duo's own clock. The blinks, the ambient life and the one-shots keep their own.
   */
  poseClock: number | null = null;
  readonly object: Group;

  private readonly built: readonly [Built, Built];
  private readonly states: readonly [DroneState, DroneState];
  private readonly goals: readonly [DroneGoal, DroneGoal] = [newGoal(), newGoal()];
  private readonly ctxs: readonly [Ctx, Ctx];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly textures = new Set<Texture>();
  private readonly pass: ScenePass;
  private readonly removeTargets: Array<() => void> = [];

  // The state a section sets.
  private readonly placed = [
    { x: -180, y: -40, height: 110, roll: 0 },
    { x: 180, y: -40, height: 110, roll: 0 },
  ];
  private readonly placedWas = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private kind: PairKind = "float";
  private weight = 1;
  private weightWas = 0;
  private target: Vec2 | null = null;
  private dirs: [Vec2, Vec2] = [
    { x: -1, y: 0.25 },
    { x: 1, y: 0.25 },
  ];
  private readonly simple: { kind: SimplePose } = { kind: "float" };
  private readonly carryMode: { kind: "carry"; params: CarryParams } = {
    kind: "carry",
    params: { x: 0, y: 0, width: 300, tension: 0.4, struggle: 0.3, lift: 0.3 },
  };
  private readonly pullMode: { kind: "pull"; params: PullParams } = {
    kind: "pull",
    params: { cx: 0, cy: 0, w: 300, h: 100, strain: 0.5 },
  };
  private readonly crankModes: [
    { kind: "crank"; params: CrankParams },
    { kind: "crank"; params: CrankParams },
  ] = [
    { kind: "crank", params: { handle: null, speed: 0, phase: 0 } },
    { kind: "crank", params: { handle: null, speed: 0, phase: 0 } },
  ];
  private readonly haulModes: [
    { kind: "haul"; params: HaulParams },
    { kind: "haul"; params: HaulParams },
  ] = [
    {
      kind: "haul",
      params: { handle: null, vel: { x: 0, y: 0 }, dir: { x: -1, y: 0 }, strain: 0.5 },
    },
    {
      kind: "haul",
      params: { handle: null, vel: { x: 0, y: 0 }, dir: { x: -1, y: 0 }, strain: 0.5 },
    },
  ];
  private readonly soloKind: Array<"crank" | "haul" | null> = [null, null];
  private readonly handles: Array<Object3D | null> = [null, null];
  private readonly handlePos: [Vec2, Vec2] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private readonly handlePrev: [Vec2, Vec2] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private readonly handleSeen = [false, false];
  private readonly crankPhase = [0, 0];
  private payload: Object3D | null = null;
  private readonly adopted = new Set<Object3D>();
  private readonly attached = new Map<Object3D, Object3D | null>();
  private readonly pins: Array<{ object: Object3D; anchor: Object3D }> = [];
  private readonly held: [Held, Held] = [
    { name: null, blend: 0 },
    { name: null, blend: 0 },
  ];
  private sink: ((mark: DuoMark) => void) | null = null;

  // The state of the performance.
  private time = 0;
  private lastFrame = -10;
  private readonly snap = [true, true];
  private readonly moves: [Move | null, Move | null] = [null, null];
  private readonly hovered = [false, false];
  private readonly hoverT = [0, 0];
  private readonly presses: [number[], number[]] = [[], []];
  private readonly pressedAt = [-100, -100];
  private readonly answers = [0, 0];
  private lastHello = -100;
  private ambientOn = true;
  private ambientIn = 5;
  private ambientWho: 0 | 1 = 0;
  private echo: { who: 0 | 1; kind: Reaction; in: number } | null = null;
  private readonly rand = seeded(4242);
  private readonly carryMemory: CarryMemory = { lift: 0, seen: false };
  private readonly nowPos: [Vec2, Vec2] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private readonly homePos: [Vec2, Vec2] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  private readonly pointerStage: Vec2 = { x: 0, y: 0 };
  private viewW = 1440;
  private viewH = 900;
  private readonly discs: [Disc[], Disc[]] = [newDiscs(3), newDiscs(3)];
  private readonly scratch = new Vector3();
  private readonly scratchQ = new Quaternion();
  private readonly screenPoint = { x: 0, y: 0 };
  private readonly earQ = new Quaternion();
  private readonly axisX = new Vector3(1, 0, 0);
  private readonly axisY = new Vector3(0, 1, 0);
  private readonly axisZ = new Vector3(0, 0, 1);

  constructor(
    private readonly ctx: ActorCtx,
    file: Object3D,
    pass: ScenePass,
  ) {
    this.pass = pass;
    const model = file.getObjectByName("companion");
    if (!model) throw new Error("The file is not the companion's model.");
    const screen = (model.userData as Extras).screen;
    if (!screen) throw new Error("The companion's file does not say where its screen is.");
    const find = (name: PartName): Mesh => {
      const part = model.getObjectByName(name);
      if (!(part instanceof Mesh)) throw new Error(`The companion has no part called ${name}.`);
      return part as Mesh;
    };
    const source: Record<PartName, Mesh> = {
      body: find("body"),
      face: find("face"),
      ear_L: find("ear_L"),
      ear_R: find("ear_R"),
      glove_L: find("glove_L"),
      glove_R: find("glove_R"),
    };

    const paint = (source.body.material as MeshBasicMaterial).clone();
    paint.toneMapped = false;
    this.disposables.push(paint, source.body.geometry);
    for (const name of PARTS) {
      if (name !== "body") this.disposables.push(source[name].geometry);
    }
    const map = paint.map;
    if (map) {
      this.textures.add(map);
      map.anisotropy = Math.min(8, ctx.stage.renderer.capabilities.getMaxAnisotropy());
    }

    const linear = (hex: number) => new Color(hex).toArray();
    /** A screen of its own for each drone: the same glass, its own face. */
    const glass = (): { material: MeshBasicMaterial; uniforms: FaceUniforms } => {
      const uniforms = makeFaceUniforms();
      uniforms.uScreen.value = [screen.y, 1 / screen.halfWidth];
      uniforms.uGold.value = linear(FACE_GOLD);
      uniforms.uRed.value = linear(FACE_RED);
      uniforms.uPink.value = linear(FACE_PINK);
      const material = new MeshBasicMaterial({ map, toneMapped: false });
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader =
          FACE_VERTEX_HEAD +
          shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>\n${FACE_VERTEX_BODY}`,
          );
        shader.fragmentShader =
          FACE_FRAGMENT_HEAD +
          shader.fragmentShader.replace("#include <map_fragment>", FACE_FRAGMENT_MAP);
      };
      // Both screens compile to one program: the difference is in the uniforms.
      material.customProgramCacheKey = () => "duo-face";
      this.disposables.push(material);
      return { material, uniforms };
    };
    /** The thin ink line round every part: the part again, pushed out along its normals, inside out. */
    const hull = (width: { value: number }): MeshBasicMaterial => {
      const material = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uOutline = width;
        shader.vertexShader = `uniform float uOutline;\n${shader.vertexShader}`.replace(
          "#include <begin_vertex>",
          "vec3 transformed = position + normal * uOutline;",
        );
      };
      material.customProgramCacheKey = () => "duo-hull";
      this.disposables.push(material);
      return material;
    };

    this.object = new Group();
    this.object.name = "duo";
    this.object.visible = false;
    const build = (): Built => {
      const face = glass();
      const outline = { value: 0 };
      const ink = hull(outline);
      const part = (name: PartName, lined: boolean): Mesh => {
        const from = source[name];
        const mesh = new Mesh(from.geometry, name === "face" ? face.material : paint);
        mesh.position.copy(from.position);
        mesh.quaternion.copy(from.quaternion);
        // The parts move far from where their boxes were worked out: none is ever culled.
        mesh.frustumCulled = false;
        if (lined) {
          const line = new Mesh(from.geometry, ink);
          line.frustumCulled = false;
          mesh.add(line);
        }
        return mesh;
      };
      const actor = new Group();
      const ball = new Group();
      const lean = new Group();
      lean.rotation.order = "YXZ";
      const body = part("body", true);
      const earL = part("ear_L", true);
      const earR = part("ear_R", true);
      const gloveL = part("glove_L", true);
      const gloveR = part("glove_R", true);
      gloveL.rotation.order = "YXZ";
      gloveR.rotation.order = "YXZ";
      const anchorL = new Object3D();
      const anchorR = new Object3D();
      anchorL.name = "anchor_glove_L";
      anchorR.name = "anchor_glove_R";
      gloveL.add(anchorL);
      gloveR.add(anchorR);
      body.add(part("face", false), earL, earR);
      lean.add(body);
      ball.add(lean);
      actor.add(ball, gloveL, gloveR);
      this.object.add(actor);
      return {
        actor,
        ball,
        lean,
        body,
        earL,
        earR,
        gloveL,
        gloveR,
        anchorL,
        anchorR,
        earRestL: earL.quaternion.clone(),
        earRestR: earR.quaternion.clone(),
        face: face.uniforms,
        outline,
      };
    };
    this.built = [build(), build()];
    this.states = [newDroneState(0), newDroneState(1)];

    const cueFor =
      (from: DroneId) =>
      (kind: DuoMarkKind, x: number, y: number, tone: DuoMarkTone, size: number, turn: number) => {
        // The size of a cue goes with the size of the drone that makes it (1 at a ball 140 px tall).
        const scale = (this.placed[from === "a" ? 0 : 1]?.height ?? 140) / 140;
        this.sink?.({ kind, x, y, tone, size: size * scale, turn, from });
      };
    const makeCtx = (who: 0 | 1): Ctx => ({
      who,
      t: 0,
      dt: 0,
      r: 50,
      home: this.homePos[who],
      other: this.homePos[who === 0 ? 1 : 0],
      now: this.nowPos[who],
      otherNow: this.nowPos[who === 0 ? 1 : 0],
      view: { w: 1440, h: 900 },
      pointer: null,
      w: 1,
      wPrev: 0,
      target: null,
      dir: this.dirs[who],
      cue: cueFor(droneId(who)),
    });
    this.ctxs = [makeCtx(0), makeCtx(1)];

    pass.scene.add(this.object);
    // The shaders and the picture go to the card now, not in the first frame of the entrance.
    this.object.visible = true;
    ctx.stage.renderer.compile(pass.scene, pass.camera);
    for (const t of this.textures) ctx.stage.renderer.initTexture(t);
    this.object.visible = false;

    this.removeTargets.push(this.targetFor(0), this.targetFor(1));
    this.readView();
    this.syncPlaced(true);
    this.step(0, true);
    this.sync();
  }

  // The state a section sets ---------------------------------------------------------------------

  /**
   * Where each drone is and how big (the height of its ball on the screen). Every frame the duo is
   * shown. A step bigger than 40 percent of the screen in one frame is a jump and the springs snap.
   */
  place(a: PlaceOne, b: PlaceOne): void {
    this.writePlace(0, a);
    this.writePlace(1, b);
  }

  /**
   * One pose for the pair, by name. `w` is its weight, 0 to 1: how much of it (for `leave` it is
   * the progress, 0 at their places to 1 gone; for `bow` the depth). Replaces `carry` and `pull`;
   * a `crank` or a `haul` of one of them stays until `release`.
   */
  pose(name: SimplePose, w = 1, options: PoseOptions = {}): void {
    this.setKind(name);
    this.setPayload(null);
    this.simple.kind = name;
    this.weight = clamp01(w);
    this.target = options.target ?? null;
    if (options.dirs) {
      this.dirs[0] = options.dirs[0];
      this.dirs[1] = options.dirs[1];
    }
  }

  /**
   * They carry `payload` between their hands: `a` holds its left end with its left glove (the one on
   * the right of the screen), `b` holds the right end. The duo moves the payload to the middle of
   * its two hands and turns it with the line between them; its size is the section's. A payload with
   * no parent is added to the duo's pass so the hands can be in front of it. `x`, `y` and `width`
   * say where the middle of the payload should be and how wide it is on the screen.
   */
  carry(payload: Object3D | null, options: CarryParams): void {
    this.setKind("carry");
    this.weight = 1;
    this.setPayload(payload);
    Object.assign(this.carryMode.params, options);
  }

  /**
   * They pull a payload bigger: `a` holds the bottom left corner of the rectangle and `b` the top
   * right, each with the glove that faces the payload, bodies outside the corners, leaning back. The
   * section grows the rectangle (and the payload); the duo follows its corners. `payload` is only
   * moved to the middle of the rectangle.
   */
  pull(payload: Object3D | null, options: PullParams): void {
    this.setKind("pull");
    this.weight = 1;
    this.setPayload(payload);
    Object.assign(this.pullMode.params, options);
  }

  /**
   * One drone turns a crank: its glove stays on `handle` (an object that moves, in any scene of the
   * home) and the body rocks with each turn. Read the angle of the crank from `crankAngle` and give
   * it to the crank of the machine. Stays until `release`.
   */
  crank(who: DroneId, handle: Object3D | null, options: CrankOptions): void {
    const i = index(who);
    this.soloKind[i] = handle ? "crank" : null;
    this.handles[i] = handle;
    const mode = this.crankModes[i];
    mode.params.speed = options.speed;
    mode.params.phase = this.crankPhase[i] ?? 0;
  }

  /**
   * One drone drags something by a handle: it flies ahead of the handle, glove on it, leaning into
   * the pull and bobbing with the steps. The section moves the load. Stays until `release`.
   */
  haul(who: DroneId, handle: Object3D | null, options: HaulOptions = {}): void {
    const i = index(who);
    this.soloKind[i] = handle ? "haul" : null;
    this.handles[i] = handle;
    const params = this.haulModes[i].params;
    params.dir.x = options.dir?.x ?? -1;
    params.dir.y = options.dir?.y ?? 0;
    params.strain = options.strain ?? 0.5;
    this.handleSeen[i] = false;
  }

  /** Let a drone go back to the pair's pose after a `crank` or a `haul`. */
  release(who: DroneId): void {
    const i = index(who);
    this.soloKind[i] = null;
    this.handles[i] = null;
  }

  /** The angle of the crank a drone turns, in radians (it grows with the speed). */
  crankAngle(who: DroneId): number {
    return this.crankPhase[index(who)] ?? 0;
  }

  /** Hold a face on a drone, blended in by `blend` (0 to 1), or let it go with `null`. */
  face(who: DroneId, name: FaceName | null, blend = 1): void {
    const held = this.held[index(who)];
    held.name = name;
    held.blend = name ? clamp01(blend) : 0;
  }

  /** Start a one-shot move by name now (for both when `who` is left out). It always finishes. */
  react(kind: Reaction, who?: DroneId): void {
    const list = who ? [index(who)] : [0, 1];
    for (const i of list) {
      if (i === 0 || i === 1) this.moves[i] = startMove(kind);
    }
  }

  /**
   * Start the performance over: its clock goes back to 0 (a dance begins at its first phrase), the
   * moves and the presses are forgotten and both drones are put at their goals at once. A section
   * calls it when a scene begins; the probes call it to look at a pose from its start.
   */
  restart(): void {
    this.time = 0;
    this.moves[0] = null;
    this.moves[1] = null;
    for (const list of this.presses) list.length = 0;
    this.pressedAt[0] = -100;
    this.pressedAt[1] = -100;
    this.lastHello = -100;
    this.hoverT[0] = 0;
    this.hoverT[1] = 0;
    this.carryMemory.seen = false;
    this.ambientIn = 5;
    this.echo = null;
    this.snap[0] = true;
    this.snap[1] = true;
  }

  /**
   * The ambient life, on by default: while the pair only floats, every six to twelve seconds one of
   * them hops, giggles, winks, hides its face or flexes and the other often answers. Probes that
   * want a pose and nothing else switch it off.
   */
  ambient(on: boolean): void {
    this.ambientOn = on;
    this.echo = null;
  }

  /** A blink now. */
  blink(who?: DroneId): void {
    for (const i of who ? [index(who)] : [0, 1]) {
      const s = this.states[i];
      if (s) s.blinkAt = 0;
    }
  }

  /** Where the comic marks the duo asks for are sent. `null` stops them. */
  setMarkSink(sink: ((mark: DuoMark) => void) | null): void {
    this.sink = sink;
  }

  // The sockets ----------------------------------------------------------------------------------

  /**
   * A node that follows a glove. `hand` is the drone's own side: `L` is on the right of the screen
   * when the drone faces us. Parent anything of the duo's pass to it, or use `pin` for something
   * that is drawn by another pass.
   */
  anchor(who: DroneId, hand: Hand): Object3D {
    const built = this.built[index(who)];
    return handOf(hand) === "L" ? built.anchorL : built.anchorR;
  }

  /** Put an object of the duo's own pass in a glove, keeping where it is in the world. */
  attach(object: Object3D, who: DroneId, hand: Hand): void {
    if (!this.attached.has(object)) this.attached.set(object, object.parent);
    this.object.updateMatrixWorld(true);
    this.anchor(who, hand).attach(object);
  }

  /** Take it out of the glove again, back where it came from, keeping where it is in the world. */
  detach(object: Object3D): void {
    const back = this.attached.get(object);
    this.attached.delete(object);
    if (back) back.attach(object);
    else object.removeFromParent();
  }

  /**
   * Make an object of ANOTHER perspective pass (the lit cast: the crate of records, the gramophone's
   * handle) follow a glove: every frame, after the glove is placed, its position and turn are the
   * glove's, in the one world the perspective passes share. The flat (ortho) passes are not that
   * world: for them read `gloveAt` and place the object on the screen yourself.
   */
  pin(object: Object3D, who: DroneId, hand: Hand): void {
    this.unpin(object);
    this.pins.push({ object, anchor: this.anchor(who, hand) });
  }

  unpin(object: Object3D): void {
    const at = this.pins.findIndex((p) => p.object === object);
    if (at >= 0) this.pins.splice(at, 1);
  }

  /**
   * A flat card of one colour, one unit a pixel, in the duo's own pass and not yet placed: a stand-in
   * for the logo while a section is built, and what the lab carries. The duo frees it when it goes.
   */
  makeCard(width: number, height: number, color: number): Mesh {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial({ color, toneMapped: false });
    this.disposables.push(geometry, material);
    const card = new Mesh(geometry, material);
    card.scale.set(width, height, 1);
    card.frustumCulled = false;
    return card;
  }

  /** A glove on the screen, in stage pixels. Read it after the frame's update. */
  gloveAt(who: DroneId, hand: Hand, out: Vec2): Vec2 {
    const anchor = this.anchor(who, hand);
    anchor.getWorldPosition(this.scratch);
    if (
      project(this.scratch.x, this.scratch.y, this.scratch.z, this.distance(), this.screenPoint)
    ) {
      out.x = this.screenPoint.x;
      out.y = this.screenPoint.y;
    }
    return out;
  }

  // The actor ------------------------------------------------------------------------------------

  update(frame: FrameInfo): void {
    // A section may call this itself to read the gloves of THIS frame (`gloveAt`) before the kernel
    // does: the second call of one frame does nothing.
    if (frame.frame === this.lastFrame) return;
    // The kernel skips an actor that is not shown: after a gap it is not where it was left.
    const gap = frame.frame - this.lastFrame > 2;
    this.lastFrame = frame.frame;
    this.readView();
    this.syncPlaced(gap);
    this.step(Math.min(frame.dt, 0.05), gap);
    this.sync();
  }

  /** Run the duo's own clock by `seconds` without drawing (the probes' way to a frame at a time). */
  advance(seconds: number, step = 1 / 60): void {
    this.readView();
    const n = Math.max(1, Math.round(seconds / step));
    for (let i = 0; i < n; i += 1) this.step(step, false);
    this.sync();
  }

  state(): DuoState {
    return {
      mode: this.kind,
      weight: this.weight,
      time: this.time,
      placed: this.placed.map((p) => ({ x: p.x, y: p.y, height: p.height })),
      poses: this.states.map((s) => ({
        x: s.pose.x,
        y: s.pose.y,
        z: s.pose.z,
        radius: s.pose.radius,
        face: s.faceName,
      })),
      moves: this.moves.map((m) => m?.kind ?? null),
      solo: [...this.soloKind],
      crank: [...this.crankPhase],
    };
  }

  dispose(): void {
    for (const remove of this.removeTargets) remove();
    this.removeTargets.length = 0;
    for (const object of this.adopted) object.removeFromParent();
    this.adopted.clear();
    for (const [object, back] of this.attached) {
      if (back) back.attach(object);
      else object.removeFromParent();
    }
    this.attached.clear();
    this.pins.length = 0;
    this.object.removeFromParent();
    this.sink = null;
    for (const d of this.disposables) d.dispose();
    for (const t of this.textures) t.dispose();
  }

  // Inside ---------------------------------------------------------------------------------------

  private distance(): number {
    return (this.pass.camera as PerspectiveCamera).position.z;
  }

  private readView(): void {
    const v = this.ctx.viewport();
    this.viewW = v.w;
    this.viewH = v.h;
    const s = this.ctx.pointer.state;
    const live = s.inside && s.type === "mouse";
    this.hasPointer = live;
    if (live) clientToStage(s.x, s.y, this.viewW, this.viewH, this.pointerStage);
  }

  private hasPointer = false;

  private setKind(kind: PairKind): void {
    this.kind = kind;
  }

  private setPayload(payload: Object3D | null): void {
    if (payload === this.payload) return;
    // A payload the duo put in its pass leaves it when it is no longer carried.
    const old = this.payload;
    if (old && this.adopted.delete(old)) old.removeFromParent();
    this.payload = payload;
    this.carryMemory.seen = false;
    if (payload && !payload.parent) {
      this.pass.scene.add(payload);
      this.adopted.add(payload);
    }
  }

  private writePlace(i: 0 | 1, p: PlaceOne): void {
    const to = this.placed[i];
    if (!to) return;
    to.x = p.x;
    to.y = p.y;
    to.height = Math.max(8, p.height);
    to.roll = p.roll ?? 0;
  }

  /** Decide whether a place moved so far in one frame that the springs must snap. */
  private syncPlaced(force: boolean): void {
    for (const i of [0, 1] as const) {
      const p = this.placed[i];
      const was = this.placedWas[i];
      if (!p || !was) continue;
      if (force || isJump(p.x - was.x, p.y - was.y, this.viewW, this.viewH)) this.snap[i] = true;
      was.x = p.x;
      was.y = p.y;
    }
  }

  private readHandle(i: 0 | 1, dt: number): void {
    const object = this.handles[i];
    const pos = this.handlePos[i];
    const prev = this.handlePrev[i];
    if (!object || !pos || !prev) return;
    object.updateWorldMatrix(true, false);
    this.scratch.setFromMatrixPosition(object.matrixWorld);
    if (
      !project(this.scratch.x, this.scratch.y, this.scratch.z, this.distance(), this.screenPoint)
    ) {
      return;
    }
    pos.x = this.screenPoint.x;
    pos.y = this.screenPoint.y;
    const haul = this.haulModes[i];
    const vel = haul.params.vel;
    if (this.handleSeen[i] && dt > 0) {
      // Smoothed, so a still handle does not shiver.
      vel.x += ((pos.x - prev.x) / dt - vel.x) * Math.min(1, dt * 12);
      vel.y += ((pos.y - prev.y) / dt - vel.y) * Math.min(1, dt * 12);
    } else if (!this.handleSeen[i]) {
      vel.x = 0;
      vel.y = 0;
    }
    prev.x = pos.x;
    prev.y = pos.y;
    this.handleSeen[i] = true;
  }

  /** Everything of one frame of the performance, with no three in it. */
  private step(dt: number, snapAll: boolean): void {
    this.time += dt;
    this.stepAmbient(dt);
    const pair: PairMode =
      this.kind === "carry" ? this.carryMode : this.kind === "pull" ? this.pullMode : this.simple;
    for (const i of [0, 1] as const) {
      const s = this.states[i];
      const now = this.nowPos[i];
      now.x = s.x.x;
      now.y = s.y.x;
      const home = this.homePos[i];
      const place = this.placed[i];
      if (place) {
        home.x = place.x;
        home.y = place.y;
      }
    }
    // The cranks and the hauls follow their handles.
    for (const i of [0, 1] as const) {
      const kind = this.soloKind[i];
      if (!kind) continue;
      this.readHandle(i, dt);
      const have = (this.handleSeen[i] ?? false) || kind === "crank";
      const handle = have ? this.handlePos[i] : null;
      if (kind === "crank") {
        const mode = this.crankModes[i];
        this.crankPhase[i] = (this.crankPhase[i] ?? 0) + Math.PI * 2 * mode.params.speed * dt;
        mode.params.phase = this.crankPhase[i] ?? 0;
        mode.params.handle = this.handles[i] ? this.handlePos[i] : null;
      } else {
        this.haulModes[i].params.handle = handle;
      }
    }

    for (const i of [0, 1] as const) {
      const place = this.placed[i];
      const c = this.ctxs[i];
      const g = this.goals[i];
      const state = this.states[i];
      if (!place) continue;
      c.t = this.poseClock ?? this.time;
      c.dt = dt;
      c.r = place.height / 2;
      c.view.w = this.viewW;
      c.view.h = this.viewH;
      c.pointer =
        this.hasPointer &&
        Math.hypot(this.pointerStage.x - state.x.x, this.pointerStage.y - state.y.x) < SIGHT * c.r
          ? this.pointerStage
          : null;
      c.w = this.weight;
      c.wPrev = this.weightWas;
      c.target = this.target;
      c.dir = this.dirs[i];
      const solo: SoloMode =
        this.soloKind[i] === "crank"
          ? this.crankModes[i]
          : this.soloKind[i] === "haul"
            ? this.haulModes[i]
            : null;
      buildGoal(g, c, pair, solo, this.carryMemory);
      g.roll += place.roll;

      const free = this.interactive();
      // The hover and the one-shot moves are written over the pose.
      this.hoverT[i] = clamp01((this.hoverT[i] ?? 0) + (free && this.hovered[i] ? 5 : -4) * dt);
      hoverGoal(g, i, EASE.io(this.hoverT[i] ?? 0));
      const m = this.moves[i];
      if (m) {
        m.was = m.t;
        m.t += dt;
        react(g, c, m);
        if (m.t >= m.seconds) this.finish(i, m);
      }
      // It looks at the other one while the other does something worth a look.
      const other = this.moves[i === 0 ? 1 : 0];
      if (!m && other && isGesture(other.kind) && !g.look) {
        g.look = this.nowPos[i === 0 ? 1 : 0];
        g.turn = 0.5;
      }
    }
    this.weightWas = this.weight;

    for (const i of [0, 1] as const) {
      const state = this.states[i];
      const goal = this.goals[i];
      if (!state || !goal) continue;
      stepDrone(state, goal, dt, snapAll || this.snap[i] === true, this.time, this.held[i]);
      this.snap[i] = false;
    }
  }

  /** While they only float: now and then one does something, and the other answers a moment later. */
  private stepAmbient(dt: number): void {
    const echo = this.echo;
    if (echo) {
      echo.in -= dt;
      if (echo.in <= 0) {
        this.moves[echo.who] ??= startMove(echo.kind);
        this.echo = null;
      }
    }
    const idle =
      this.ambientOn &&
      this.kind === "float" &&
      this.weight > 0.5 &&
      !this.soloKind[0] &&
      !this.soloKind[1] &&
      !this.moves[0] &&
      !this.moves[1];
    if (!idle) return;
    this.ambientIn -= dt;
    if (this.ambientIn > 0) return;
    const next = nextAmbient(this.rand);
    const who = this.ambientWho;
    const other = who === 0 ? 1 : 0;
    this.ambientWho = other;
    this.moves[who] = startMove(next.kind);
    if (next.echo) this.echo = { who: other, kind: next.echo, in: next.echoAfter };
    this.ambientIn = next.wait;
  }

  /** A move ended: the dizziness turns into a sulk, then it is over. */
  private finish(i: 0 | 1, m: Move): void {
    this.moves[i] = m.kind === "dizzy" ? startMove(i === 0 ? "fume" : "pout") : null;
  }

  /** Hover and press answer in the poses that are free; in a task a press is only a spark. */
  private interactive(): boolean {
    return this.kind !== "carry" && this.kind !== "pull" && this.kind !== "leave";
  }

  private targetFor(i: 0 | 1): () => void {
    const discs = this.discs[i];
    const state = this.states[i];
    const target: HitTarget = {
      id: `duo-${droneId(i)}`,
      cursor: i === 0 ? "SPAR" : "HELLO",
      test: (cx, cy) => {
        if (!this.visible || this.locked) return null;
        clientToStage(cx, cy, this.viewW, this.viewH, this.screenPoint);
        if (!insideAny(discs, this.screenPoint.x, this.screenPoint.y)) return null;
        // Smaller is nearer: the distance from the camera.
        return this.distance() - state.z.x;
      },
      enter: () => {
        this.hovered[i] = true;
        if (this.interactive() && !this.moves[i] && this.time - this.lastHello > 4) {
          this.lastHello = this.time;
          this.moves[i] = startMove("hello");
        }
      },
      leave: () => {
        this.hovered[i] = false;
      },
      press: () => {
        this.press(i);
      },
    };
    return this.ctx.pointer.add(target);
  }

  private press(i: 0 | 1): void {
    const state = this.states[i];
    const place = this.placed[i];
    if (!place) return;
    if (!this.interactive()) {
      // Carrying or pulling: no time for that. A spark and a flinch.
      this.ctxs[i].cue("spark", state.x.x, state.y.x + place.height * 0.9, "gold", 0.7, 0);
      return;
    }
    const other = i === 0 ? 1 : 0;
    const now = this.time;
    const list = this.presses[i];
    list.push(now);
    while (list.length > 0 && now - (list[0] ?? now) > DIZZY_WINDOW) list.shift();
    this.pressedAt[i] = now;
    const busyTogether = this.moves.some((m) => m?.kind === "bump" || m?.kind === "cheer");
    if (busyTogether) {
      this.ctxs[i].cue("spark", state.x.x, state.y.x + place.height * 0.9, "gold", 0.7, 0);
      return;
    }
    if (now - (this.pressedAt[other] ?? -100) < TOGETHER) {
      this.moves[0] = startMove("bump");
      this.moves[1] = startMove("bump");
      return;
    }
    if (list.length >= DIZZY_PRESSES) {
      list.length = 0;
      this.moves[i] = startMove("dizzy");
      return;
    }
    const answers = ANSWERS[i];
    const n = this.answers[i] ?? 0;
    this.answers[i] = n + 1;
    const kind = answers[n % answers.length];
    if (kind) this.moves[i] = startMove(kind);
    // The other one looks round: it is covered by the gaze rule while this plays.
  }

  // The three side -------------------------------------------------------------------------------

  private sync(): void {
    const D = this.distance();
    for (const i of [0, 1] as const) {
      const built = this.built[i];
      const state = this.states[i];
      this.apply(built, state.pose, D);
    }
    this.object.updateMatrixWorld(true);
    this.syncPayload(D);
    this.syncPins();
    this.syncDiscs(D);
  }

  private apply(one: Built, pose: DronePose, D: number): void {
    // A thing nearer than the picture plane is drawn bigger and farther from the middle. The place
    // and the size are scaled by `k` so what the section asked for is what lands on the screen.
    const k = (D - pose.z) / D;
    const R = pose.radius;
    const perMetre = R / BALL_RADIUS;
    const s = (R * k) / BALL_RADIUS;
    one.actor.position.set(pose.x * k, pose.y * k, pose.z);
    one.actor.scale.setScalar(s);
    const wide = 1 / Math.sqrt(Math.max(0.3, pose.squash));
    one.ball.scale.set(wide, pose.squash, wide);
    one.lean.rotation.set(pose.pitch, pose.yaw, pose.roll);
    one.body.rotation.z = pose.spin;
    this.ear(one.earL, one.earRestL, pose.earL, -1);
    this.ear(one.earR, one.earRestR, pose.earR, 1);
    this.glove(one.gloveL, pose.gloveL, pose, k, s, D);
    this.glove(one.gloveR, pose.gloveR, pose, k, s, D);
    packFace(one.face, pose.face, pose.live);
    one.outline.value = OUTLINE_PX / perMetre;
  }

  /** An ear: its rest, then the splay, the fold and the twist about its own axes. */
  private ear(mesh: Mesh, rest: Quaternion, pose: EarPose, side: number): void {
    mesh.quaternion.copy(rest);
    mesh.quaternion.multiply(this.earQ.setFromAxisAngle(this.axisZ, side * pose.splay));
    mesh.quaternion.multiply(this.earQ.setFromAxisAngle(this.axisX, pose.fold));
    mesh.quaternion.multiply(this.earQ.setFromAxisAngle(this.axisY, side * pose.twist));
  }

  private glove(mesh: Mesh, g: GlovePose, pose: DronePose, k: number, s: number, D: number): void {
    if (g.free) {
      // A point of the screen: undo the perspective at the glove's own depth, so the hand is exactly there.
      const R = pose.radius;
      const sx = pose.x + g.x * R;
      const sy = pose.y + g.y * R;
      const Zg = Math.min(D * 0.9, pose.z + g.z * R * k);
      const f = (D - Zg) / D;
      mesh.position.set((sx * f - pose.x * k) / s, (sy * f - pose.y * k) / s, g.z * BALL_RADIUS);
    } else {
      mesh.position.set(g.x * BALL_RADIUS, g.y * BALL_RADIUS, g.z * BALL_RADIUS);
    }
    mesh.rotation.set(g.rx, g.ry, g.rz);
    mesh.scale.setScalar(g.size);
  }

  private syncPayload(D: number): void {
    const payload = this.payload;
    if (!payload) return;
    if (this.kind === "carry") {
      // Between the two hands: the left glove of the first and the right glove of the second.
      const a = this.built[0].anchorL;
      const b = this.built[1].anchorR;
      a.getWorldPosition(this.scratch);
      const ax = this.scratch.x;
      const ay = this.scratch.y;
      const az = this.scratch.z;
      b.getWorldPosition(this.scratch);
      this.placePayload(
        payload,
        (ax + this.scratch.x) / 2,
        (ay + this.scratch.y) / 2,
        (az + this.scratch.z) / 2,
        Math.atan2(this.scratch.y - ay, this.scratch.x - ax),
        D,
      );
    } else if (this.kind === "pull") {
      const p = this.pullMode.params;
      this.placePayload(payload, p.cx, p.cy, 0, 0, D, true);
    }
  }

  /** Put the payload at a point. A payload of the duo's own pass is placed in the world; any other on the screen. */
  private placePayload(
    payload: Object3D,
    x: number,
    y: number,
    z: number,
    angle: number,
    D: number,
    onScreen = false,
  ): void {
    const own = payload.parent === this.pass.scene;
    if (own && !onScreen) {
      payload.position.set(x, y, z);
    } else if (own) {
      const f = (D - z) / D;
      payload.position.set(x * f, y * f, z);
    } else if (onScreen) {
      payload.position.set(x, y, 0);
    } else if (project(x, y, z, D, this.screenPoint)) {
      payload.position.set(this.screenPoint.x, this.screenPoint.y, 0);
    }
    payload.rotation.z = angle;
  }

  private syncPins(): void {
    for (const pin of this.pins) {
      pin.anchor.getWorldPosition(this.scratch);
      pin.object.position.copy(this.scratch);
      pin.anchor.getWorldQuaternion(this.scratchQ);
      pin.object.quaternion.copy(this.scratchQ);
    }
  }

  private syncDiscs(D: number): void {
    for (const i of [0, 1] as const) {
      const discs = this.discs[i];
      const state = this.states[i];
      const built = this.built[i];
      const ball = discs[0];
      if (ball) {
        ball.x = state.pose.x;
        ball.y = state.pose.y;
        ball.r = state.pose.radius * 1.25;
      }
      const l = discs[1];
      const r = discs[2];
      for (const [disc, anchor] of [
        [l, built.anchorL],
        [r, built.anchorR],
      ] as const) {
        if (!disc) continue;
        anchor.getWorldPosition(this.scratch);
        if (project(this.scratch.x, this.scratch.y, this.scratch.z, D, this.screenPoint)) {
          disc.x = this.screenPoint.x;
          disc.y = this.screenPoint.y;
          disc.r = state.pose.radius * 0.8;
        } else {
          disc.r = 0;
        }
      }
    }
  }
}
