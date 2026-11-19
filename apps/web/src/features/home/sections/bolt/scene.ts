/**
 * The scene that the bolt and the fall sections share (round four, 20 Nov 2026): Silverbolt in a side
 * view, the doll that rides it, and the blue wavy lines, driven by one pure function of the scroll
 * (`journey.ts`). Both sections call `update(u, frame)` with `u` the scroll in screens since the start
 * of the bolt (`stations.ts`), so the picture is the same whichever of the two draws it. There are no
 * effects here: no marks, no trails, no speed lines. Only the dragon, the doll and the lines.
 *
 * The dragon is placed by its HEAD: `headPoint` is put on the path's point every frame (the offset
 * between the body's place and the head is read from the actor, so the head stands where the path says
 * while the body leans and shakes). The doll rides the `seat` socket (`doll.rideOn`, her own physics and
 * idle). At the end of the slow range the dragon shakes (`sb.shake`) and she loses her grip; from then
 * on she is free, placed in the screen by the fall's ease, on her own fall loop (`doll.fallLoop`).
 *
 * The scene is built when a section mounts and does not wait for the dragon: until the actors have
 * arrived `update` draws only what it has (the lines) and the sections' text carries on.
 */
import { Vector3, type Object3D } from "three";

import { ensureDoll } from "../../actors/doll";
import type { DollActor } from "../../actors/doll";
import { getCast } from "../../actors/shared/cast";
import { whenQuiet } from "../../actors/shared/quiet";
import { warmCast } from "../../actors/shared/warm";
import { ensureSilverbolt } from "../../actors/silverbolt";
import { SilverboltActor } from "../../actors/silverbolt/actor";
import type { FrameInfo, SectionCtx } from "../../kernel/types";

import { BuildGate } from "./build-gate";
import { Journey, whiteRise } from "./journey";
import { WaveLines } from "./lines";
import { BOLT_AT, BOLT_SCREENS, FALL_LEAD } from "./stations";

type DragonPlace = NonNullable<Parameters<SilverboltActor["place"]>[0]>;
type DollPlace = Parameters<DollActor["place"]>[0];

/** The rider API of the doll (`actor-doll.md`, "Round four: riding"). Read through one type so a missing method never throws. */
interface Rider {
  rideOn?(
    seat: Object3D,
    options?: {
      gripL?: Object3D | null;
      gripR?: Object3D | null;
      headPoint?: Object3D | null;
      seed?: number;
    },
  ): void;
  loseGrip?(): void;
  release?(): void;
  onLetGo?: (() => void) | null;
  readonly riding?: boolean;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const shared = new WeakMap<object, BoltScene>();

/** The most the scroll may move, in screens, in one frame and still be the visitor's own (else it is a jump). */
const JUMP_SCREENS = 1.2;

/** The shake: it starts this far (screens) before she loses her grip and is kept going until then. */
const SHAKE_LEAD = 0.45;

/** How far the head is from the body's centre along the nose, in metres, until it has been measured. */
const HEAD_AHEAD_M = 1.2;

export class BoltScene {
  /** Take part in the scene of this stage. Each section that acquires it must release it. */
  static acquire(ctx: SectionCtx): BoltScene {
    let scene = shared.get(ctx.stage);
    if (!scene) {
      scene = new BoltScene(ctx);
      shared.set(ctx.stage, scene);
    }
    scene.users += 1;
    return scene;
  }

  readonly journey = new Journey();
  sb: SilverboltActor | null = null;
  doll: DollActor | null = null;
  private readonly lines: WaveLines | null;
  /** The white's two layers: one in the bolt's slot of the page's DOM and one in the fall's (a slot is only on while its section runs). */
  private whiteBolt: HTMLElement | null = null;
  private whiteFall: HTMLElement | null = null;
  private whiteKey = "";
  private users = 0;
  private disposed = false;

