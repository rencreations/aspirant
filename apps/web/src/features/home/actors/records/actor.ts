/**
 * The record crate and the vinyl disc of the music section: a plain class that the section drives
 * and the stage draws in the shared cast pass. See `docs/design/home/actor-gramophone.md`. In short:
 *
 *  - `place` puts the crate on the stage in pixels. `setTracks` / `useMusic` fill it with the
 *    covers of real tracks: a row of sleeves, each showing a strip of its cover. With the pointer
 *    over one the others part and it comes up and round and shows its whole cover (the flip
 *    through). A press on a sleeve calls `onPick(index)` (cursor "PICK").
 *  - One disc travels: `pick(i)` takes it out of the crate (the sleeve rises, the disc slides out
 *    and flies to a hand), `putOn(seat)` carries it to the platter and lays it there (it then spins
 *    with the platter, as a child of the seat), `putBack()` returns it to its sleeve. These are
 *    targets: they hold until changed, a change of mind turns back along the same path, and a
 *    section that is stateless in the scroll may set them every frame.
 *  - Nothing is allocated in `update`.
 */
import {
  BoxGeometry,
  Euler,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Quaternion,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";

import type { Actor, FrameInfo, HitTarget } from "../../kernel/types";
import {
  CAMERA_Z,
  clientToStage,
  damp,
  depthScale,
  hitDepth,
  scaleForSize,
  segmentDistance,
  unprojectToDepth,
} from "../gramophone/frame";
import { getCast, type Cast } from "../shared/cast";
import type { ActorCtx } from "../shared/types";
import { coverCrop, getCover, loadTracks, type TrackArt } from "./covers";
import { createCrate, type Crate, type CrateSocket } from "./crate";
import { DISC, MAX_SLEEVES, RECORDS_NAME, SLEEVE } from "./facts";
import {
  arcPoint,
  carryLegs,
  journeyPhase,
  phasesAt,
  stepJourney,
  type CarryLegs,
  type JourneyPhase,
  type Phases,
  type Point3,
} from "./journey";
import { BOX_HEIGHT, STEP, mixPose, sleeveShow, sleeveSlot, type SleevePose } from "./layout";
import { createVinyl, type Vinyl } from "./vinyl";

export interface RecordsPlacement {
  /** The screen point of the middle of the crate with its sleeves, CSS pixels from the middle of the screen, y up. */
  x?: number;
  y?: number;
  /** Pixels toward the camera. */
  z?: number;
  /** The on-screen height of the crate with its sleeves. Ignored when `width` is given. */
  height?: number;
  /** The on-screen width of the crate (a phone fits the crate to its width with this). */
  width?: number;
  yaw?: number;
  /** Tips the top toward the camera, about the screen's X axis. */
  pitch?: number;
  roll?: number;
}

export type RecordsSocket = CrateSocket | "disc";

/** What a record is doing: see `journeyPhase`. */
export type RecordsPhase = JourneyPhase;

/** The only thing the crate needs of a gramophone: the node a record lies on. */
export interface RecordSeat {
  readonly recordSeat: Object3D;
  /**
   * The gramophone's own frame (the node that does not spin with the platter). A record is slid in
   * from its -Z side. Without it the record comes from the viewer's side.
   */
  readonly recordApproach?: Object3D;
}

interface Sleeve {
  group: Group;
  mesh: Mesh;
  front: MeshStandardMaterial;
  texture: Texture | null;
  art: TrackArt;
}

/** Floats per sleeve in the hit cache: ax, ay, bx, by, radius, depth. */
const HIT_STRIDE = 6;
const HOVER_BIAS = 30;
/** Where the held disc hangs from a glove: its rim at the glove, its face to the viewer, a little turned. */
const HELD_YAW = 0.3;
/** Without a hand the disc is held above the crate, toward the viewer. */
const HELD_AT = new Vector3(0, 0.66, 0.34);
/** A section's drone sizes the disc by this multiple of the crate's scale (the glove is not the crate). */
const ARC_HEIGHT_A = 0.1;
const ARC_HEIGHT_B = 0.12;
/** The place beside the platter where the disc lies flat before it slides in, in the gramophone's frame (metres): a little above the platter and out on the crank's side. */
const APPROACH = new Vector3(0, 0.045, -0.3);
/** Without a frame the disc comes from the viewer's side, in the world (metres of the platter's scale). */
const APPROACH_WORLD = new Vector3(0, 0.05, 0.34);

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const Q_FLAT_TO_FACE = new Quaternion().setFromAxisAngle(AXIS_X, Math.PI / 2);

const vA = new Vector3();
const vB = new Vector3();
const vC = new Vector3();
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const eulerScratch = new Euler();
const pt = { x: 0, y: 0 };
const pa: Point3 = { x: 0, y: 0, z: 0 };
const pb: Point3 = { x: 0, y: 0, z: 0 };
const po: Point3 = { x: 0, y: 0, z: 0 };

/** A pose of the disc: where, which way, how big (a uniform scale). */
class Pose {
  readonly p = new Vector3();
  readonly q = new Quaternion();
  s = 1;
}

export class RecordsActor implements Actor {
  readonly name = RECORDS_NAME;
  visible = false;
  /** The root the stage draws. `place` moves, turns and scales it. */
  readonly object = new Group();
  /** The milliseconds `update` took on average (an exponential mean). The lab reads it. */
  cost = 0;
  /** A press on a sleeve: the index of the track in `tracks`. The section decides what it does. */
  onPick: ((index: number) => void) | null = null;
  /** The sleeves answer the pointer while this is true and no record is out. */
  interactive = true;
  /** How big the disc is in a hand, as a multiple of its size in the crate. */
  handScale = 1;

  private readonly viewport: ActorCtx["viewport"];
  private readonly cast: Cast;
  private readonly env: Texture;
  private readonly holder = new Group();
  private readonly sockets: Record<CrateSocket, Group>;
  private readonly vinyl: Vinyl;
  private readonly sleeveGeometry: BoxGeometry;
  private readonly keyDir = new Vector3(-0.3, 0.5, 0.8).normalize();
  private readonly fillDir = new Vector3(0.6, -0.1, 0.8).normalize();
  private readonly removeTargets: Array<() => void> = [];

  private crate: Crate | null = null;
  private sleeves: Sleeve[] = [];
  private pl = { x: 0, y: 0, z: 0, height: 360, width: 0, yaw: 0, pitch: 0.25, roll: 0 };

  // Hover and the flip through.
  private hovered = -1;
  private focus = 0;
  private reveal = 0;

  // The journey of the disc.
  private p = 0;
  private index: number | null = null;
  private want: { index: number | null; where: 0 | 1 | 2 } = { index: null, where: 0 };
  private hand: Object3D | null = null;
  private seat: Object3D | null = null;
  private approach: Object3D | null = null;
  private seated = false;
  private lastFrame = -1;

  // The holder's world transform, once a frame.
  private readonly hp = new Vector3();
  private readonly hq = new Quaternion();
  private readonly hqInv = new Quaternion();
  private hs = 1;

  // Scratch for the poses.
  private readonly slot: SleevePose = { x: 0, y: 0, z: 0, yaw: 0, lean: 0 };
  private readonly show: SleevePose = { x: 0, y: 0, z: 0, yaw: 0, lean: 0 };
  private readonly mixed: SleevePose = { x: 0, y: 0, z: 0, yaw: 0, lean: 0 };
  private readonly phases: Phases = { lift: 0, slide: 0, fly: 0, drop: 0, carry: 0 };
  private readonly outPose = new Pose();
  private readonly handPose = new Pose();
  private readonly seatPose = new Pose();
  private readonly nearPose = new Pose();
  private readonly legs: CarryLegs = { approach: 0, glide: 0, turn: 0 };
  private readonly hit = new Float32Array(MAX_SLEEVES * HIT_STRIDE);

  private constructor(ctx: ActorCtx) {
    this.viewport = ctx.viewport;
    this.cast = getCast(ctx.stage);
    this.env = this.cast.env;

    this.object.name = "records";
    this.holder.position.y = -BOX_HEIGHT / 2;
    this.object.add(this.holder);

    this.sockets = { carryL: new Group(), carryR: new Group(), front: new Group() };
    for (const [name, node] of Object.entries(this.sockets)) {
      node.name = `socket_${name}`;
      this.holder.add(node);
    }
    this.sleeveGeometry = new BoxGeometry(SLEEVE.size, SLEEVE.size, SLEEVE.thickness);
    // The box's origin is its middle: move it so a sleeve's origin is the middle of its bottom edge.
    this.sleeveGeometry.translate(0, SLEEVE.size / 2, 0);

    this.vinyl = createVinyl(this.env, { key: this.keyDir, fill: this.fillDir });
    this.vinyl.group.visible = false;
    this.holder.add(this.vinyl.group);

    this.object.visible = false;
    this.cast.add(this.object);
    this.rebuildCrate(0);
    this.applyPlacement();

    for (let i = 0; i < MAX_SLEEVES; i++) {
      const target: HitTarget = {
        id: `record-${i}`,
        cursor: "PICK",
        test: (cx, cy) => this.testSleeve(i, cx, cy),
        enter: () => {
          this.hovered = i;
        },
        leave: () => {
          if (this.hovered === i) this.hovered = -1;
        },
        press: () => {
          if (this.canPick(i)) this.onPick?.(i);
        },
      };
      this.removeTargets.push(ctx.pointer.add(target));
    }
  }

  static create(ctx: ActorCtx): Promise<RecordsActor> {
    return Promise.resolve(new RecordsActor(ctx));
  }

  // ---- filling the crate -----------------------------------------------------------------

  /**
   * Fill the crate with the first `count` tracks of the music room that have a cover (the order of
   * the room's own data). Resolves with the tracks, so the section can map a sleeve to a song
   * (`track.audio` is the address for `audio.playMusic`). Fewer than `count` come back when the data
   * has fewer: the room has seven tracks with covers today.
   */
  async useMusic(count = 10): Promise<TrackArt[]> {
    const tracks = await loadTracks(count);
    await this.setTracks(tracks);
    return tracks;
  }

  /** Put these tracks in the crate, one sleeve each (at most 12). Covers come from the loading list's cache. */
  async setTracks(tracks: readonly TrackArt[]): Promise<void> {
    const list = tracks.slice(0, MAX_SLEEVES);
    const bitmaps = await Promise.all(list.map((t) => getCover(t.cover)));
    // The crate may have been told to clear while the covers were coming.
    this.clearSleeves();
    this.putAwayDisc();
    this.rebuildCrate(list.length);
    list.forEach((art, i) => {
      this.sleeves.push(this.makeSleeve(art, bitmaps[i] ?? null, i));
    });
    this.focus = (list.length - 1) / 2;
    this.hovered = -1;
  }

  /** The tracks in the crate, in sleeve order. */
  get tracks(): readonly TrackArt[] {
    return this.sleeves.map((s) => s.art);
  }

  // ---- what a section sets ---------------------------------------------------------------

  /** Put the crate on the stage. Only the fields given change. The transform is applied at once. */
  place(p: RecordsPlacement): void {
    const pl = this.pl;
    if (p.x !== undefined) pl.x = p.x;
    if (p.y !== undefined) pl.y = p.y;
    if (p.z !== undefined) pl.z = p.z;
    if (p.height !== undefined) {
      pl.height = Math.max(1, p.height);
      pl.width = 0;
    }
    if (p.width !== undefined) pl.width = Math.max(1, p.width);
    if (p.yaw !== undefined) pl.yaw = p.yaw;
    if (p.pitch !== undefined) pl.pitch = p.pitch;
    if (p.roll !== undefined) pl.roll = p.roll;
    this.applyPlacement();
  }

  /** Take sleeve `index` out of the crate and bring the disc to the hand (see `setHandSocket`). */
  pick(index: number): void {
    if (index < 0 || index >= this.sleeves.length) return;
    this.want = { index, where: 1 };
  }

  /**
   * Carry the picked disc to a gramophone's platter and lay it there. With no disc picked yet this
   * picks nothing: call `pick` first (or `pick` then `putOn` in the same frame: it plays both steps).
   */
  putOn(gramophone: RecordSeat): void {
    this.seat = gramophone.recordSeat;
    this.approach = gramophone.recordApproach ?? null;
    if (this.want.index !== null) this.want = { index: this.want.index, where: 2 };
  }

  /** Lift the disc off whatever holds it and return it to its sleeve. */
  putBack(): void {
    this.want = { index: null, where: 0 };
  }

  /**
   * The node a drone's glove carries the disc by. The disc hangs from it, its rim at the node,
   * its face to the viewer. Null puts the disc above the crate. The glove's own socket moves with
   * the drone; the disc follows it.
   */
  setHandSocket(socket: Object3D | null): void {
    this.hand = socket;
  }

  // ---- what a section reads --------------------------------------------------------------

  /** The sleeve under the pointer, or -1. */
  get hoveredIndex(): number {
    return this.hovered;
  }

  /** The sleeve whose disc is out of the crate (picked, held, on the platter), or null. */
  get selected(): number | null {
    return this.index;
  }

  /** What the disc is doing: idle, picking, held, placing, seated, returning. */
  get phase(): RecordsPhase {
    return journeyPhase(this.p, this.targetP());
  }

  /** The number of sleeves. */
  get count(): number {
    return this.sleeves.length;
  }

  /** The crate's size in metres, for a section that fits it to the screen. */
  get size(): { width: number; height: number } {
    return { width: this.crate?.dims.width ?? 0.5, height: BOX_HEIGHT };
  }

  /** The disc's root, to read where it is. Do not move it. */
  get disc(): Object3D {
    return this.vinyl.group;
  }

  /** Where a thing takes hold of the crate (a drone's glove), or the disc itself. */
  socket(name: RecordsSocket): Object3D {
    return name === "disc" ? this.vinyl.group : this.sockets[name];
  }

  // ---- the frame -------------------------------------------------------------------------

  update(frame: FrameInfo): void {
    const t0 = performance.now();
    const dt = frame.dt;
    const snap = this.lastFrame < 0 || frame.frame - this.lastFrame > 1;
    this.lastFrame = frame.frame;

    this.applyPlacement();
    this.holder.matrixWorld.decompose(this.hp, this.hq, vA);
    this.hs = vA.x;
    this.hqInv.copy(this.hq).invert();

    this.stepHover(dt, snap);
    this.advance(dt, snap);
    this.poseSleeves();
    this.poseDisc();
    this.holder.updateMatrixWorld(true);
    this.measureHits();

    // The sheen of the grooves follows the cast's lights (a section may move them).
    this.keyDir.copy(this.cast.key.position).normalize();
    this.fillDir.copy(this.cast.fill.position).normalize();

    this.cost += (performance.now() - t0 - this.cost) * 0.05;
  }

  dispose(): void {
    for (const remove of this.removeTargets) remove();
    this.removeTargets.length = 0;
    this.onPick = null;
    this.clearSleeves();
    this.crate?.dispose();
    this.crate = null;
    this.vinyl.dispose();
    this.sleeveGeometry.dispose();
    this.object.removeFromParent();
  }

  // ---- placement -------------------------------------------------------------------------

  private applyPlacement(): void {
    const pl = this.pl;
    const o = this.object;
    const widthM = this.crate?.dims.width ?? 0.5;
    const scale =
      pl.width > 0
        ? scaleForSize(pl.width, pl.z, widthM)
        : scaleForSize(pl.height, pl.z, BOX_HEIGHT);
    unprojectToDepth(pt, pl.x, pl.y, pl.z);
    o.position.set(pt.x, pt.y, Math.min(pl.z, CAMERA_Z * 0.9));
    o.scale.setScalar(scale);
    o.rotation.set(pl.pitch, pl.yaw, pl.roll);
    o.updateMatrixWorld(true);
  }

  // ---- hover -----------------------------------------------------------------------------

  private canPick(i: number): boolean {
    return this.visible && this.interactive && this.index === null && i < this.sleeves.length;
  }

  private stepHover(dt: number, snap: boolean): void {
    const n = this.sleeves.length;
    const open = this.hovered >= 0 && this.hovered < n && this.canPick(this.hovered);
    if (open) this.focus = snap ? this.hovered : damp(this.focus, this.hovered, 14, dt);
    this.reveal = snap ? (open ? 1 : 0) : damp(this.reveal, open ? 1 : 0, open ? 9 : 6, dt);
    if (this.reveal < 1e-3) this.reveal = 0;
  }

  // ---- the journey -----------------------------------------------------------------------

  /** Where `p` is heading: 0 in the crate, 1 in the hand, 2 on the platter. */
  private targetP(): number {
    if (this.index === null) return 0;
    if (this.want.index !== this.index) return 0;
    const where: number = this.want.where;
    return this.seat ? where : Math.min(where, 1);
  }

  private advance(dt: number, snap: boolean): void {
    // A disc is bound when something asks for it, and let go when it is home again.
    if (this.index === null && this.want.index !== null && this.want.where > 0) {
      this.bind(this.want.index);
    }
    const target = this.targetP();
    this.p = snap ? target : stepJourney(this.p, target, dt);
    if (this.index !== null && this.p === 0 && target === 0) {
      this.index = null;
      this.vinyl.group.visible = false;
      // The next frame binds the disc that was asked for, if it is another.
    }
    // On the platter the disc is the platter's child and spins with it.
    if (this.p === 2 && this.seat && !this.seated) {
      this.seat.add(this.vinyl.group);
      this.vinyl.group.position.set(0, 0, 0);
      this.vinyl.group.quaternion.identity();
      this.vinyl.group.scale.setScalar(1);
      this.seated = true;
    } else if (this.seated && (this.p < 2 || !this.seat)) {
      this.holder.add(this.vinyl.group);
      this.seated = false;
    }
  }

  private bind(index: number): void {
    const sleeve = this.sleeves[index];
    if (!sleeve) return;
    this.index = index;
    this.p = 0;
    this.vinyl.setCover(sleeve.texture, sleeve.art.color);
    this.vinyl.group.visible = true;
    // A cover that arrived while the sleeve waited is already on its texture.
  }

  /** The disc goes home at once (the crate is being refilled). */
  private putAwayDisc(): void {
    this.want = { index: null, where: 0 };
    this.index = null;
    this.p = 0;
    if (this.seated) {
      this.holder.add(this.vinyl.group);
      this.seated = false;
    }
    this.vinyl.group.visible = false;
  }

  // ---- posing ----------------------------------------------------------------------------

  private poseSleeves(): void {
    const n = this.sleeves.length;
    for (let i = 0; i < n; i++) {
      const sleeve = this.sleeves[i]!;
      sleeveSlot(this.slot, i, n, this.focus, this.reveal);
      let pose = this.slot;
      if (i === this.index && this.p > 0 && this.p <= 1) {
        phasesAt(this.p, this.phases);
        sleeveShow(this.show, this.slot.x);
        const t = this.phases.lift * (1 - this.phases.drop);
        pose = mixPose(this.mixed, this.slot, this.show, t);
      }
      const g = sleeve.group;
      g.position.set(pose.x, pose.y, pose.z);
      g.rotation.set(pose.lean, pose.yaw, 0, "YXZ");
    }
  }

  /** Write the disc's pose in the holder's frame from `p`. */
  private poseDisc(): void {
    const index = this.index;
    if (index === null || this.seated) return;
    const sleeve = this.sleeves[index];
    if (!sleeve) return;
    const disc = this.vinyl.group;
    const phases = phasesAt(this.p, this.phases);

    // In the sleeve, or sliding out of it, while the sleeve is at its pose.
    const slideOut = DISC.radius * 1.35 * phases.slide;
    const inSleeve = this.outPose;
    vA.set(0, SLEEVE.size / 2 + slideOut, 0).applyQuaternion(sleeve.group.quaternion);
    inSleeve.p.copy(sleeve.group.position).add(vA);
    inSleeve.q.copy(sleeve.group.quaternion).multiply(Q_FLAT_TO_FACE);
    inSleeve.s = 1;

    if (this.p <= 0.55) {
      this.writeDisc(disc, inSleeve);
      return;
    }
    // The pose where it leaves the sleeve: the sleeve at its shown pose, the disc slid out.
    sleeveSlot(this.slot, index, this.sleeves.length, this.focus, 0);
    sleeveShow(this.show, this.slot.x);
    qA.setFromEuler(eulerScratch.set(this.show.lean, this.show.yaw, 0, "YXZ"));
    vA.set(0, SLEEVE.size / 2 + DISC.radius * 1.35, 0).applyQuaternion(qA);
    this.outPose.p.set(this.show.x, this.show.y, this.show.z).add(vA);
    this.outPose.q.copy(qA).multiply(Q_FLAT_TO_FACE);
    this.outPose.s = 1;

    this.measureHand(this.handPose);
    if (this.p <= 1) {
      this.arcBetween(disc, this.outPose, this.handPose, phases.fly, ARC_HEIGHT_A);
      return;
    }
    this.measureSeat(this.seatPose);
    this.measureNear(this.nearPose, this.seatPose);
    const legs = carryLegs(phases.carry, this.legs);
    if (legs.glide <= 0) {
      // From the hand to the place beside the platter, turning flat on the way.
      this.arcBetween(disc, this.handPose, this.nearPose, legs.approach, ARC_HEIGHT_B, legs.turn);
      return;
    }
    // Sliding in over the platter, down onto it, at the platter's own scale and turn.
    this.arcBetween(disc, this.nearPose, this.seatPose, legs.glide, 0, 1);
  }

  private writeDisc(disc: Object3D, pose: Pose): void {
    disc.position.copy(pose.p);
    disc.quaternion.copy(pose.q);
    disc.scale.setScalar(pose.s);
  }

  /** The disc at `t` of the way from one pose to another, along an arc. Writes into `disc`. */
  private arcBetween(
    disc: Object3D,
    from: Pose,
    to: Pose,
    t: number,
    height: number,
    turn: number = t,
  ): void {
    pa.x = from.p.x;
    pa.y = from.p.y;
    pa.z = from.p.z;
    pb.x = to.p.x;
    pb.y = to.p.y;
    pb.z = to.p.z;
    arcPoint(po, pa, pb, t, height);
    disc.position.set(po.x, po.y, po.z);
    disc.quaternion.slerpQuaternions(from.q, to.q, turn);
    disc.scale.setScalar(from.s + (to.s - from.s) * t);
  }

  /** Where the hand holds the disc, in the holder's frame. */
  private measureHand(out: Pose): void {
    const radiusWorld = DISC.radius * this.hs * this.handScale;
    if (this.hand) {
      this.hand.updateWorldMatrix(true, false);
      this.hand.matrixWorld.decompose(vB, qB, vC);
      // The rim is at the glove: the disc's middle is a radius below it.
      vB.y -= radiusWorld;
    } else {
      vB.copy(HELD_AT).multiplyScalar(this.hs).applyQuaternion(this.hq).add(this.hp);
    }
    qC.setFromAxisAngle(AXIS_Y, HELD_YAW).multiply(Q_FLAT_TO_FACE);
    out.s = this.toLocal(vB, qC, this.hs * this.handScale, out.p, out.q);
  }

  /** Where the record lies on the platter, in the holder's frame. */
  private measureSeat(out: Pose): void {
    const seat = this.seat;
    if (!seat) {
      out.p.copy(this.handPose.p);
      out.q.copy(this.handPose.q);
      out.s = this.handPose.s;
      return;
    }
    seat.updateWorldMatrix(true, false);
    seat.matrixWorld.decompose(vB, qB, vC);
    out.s = this.toLocal(vB, qB, vC.x, out.p, out.q);
  }

  /**
   * The place beside the platter where the disc lies flat before it slides in, in the holder's
   * frame: the seat's pose moved out along the gramophone's -Z side and up a little.
   */
  private measureNear(out: Pose, seat: Pose): void {
    out.q.copy(seat.q);
    out.s = seat.s;
    const frame = this.approach;
    if (frame) {
      frame.updateWorldMatrix(true, false);
      frame.matrixWorld.decompose(vB, qB, vC);
      // The offset in the gramophone's frame, in world units, then into the holder's frame.
      vA.copy(APPROACH).multiplyScalar(vC.x).applyQuaternion(qB);
      vA.applyQuaternion(this.hqInv).divideScalar(this.hs);
    } else {
      vA.copy(APPROACH_WORLD)
        .multiplyScalar(out.s * this.hs)
        .applyQuaternion(this.hqInv)
        .divideScalar(this.hs);
    }
    out.p.copy(seat.p).add(vA);
  }

  /** A world pose into the holder's frame. Returns the scale. */
  private toLocal(
    worldP: Vector3,
    worldQ: Quaternion,
    worldS: number,
    outP: Vector3,
    outQ: Quaternion,
  ): number {
    outP.copy(worldP).sub(this.hp).applyQuaternion(this.hqInv).divideScalar(this.hs);
    outQ.copy(this.hqInv).multiply(worldQ);
    return worldS / this.hs;
  }

  // ---- hits ------------------------------------------------------------------------------

  /** Project each sleeve's middle line to the screen, once a frame. */
  private measureHits(): void {
    const n = this.sleeves.length;
    const perM = this.hs * depthScale(this.object.position.z);
    for (let i = 0; i < n; i++) {
      const sleeve = this.sleeves[i]!;
      const mw = sleeve.group.matrixWorld;
      const at = i * HIT_STRIDE;
      vA.set(0, 0.04, 0).applyMatrix4(mw);
      vB.set(0, SLEEVE.size - 0.04, 0).applyMatrix4(mw);
      const fa = depthScale(vA.z);
      const fb = depthScale(vB.z);
      this.hit[at] = vA.x * fa;
      this.hit[at + 1] = vA.y * fa;
      this.hit[at + 2] = vB.x * fb;
      this.hit[at + 3] = vB.y * fb;
      const focused = this.reveal > 0.5 && Math.abs(i - this.focus) < 0.5;
      const half = focused
        ? SLEEVE.size * 0.5 * Math.abs(Math.cos(sleeve.group.rotation.y)) * 0.85
        : STEP * 0.5;
      this.hit[at + 4] = Math.max(11, half * perM);
      this.hit[at + 5] = hitDepth((vA.z + vB.z) / 2) - (focused ? HOVER_BIAS : 0);
    }
  }

  private testSleeve(i: number, clientX: number, clientY: number): number | null {
    if (!this.canPick(i)) return null;
    const vp = this.viewport();
    clientToStage(pt, clientX, clientY, vp.w, vp.h);
    const at = i * HIT_STRIDE;
    const near = segmentDistance(
      pt.x,
      pt.y,
      this.hit[at]!,
      this.hit[at + 1]!,
      this.hit[at + 2]!,
      this.hit[at + 3]!,
    );
    return near.d <= this.hit[at + 4]! ? this.hit[at + 5]! : null;
  }

  // ---- building --------------------------------------------------------------------------

  private rebuildCrate(n: number): void {
    this.crate?.dispose();
    const crate = createCrate(Math.max(1, n), this.env);
    this.crate = crate;
    this.holder.add(crate.group);
    const { width, depth } = crate.dims;
    this.sockets.carryL.position.set(-width / 2, 0.09, 0);
    this.sockets.carryR.position.set(width / 2, 0.09, 0);
    this.sockets.front.position.set(0, 0.05, depth / 2);
  }

  private makeSleeve(art: TrackArt, bitmap: ImageBitmap | null, index: number): Sleeve {
    const paper = new MeshStandardMaterial({
      color: 0xe8dfcf,
      roughness: 0.85,
      metalness: 0,
      envMap: this.env,
      envMapIntensity: 0.3,
    });
    let texture: Texture | null = null;
    if (bitmap) {
      texture = new Texture(bitmap);
      texture.colorSpace = SRGBColorSpace;
      // The bitmap was flipped when it was made (a bitmap is uploaded as it is).
      texture.flipY = false;
      const crop = coverCrop(bitmap.width, bitmap.height);
      texture.offset.set(crop.ox, crop.oy);
      texture.repeat.set(crop.rx, crop.ry);
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
    const fallback = art.color ?? `hsl(${(index * 47) % 360} 30% 45%)`;
    const front = new MeshStandardMaterial({
      map: texture,
      color: texture ? 0xdcdcdc : fallback,
      roughness: 0.7,
      metalness: 0,
      envMap: this.env,
      envMapIntensity: 0.3,
    });
    // BoxGeometry's groups: +x, -x, +y, -y, +z (the cover), -z.
    const mesh = new Mesh(this.sleeveGeometry, [paper, paper, paper, paper, front, paper]);
    mesh.name = `sleeve_${index}`;
    const group = new Group();
    group.name = `sleeve_${index}_pivot`;
    group.rotation.order = "YXZ";
    group.add(mesh);
    this.holder.add(group);
    return { group, mesh, front, texture, art };
  }

  private clearSleeves(): void {
    for (const sleeve of this.sleeves) {
      const materials = sleeve.mesh.material as Material[];
      // The paper is one material used five times.
      materials[0]?.dispose();
      sleeve.front.dispose();
      sleeve.texture?.dispose();
      sleeve.group.removeFromParent();
    }
    this.sleeves = [];
  }
}
