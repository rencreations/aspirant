/**
 * The scene that the bolt and the fall sections share: Silverbolt, the doll that rides its head, the
 * wavy lines, the comic marks and the trails, driven by one pure function of the scroll
 * (`journey.ts`). Both sections call `update(t, frame)` with `t` in screens since the start of the
 * bolt section, so the picture is the same whichever of the two draws it, and a frame in which both
 * run (the lead of the fall) is drawn once.
 *
 * Everything the visitor can do (poke the dragon, pull its tail, pet the doll) is the actors' own
 * and lives in their hit targets; this file turns their events into comic marks and into the doll's
 * faces. The scene is built when a section mounts and does not wait for the dragon: until the actors
 * have arrived `update` draws only what it has (the lines) and the sections' text carries on.
 */
import { ensureDoll } from "../../actors/doll";
import { getCast } from "../../actors/shared/cast";
import type { DollActor, FaceName } from "../../actors/doll";
import { ensureSilverbolt } from "../../actors/silverbolt";
import type { SilverboltActor } from "../../actors/silverbolt/actor";
import type { MarkEvent } from "../../actors/silverbolt/marks";
import { ensureMarks } from "../../fx/comic-marks";
import { ensureTrails } from "../../fx/trail";
import type { FrameInfo, SectionCtx } from "../../kernel/types";
import type { Mesh, MeshStandardMaterial, Texture } from "three";

import { BEAT, FALL_MOODS, Journey } from "./journey";
import { WaveLines } from "./lines";

type Marks = Awaited<ReturnType<typeof ensureMarks>>;
type Trails = Awaited<ReturnType<typeof ensureTrails>>;
type Sustain = ReturnType<Marks["sustain"]>;
type Trail = ReturnType<Trails["create"]>;
type DragonPlace = NonNullable<Parameters<SilverboltActor["place"]>[0]>;
type DollPlace = Parameters<DollActor["place"]>[0];

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** The part of the section's length in which the lines are drawn. */
const LINES_FROM = 0.2;
const LINES_TO = 4.3;

/** How long the doll is startled when the dragon is poked, in seconds. */
const STARTLE = 0.9;

/** Where the doll sits on the dragon's head, in the head's own frame, in shares of her height (calibrated by eye). */
const SEAT = { x: 0, y: 0.12, z: 0.4, yaw: 0.3, pitch: 0, roll: 0 } as const;

const shared = new WeakMap<object, BoltScene>();

/** The maps of a standard material that the dragon's look uses. */
const TEXTURE_KEYS = [
  "map",
  "emissiveMap",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "alphaMap",
  "aoMap",
] as const;