  private lastFrame = -1;
  private lastU = NaN;
  private lastS = NaN;
  private jumpS = true;
  private time = 0;
  // The dragon's head servo: where the body was put and how far the head stood from it.
  private readonly head = new Vector3();
  private placedX = 0;
  private placedY = 0;
  private placedHeight = 0;
  private offX = 0;
  private offY = 0;
  private offSeen = false;
  private shakeUntil = -1;
  // The doll's launch: where her hips were when she let go, in the world of the bolt.
  private launchSeen = false;
  private letGo = false;
  private letGoMove = 0;
  private readonly offset = { x: 0, y: 0 };
  private readonly point = { x: 0, y: 0, s: 1, unit: 1 };
  private lost = false;
  private riding = false;
  // Reused every frame: the actors read these and keep nothing.
  private readonly dragonPlace: DragonPlace = {};
  private readonly dragonFly = { amplitude: 1 };
  private readonly dollPlace: DollPlace = { x: 0, y: 0, height: 1 };
  private readonly gaze = { x: 0, y: 0 };
  /** Whether the actors are built, and the visitor's hurry (`ready()` of the two sections). */
  readonly gate = new BuildGate();
  /** A pause for a quiet scroll that ends at once when the visitor is waiting (also inside `warmCast`). */
  private readonly quiet = (maxWaitMs: number): Promise<void> =>
    this.gate.pause(() => whenQuiet(maxWaitMs));

  private constructor(private readonly ctx: SectionCtx) {
    this.lines = ctx.stage.failed ? null : new WaveLines(ctx.stage);
    if (this.lines) ctx.actors.register(this.lines);
    void this.build();
  }

  private async build(): Promise<void> {
    const ctx = this.ctx;
    try {
      // Everything here is heavy and waits for a pause of the scroll: the section is mounted nine
      // screens early for this. The shared lit scene first, then the dragon, then the doll, so the
      // registry steps the dragon before the doll that hangs on it.
      await this.gate.pause(() => whenQuiet());
      // The engine made the shared lit scene (and its environment map) behind the loading screen.
      const cast = getCast(ctx.stage);
      await this.gate.pause(() => whenQuiet());
      if (this.disposed) return;
      const sb = await ensureSilverbolt(ctx);
      if (this.disposed) return;
      this.sb = sb;
      await warmCast(ctx.stage, cast, sb.object, { quiet: this.quiet });
      if (this.disposed) return;
      await this.gate.pause(() => whenQuiet());
      const doll = await ensureDoll(ctx);
      if (this.disposed) return;
      this.doll = doll;
      await warmCast(ctx.stage, cast, doll.object, { quiet: this.quiet });
    } catch (error) {
      // A part that fails to build is left out: the lines and the text still run.
      console.error("bolt scene", error);
    } finally {
      this.gate.finish();
    }
  }

  release(): void {
    this.users -= 1;
    if (this.users > 0) return;
    this.disposed = true;
    shared.delete(this.ctx.stage);
    const rider = this.doll as unknown as Rider | null;
    if (rider && rider.onLetGo === this.onLetGo) rider.onLetGo = null;
    this.ctx.actors.remove("bolt-lines");
    this.whiteBolt?.style.removeProperty("transform");
    this.whiteFall?.style.removeProperty("transform");
  }

  /** Forget what the visitor did to the dragon: a fresh start when the section is entered. */
  fresh(): void {
    this.sb?.calm();
    this.launchSeen = false;
    this.letGo = false;
    this.lost = false;
  }

  /** The grip is gone (the rider says so about 0.15 s after `loseGrip`): she leaves the seat. */
  private readonly onLetGo = (): void => {
    this.letGoNow(true);
  };

  /** She leaves the seat. `seam`: hide the step from where she was to where the fall puts her (not after a jump). */
  private letGoNow(seam: boolean): void {
    const doll = this.doll;
    if (!doll) return;
    const rider = doll as unknown as Rider;
    if (seam) doll.markPoint("hips", this.point);
    if (rider.release) rider.release();
    else doll.detach();
    this.letGo = true;
    this.letGoMove = this.journey.move;
    this.offset.x = seam ? this.point.x - this.journey.dollX : 0;
    this.offset.y = seam ? this.point.y - this.journey.dollY : 0;
  }

  /**
   * The white that rises from the bottom (`whiteRise`): a lift of its layer, nothing else. The layer is
   * 1.35 screens tall and sits with its bottom on the screen's bottom: at `rise` 0 it is all below the
   * screen, at 1 its top edge is 1.35 screens up. Two copies stand in the DOM, one in each section's slot
   * (the slot of a section is only on while it runs); in the overlap of the two the fall's shows it.
   */
  private writeWhite(u: number): void {
    const doc = this.ctx.dom.root.ownerDocument;
    this.whiteBolt ??= doc.querySelector<HTMLElement>('[data-bolt-white="bolt"]');
    this.whiteFall ??= doc.querySelector<HTMLElement>('[data-bolt-white="fall"]');
    const rise = whiteRise(u);
    const onBolt = u < BOLT_SCREENS - FALL_LEAD;
    const key = `${rise.toFixed(3)}|${onBolt ? 1 : 0}`;
    if (key === this.whiteKey) return;
    this.whiteKey = key;
    const y = ((1 - rise) * 100).toFixed(2);
    const away = "translate3d(0, 100%, 0)";
    const here = `translate3d(0, ${y}%, 0)`;
    if (this.whiteBolt) this.whiteBolt.style.transform = onBolt ? here : away;
    if (this.whiteFall) this.whiteFall.style.transform = onBolt ? away : here;
  }

  /** Set the whole picture for the scroll `u` (screens since the start of the bolt). */
  update(u: number, frame: FrameInfo): void {
    // A section runs: the visitor is here, so the build does not wait for a pause any more.
    if (!this.gate.done) this.gate.hurry();
    if (frame.frame === this.lastFrame && u === this.lastU) return;
    const first = frame.frame !== this.lastFrame;
    if (first) {
      this.jumpS = !(Math.abs(frame.S - this.lastS) < JUMP_SCREENS);
      this.lastS = frame.S;
      this.time = frame.time;
    }
    const prevU = this.lastU;
    this.lastFrame = frame.frame;
    this.lastU = u;
    const { w, h } = frame.viewport;
    const j = this.journey;
    const jumped = Number.isNaN(prevU) || this.jumpS;
    this.writeWhite(u);

    // The doll's launch point: measured from the seat while she rides, else the nominal one.
    const sb = this.sb;
    const doll = this.doll;
    const fallen = u >= BOLT_SCREENS;
    if (!fallen) {
      if (doll?.visible && !this.lost) {
        doll.markPoint("hips", this.point);
        j.launchX = this.point.x;
        j.launchY = this.point.y;
        this.launchSeen = true;
      }
    } else if (!this.launchSeen) {
      // A jump past the throw: the seat as the path puts it at the end of the slow range.
      j.at(BOLT_SCREENS, w, h);
      j.launchX = j.headX - Math.cos(j.heading) * 0.04 * j.length;
      j.launchY = j.headY + 0.15 * j.length;
      this.launchSeen = true;
    }
    j.at(u, w, h);

    const lines = this.lines;
    if (lines) {
      const on = u > BOLT_AT.enter && u < BOLT_SCREENS - 0.1;
      lines.visible = on;
      if (on) lines.set(clamp01((u - BOLT_AT.enter) / (BOLT_SCREENS - 0.1 - BOLT_AT.enter)), w, h);
    }

    if (sb) this.driveDragon(sb, j, u, jumped);
    if (doll) this.driveDoll(doll, sb, j, u, prevU, jumped);
  }