/** The next animation frame, or 40 ms later where there are none (a hidden tab). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(resolve, 40);
    requestAnimationFrame(() => {
      clearTimeout(id);
      resolve();
    });
  });
}

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
  private marks: Marks | null = null;
  private readonly lines: WaveLines | null;
  private wingL: Trail | null = null;
  private wingR: Trail | null = null;
  private tail: Trail | null = null;
  private speed: Sustain | null = null;
  private air: Sustain | null = null;
  private clouds: Sustain[] = [];
  private offMarks: (() => void) | null = null;
  private users = 0;
  private disposed = false;

  private lastFrame = -1;
  private lastT = NaN;
  private time = 0;
  private startleUntil = 0;
  private startleFace: FaceName = "shocked";
  /** The doll's place on the screen when she left the head, minus where the fall says she is: it fades out. */
  private readonly offset = { x: 0, y: 0 };
  private offsetOn = false;
  private readonly point = { x: 0, y: 0, s: 1, unit: 1 };
  private sneeze = 0;
  // Reused every frame: the actors read these and keep nothing.
  private readonly dragonPlace: DragonPlace = {};
  private readonly dragonFly = { amplitude: 1 };
  private readonly dollPlace: DollPlace = { x: 0, y: 0, height: 1 };
  private readonly gaze = { x: 0, y: 0 };
  /** The viewport the cloud loops were made for: they are made again when it changes. */
  private cloudsFor = { w: 0, h: 0 };

  private constructor(private readonly ctx: SectionCtx) {
    this.lines = ctx.stage.failed ? null : new WaveLines(ctx.stage);
    if (this.lines) ctx.actors.register(this.lines);
    void this.build();
  }

  private async build(): Promise<void> {
    const ctx = this.ctx;
    try {
      // Effects first (they are small), then the dragon, then the doll, so the registry steps the dragon
      // before the doll that hangs on it.
      const [marks, trails] = await Promise.all([ensureMarks(ctx), ensureTrails(ctx)]);
      if (this.disposed) return;
      this.marks = marks;
      this.speed = marks.sustain("speed", { size: 70 });
      this.air = marks.sustain("air", { size: 170 });
      this.makeClouds(marks);
      const sb = await ensureSilverbolt(ctx);
      if (this.disposed) return;
      this.wingL = trails.create({ colors: ["gold", "pink"], width: 26, life: 0.7, taper: 1.5 });
      this.wingR = trails.create({ colors: ["gold", "pink"], width: 26, life: 0.7, taper: 1.5 });
      this.tail = trails.create({ colors: ["sky", "white"], width: 22, life: 0.9, taper: 1.4 });
      this.offMarks = sb.onMark((event) => {
        this.onDragonMark(event);
      });
      this.sb = sb;
      const doll = await ensureDoll(ctx);
      if (this.disposed) return;
      this.doll = doll;
      await this.warm(sb, doll);
    } catch (error) {
      // A part that fails to build is left out: the lines and the text still run.
      console.error("bolt scene", error);
    }
  }

  /** Two clouds that rise past the falling doll from the lower corners, for the viewport of now. */
  private makeClouds(marks: Marks): void {
    const { w, h } = this.ctx.viewport();
    for (const cloud of this.clouds) cloud.stop();
    this.cloudsFor.w = w;
    this.cloudsFor.h = h;
    this.clouds = [
      marks.sustain("cloud", { size: 130, offset: { x: -0.32 * w, y: -0.5 * h } }),
      marks.sustain("cloud", { size: 110, offset: { x: 0.3 * w, y: -0.58 * h } }),
    ];
  }

  /**
   * Compile the dragon's programs now, while it is far away, so that the frame it first shows does not
   * stall on the driver (measured: half a second). `compileAsync` collects the visible materials at
   * the call and waits for the programs without blocking the frame. The kernel hides the actors again
   * at the next frame.
   */
  private async warm(sb: SilverboltActor, doll: DollActor): Promise<void> {
    const { renderer } = this.ctx.stage;
    const cast = getCast(this.ctx.stage);
    const sbWas = sb.object.visible;
    const dollWas = doll.object.visible;
    sb.object.visible = true;
    doll.object.visible = true;
    try {
      await renderer.compileAsync(cast.pass.scene, cast.pass.camera);
    } catch {
      // A lost context compiles on the first draw instead.
    } finally {
      sb.object.visible = sbWas;
      doll.object.visible = dollWas;
    }
    // The dragon's maps go to the GPU one to a frame (the doll does the same for hers), so that the
    // frame it first shows does not have to send them all at once.
    const maps = new Set<Texture>();
    sb.object.traverse((node) => {
      const material = (node as Mesh).material as
        MeshStandardMaterial | MeshStandardMaterial[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        for (const key of TEXTURE_KEYS) {
          const map = m[key];
          if (map) maps.add(map);
        }
      }
    });
    for (const map of maps) {
      if (this.disposed) return;
      await nextFrame();
      renderer.initTexture(map);
    }
    // One real draw of both into a single pixel of the canvas: the buffers, the bone textures and every
    // program variant the first visible frame needs are made now. The stage clears the canvas each frame.
    if (this.disposed) return;
    await nextFrame();
    sb.object.visible = true;
    doll.object.visible = true;
    const scissor = renderer.getScissorTest();
    renderer.setScissorTest(true);
    renderer.setScissor(0, 0, 1, 1);
    try {
      renderer.render(cast.pass.scene, cast.pass.camera);
    } finally {
      renderer.setScissorTest(scissor);
      sb.object.visible = sbWas;
      doll.object.visible = dollWas;
    }
  }

  release(): void {
    this.users -= 1;
    if (this.users > 0) return;
    this.disposed = true;
    shared.delete(this.ctx.stage);
    this.offMarks?.();
    this.offMarks = null;
    for (const handle of [this.speed, this.air, ...this.clouds]) handle?.stop();
    const doll = this.doll;
    if (doll?.onReact === this.onDollReact) doll.onReact = null;
    this.ctx.actors.remove("bolt-lines");
  }

  /** Forget what the visitor did to the dragon: a fresh start when the section is entered. */
  fresh(): void {
    this.sb?.calm();
    this.marks?.clear();
    this.offsetOn = false;
  }

  /** The doll's own marks: a press throws stars, a dizzy spell sweats. */
  private readonly onDollReact = (kind: "hover" | "press" | "dizzy"): void => {
    const doll = this.doll;
    const marks = this.marks;
    if (!doll || !marks) return;
    const size = Math.max(46, this.journey.dollHeight * 0.55);
    if (kind === "press") marks.emit("starburst", { at: doll.socket("head"), size, strength: 0.7 });
    else if (kind === "dizzy")
      marks.emit("sweat", { at: doll.socket("head"), size: size * 0.4, count: 3 });
    else marks.emit("sparkle", { at: doll.socket("cheekL"), size: size * 0.35 });
  };

  /** Silverbolt says a mark belongs: draw it (the table of `fx-marks.md`), and startle the doll. */
  private onDragonMark(event: MarkEvent): void {
    const marks = this.marks;
    if (!marks) return;
    const h = this.journey.dragonHeight;
    const size = Math.max(44, h * 0.3);
    const strength = event.strength;
    const at = event.at;
    switch (event.kind) {
      case "sparks":
        marks.emit("spark", { at, strength, size });
        break;
      case "smoke":
        marks.emit("steam", { at, strength, rotation: this.journey.heading, size: size * 0.7 });
        break;
      case "vein":
        marks.emit("vein", { at, strength, size });
        break;
      case "sweat":
        marks.emit("sweat", { at, strength, size: size * 0.5 });
        break;
      case "stars":
        marks.emit("starburst", { at, strength, size: size * 1.2 });
        break;
      case "gust":
        marks.emit("speed", { at, strength, rotation: this.journey.heading + Math.PI, size });
        break;
      case "puff":
        marks.emit("poof", { at, strength, size: size * 1.4 });
        break;
      case "heart":
        marks.emit("heart", { at, strength, size: size * 0.8 });
        break;
      case "chomp":
        marks.emit("flash", { at, size: size * 1.3 });
        marks.emit("spark", { at, size });
        break;
    }
    // The doll feels everything the dragon does.
    if (event.kind !== "heart" && event.kind !== "smoke") {
      this.startleUntil = this.time + STARTLE;
      this.startleFace = event.kind === "stars" ? "dizzy" : "shocked";
    }
  }

  /** Set the whole picture for `t` screens since the start of the bolt section. */
  update(t: number, frame: FrameInfo): void {
    if (frame.frame === this.lastFrame && t === this.lastT) return;
    const first = frame.frame !== this.lastFrame;
    const prevT = this.lastT;
    this.lastFrame = frame.frame;
    this.lastT = t;
    if (first) this.time = frame.time;
    const { w, h } = frame.viewport;
    const j = this.journey.at(t, w, h);

    const lines = this.lines;
    if (lines) {
      const on = t > LINES_FROM - 0.05 && t < LINES_TO;
      lines.visible = on;
      if (on) lines.set(clamp01((t - LINES_FROM) / (LINES_TO - LINES_FROM)), w, h);
    }

    const sb = this.sb;
    const doll = this.doll;
    const marks = this.marks;

    // A jump in the scroll: nothing that follows a path may be carried across it.
    const jumped = Number.isNaN(prevT) || Math.abs(t - prevT) > 0.5;
    const threw = !jumped && prevT < BEAT.launch && t >= BEAT.launch;

    if (sb) {
      sb.visible = j.dragonVisible;
      if (j.dragonVisible) {
        const sway = j.hover;
        const sx = Math.sin(this.time * 0.85) * 0.016 * w * sway;
        const sy = Math.sin(this.time * 1.3 + 1) * 0.014 * h * sway;
        const place = this.dragonPlace;
        place.x = j.dragonX + sx;
        place.y = j.dragonY + sy;
        place.z = 0;
        place.height = j.dragonHeight;
        place.yaw = j.yaw;
        place.pitch = j.pitch;
        place.roll = j.roll;
        sb.place(place);
        this.dragonFly.amplitude = j.flyAmp;
        sb.fly(this.time, this.dragonFly);
        sb.follow(0.3 + 0.3 * j.hover);
        if (this.sneeze > this.time) sb.jaw(0.85);
        const moving = j.speed > 0.2 * h;
        if (this.wingL && this.wingR && this.tail) {
          const a = sb.trailAnchors;
          if (moving && !jumped) {
            this.wingL.track(a[0]!);
            this.wingR.track(a[1]!);
            this.tail.track(a[2]!);
          }
        }
        if (this.speed && moving) {
          this.speed.update(sb.socket("bodyCentre"), clamp01(j.speed / (1.1 * h)) * 0.8, j.heading);
        }
      }
      if (threw) this.sneezeNow(sb);
    }

    if (doll) {
      this.driveDoll(doll, sb, j, t, threw, jumped, w, h);
    }

    if (marks && this.air && doll && j.dollMode === "fall") {
      if (this.cloudsFor.w !== w || this.cloudsFor.h !== h) this.makeClouds(marks);
      this.air.update(doll.socket("hips"), j.air, Math.PI / 2);
      for (const cloud of this.clouds) cloud.update(doll.socket("hips"), j.air * 0.4, Math.PI / 2);
    }
  }

  /** The sneeze that throws the doll: the dragon rears its head, opens its mouth and puffs. */
  private sneezeNow(sb: SilverboltActor): void {
    const marks = this.marks;
    this.sneeze = this.time + 0.35;
    sb.react("shake", 1.5);
    sb.blink();
    if (!marks) return;
    const size = Math.max(60, this.journey.dragonHeight * 0.4);
    marks.emit("steam", { at: sb.socket("snout"), rotation: this.journey.heading, size, count: 6 });
    marks.emit("poof", { at: sb.socket("headTop"), size: size * 1.1 });
    marks.emit("bang", {
      at: sb.socket("headTop"),
      size: size * 1.1,
      offset: { x: 0, y: size * 0.9 },
    });
  }

  private driveDoll(
    doll: DollActor,
    sb: SilverboltActor | null,
    j: Journey,
    t: number,
    threw: boolean,
    jumped: boolean,
    w: number,
    h: number,
  ): void {
    if (j.dollMode === "hidden") {
      doll.visible = false;
      this.offsetOn = false;
      return;
    }
    doll.visible = true;
    doll.onReact = this.onDollReact;
    doll.reset();
    doll.blinkAuto(true);
    const pointer = this.ctx.pointer.state;
    if (pointer.inside && j.dollMode === "ride" && j.hover > 0.3) {
      this.gaze.x = pointer.x - w / 2;
      this.gaze.y = h / 2 - pointer.y;
      doll.look(this.gaze);
    }

    if (j.dollMode === "ride") {
      if (!sb) {
        doll.visible = false;
        return;
      }
      const seat = sb.socket("headTop");
      if (doll.parentSocket !== seat) doll.attach(seat, { keepWorld: false });
      this.offsetOn = false;
      const hh = j.dollHeight;
      const seatPlace = this.dollPlace;
      seatPlace.x = SEAT.x * hh;
      seatPlace.y = SEAT.y * hh;
      seatPlace.z = SEAT.z * hh;
      seatPlace.height = hh;
      seatPlace.yaw = SEAT.yaw;
      seatPlace.pitch = SEAT.pitch;
      seatPlace.roll = SEAT.roll;
      seatPlace.pivot = "hips";
      doll.place(seatPlace);
      doll.setPose(j.poseA, j.poseB, j.poseW);
      doll.talk(j.talk);
      this.rideFace(doll, sb, j, t);
      return;
    }

    // Free: placed in the screen, and the camera of the fall zooms on her.
    if (doll.parentSocket) {
      if (!jumped && !threw) {
        // Not a throw and not a jump (a slow scroll that arrived after the throw): no seam to hide.
        doll.detach();
      } else if (threw) {
        doll.markPoint("hips", this.point);
        doll.detach();
        this.offset.x = this.point.x - j.dollX;
        this.offset.y = this.point.y - j.dollY;
        this.offsetOn = true;
      } else {
        doll.detach();
      }
    }
    // The seam fades over a third of a screen of scroll.
    const k = this.offsetOn ? clamp01(1 - (t - BEAT.launch) / 0.35) : 0;
    if (k <= 0) this.offsetOn = false;
    // She bobs a little as she falls, and holds still at the end (joint J6).
    const bob =
      Math.sin(this.time * 1.7) *
      0.01 *
      h *
      clamp01(j.dollHeight / (0.3 * j.ref) - 0.6) *
      (1 - j.settle);
    const free = this.dollPlace;
    free.x = j.dollX + this.offset.x * k;
    free.y = j.dollY + this.offset.y * k + bob;
    free.z = 60;
    free.height = j.dollHeight;
    free.yaw = j.dollYaw;
    free.pitch = j.dollPitch;
    free.roll = j.dollRoll;
    free.pivot = "hips";
    doll.place(free);
    doll.setPose(j.poseA, j.poseB, j.poseW);
    doll.flail(j.flail, j.flailRate);
    doll.talk(j.talk);
    doll.mood(FALL_MOODS, j.moodT);
  }

  /** The face of a doll that rides: by the beats of the ride, and startled when the dragon is. */
  private rideFace(doll: DollActor, sb: SilverboltActor, j: Journey, t: number): void {
    if (this.time < this.startleUntil) {
      doll.faceTo(this.startleFace, 0.12);
    } else if (sb.annoyed && j.hover > 0.2) {
      doll.faceTo("worried", 0.2);
    } else {
      doll.faceTo(rideFaceAt(j, t), 0.2);
    }
  }
}

/** The face the ride calls for at `t` (the wheel's pair, the roll, the rearing). */
function rideFaceAt(j: Journey, t: number): FaceName {
  if (j.dwellFace) return j.dwellFace;
  if (t < BEAT.rollFrom) return "laughing";
  if (t < BEAT.arrive - 0.15) return "scream";
  if (t < BEAT.arrive + 0.15) return "dizzy";
  if (t < BEAT.launch - 0.12) return "worried";
  return "shocked";
}