  private driveDragon(sb: SilverboltActor, j: Journey, u: number, jumped: boolean): void {
    sb.visible = j.dragonVisible;
    if (!j.dragonVisible) {
      this.offSeen = false;
      return;
    }
    const height = j.length / SilverboltActor.LENGTH_M;
    // The head stands on the path's point: the offset between the head and the body's place is what the
    // last frame showed (scaled by the camera's zoom).
    const nx = Math.cos(j.heading);
    const ny = Math.sin(j.heading);
    if (this.offSeen && !jumped && this.placedHeight > 0) {
      sb.socket("headPoint").getWorldPosition(this.head);
      const k = height / this.placedHeight;
      this.offX = (this.head.x - this.placedX) * k;
      this.offY = (this.head.y - this.placedY) * k;
      // A stale read (a frame before the matrices moved) is never trusted past two lengths.
      if (Math.hypot(this.offX, this.offY) > 2 * j.length) this.offSeen = false;
    }
    if (!this.offSeen) {
      this.offX = nx * HEAD_AHEAD_M * height;
      this.offY = ny * HEAD_AHEAD_M * height;
      this.offSeen = true;
    }
    const x = j.headX - this.offX;
    const y = j.headY - this.offY;
    const place = this.dragonPlace;
    place.x = x;
    place.y = y;
    place.z = 0;
    place.height = height;
    place.heading = j.heading;
    sb.place(place);
    this.placedX = x;
    this.placedY = y;
    this.placedHeight = height;
    // The wings beat harder when it flies in and calm while the head crawls.
    this.dragonFly.amplitude = 1.15 - 0.55 * j.hover;
    sb.fly(this.time, this.dragonFly);
    // Only the body answers the pointer (the head is locked): a calm lean toward it (SB-dragon asks for 1 here).
    sb.follow(1);

    // The shake: it builds toward the end of the slow range and is kept going until she lets go.
    const from = BOLT_SCREENS - SHAKE_LEAD;
    const into = u >= from && u < BOLT_SCREENS + 0.25;
    if (into && !jumped && sb.shakeAmount < 0.3 && this.time >= this.shakeUntil) {
      sb.shake(1);
      this.shakeUntil = this.time + 0.35;
    }
  }

  private driveDoll(
    doll: DollActor,
    sb: SilverboltActor | null,
    j: Journey,
    u: number,
    prevU: number,
    jumped: boolean,
  ): void {
    const rider = doll as unknown as Rider;
    if (j.dollMode === "hidden" || (!sb && j.dollMode === "ride")) {
      doll.visible = false;
      return;
    }
    doll.visible = true;
    doll.reset();
    doll.blinkAuto(true);
    const pointer = this.ctx.pointer.state;
    const { w, h } = j;
    const ridingNow = j.dollMode === "ride" || (j.dollMode === "fall" && !this.letGo);

    if (ridingNow && sb) {
      this.ride(doll, sb, rider);
      const seatPlace = this.dollPlace;
      seatPlace.x = 0;
      seatPlace.y = 0;
      seatPlace.z = 0;
      seatPlace.height = j.rideHeight;
      seatPlace.yaw = 0;
      seatPlace.pitch = 0;
      seatPlace.roll = 0;
      seatPlace.pivot = "hips";
      doll.place(seatPlace);
      if (pointer.inside) {
        this.gaze.x = pointer.x - w / 2;
        this.gaze.y = h / 2 - pointer.y;
        doll.look(this.gaze);
      }
      // She loses her grip where the slow range ends (crossing forward); a jump past it just lets go.
      if (j.dollMode === "fall" && !this.lost) {
        this.lost = true;
        if (jumped || Number.isNaN(prevU)) {
          this.letGoNow(false);
        } else if (rider.loseGrip) {
          rider.loseGrip();
          rider.onLetGo = this.onLetGo;
        } else {
          this.letGoNow(true);
        }
      }
      return;
    }

    // Free: placed in the screen by the fall's ease, on her own fall loop.
    if (this.lost && !this.letGo) this.letGoNow(false);
    if (j.dollMode === "ride") {
      // Back above the throw: she sits again.
      this.lost = false;
      this.letGo = false;
    }
    const k = this.letGo ? clamp01(1 - (j.move - this.letGoMove) / 0.12) : 0;
    const free = this.dollPlace;
    free.x = j.dollX + this.offset.x * k;
    free.y = j.dollY + this.offset.y * k;
    free.z = 60;
    free.height = j.dollHeight;
    free.yaw = 0;
    free.pitch = 0;
    free.roll = 0;
    free.pivot = "hips";
    doll.place(free);
    doll.fallLoop(1);
    void u;
  }

  /** Put her on the seat (once, and again when she comes back to it). */
  private ride(doll: DollActor, sb: SilverboltActor, rider: Rider): void {
    const seat = sb.socket("seat");
    if (rider.rideOn) {
      if (!this.riding || !rider.riding) {
        rider.rideOn(seat, {
          gripL: sb.socket("gripL"),
          gripR: sb.socket("gripR"),
          headPoint: sb.socket("headPoint"),
        });
        this.riding = true;
      }
    } else if (doll.parentSocket !== seat) {
      doll.attach(seat, { keepWorld: false });
    }
    this.letGo = false;
  }
}
