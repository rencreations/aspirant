import type { Camera } from "three";

import { AnchorRef, type Anchor, type Projector } from "../comic-marks/mark";
import { writeColor, type MarkColor } from "../comic-marks/palette";
import { TrailHistory } from "./ring";
import { CAP_PAIRS, VERTEX_FLOATS, writeRibbon, type RibbonStyle } from "./ribbon";

export interface TrailOptions {
  /** The gradient from the head to the tail. Default gold, then pink. */
  colors?: readonly MarkColor[];
  /** The width at the head in CSS pixels. Default 16. */
  width?: number;
  /** Seconds a point lives, so how long the tail is at a given speed. Default 0.6. */
  life?: number;
  /** The same as `life` (the name the request used): `life` wins when both are given. */
  length?: number;
  /** How the width falls off along the tail: 1 is a straight taper, above 1 is fatter near the head. Default 1. */
  taper?: number;
  /** The exponent of the opacity falloff. Default 1.2. */
  fade?: number;
  /** The most opaque it gets, 0 to 1. Default 0.9. */
  alpha?: number;
  /** A point is remembered when the anchor has moved this far (pixels). Default 3. */
  minDist?: number;
  /** A step of the anchor bigger than this in one frame is a jump: the tail is cut. Default 360. */
  jump?: number;
  /** The camera that turns a 3D object into pixels. Default: the pass its scene is drawn by. */
  camera?: Camera;
}

/** How many trails can be drawn at once. Each remembers `TRAIL_POINTS` points. */
export const TRAIL_SLOTS = 12;
const TRAIL_POINTS = 40;
/** Vertex pairs a slot owns: the round cap, the live head and the remembered points. */
export const SLOT_PAIRS = TRAIL_POINTS + 1 + CAP_PAIRS;
const SLOT_FLOATS = SLOT_PAIRS * 2 * VERTEX_FLOATS;

const DEFAULTS = {
  width: 16,
  life: 0.6,
  taper: 1,
  fade: 1.2,
  alpha: 0.9,
  minDist: 3,
  jump: 360,
};

/** The memory and the colours of one running trail, held by a slot while it has anything to show. */
class Slot {
  active = false;
  handle: TrailHandle | null = null;
  readonly history = new TrailHistory(TRAIL_POINTS);
  readonly head = { x: 0, y: 0 };
  hasHead = false;
  /** The last head, to tell a jump. */
  prevX = 0;
  prevY = 0;
  hasPrev = false;
  /** The time the last point was remembered. */
  lastPush = -Infinity;
}

/**
 * One trail as a section sees it. Make it once (`trails.create`), call `track` every frame it should
 * be followed, and forget it: it takes a slot while it has something to draw and gives it back when
 * the tail has faded. A frame without `track` leaves the tail where it was and lets it dissolve.
 */
export class TrailHandle {
  /** The width at the head, in pixels. Change it any time. */
  width: number;
  life: number;
  taper: number;
  fade: number;
  alpha: number;
  minDist: number;
  jump: number;
  readonly stops: Float32Array;
  readonly anchor = new AnchorRef();
  tracked = false;
  /** The index of the slot this trail holds, or -1. */
  slot = -1;
  /** A cut asked for: the tail is forgotten at the next step. */
  cutPending = false;
  camera: Camera | null;

  constructor(
    private readonly system: TrailSystem,
    options: TrailOptions,
  ) {
    this.width = options.width ?? DEFAULTS.width;
    this.life = options.life ?? options.length ?? DEFAULTS.life;
    this.taper = options.taper ?? DEFAULTS.taper;
    this.fade = options.fade ?? DEFAULTS.fade;
    this.alpha = options.alpha ?? DEFAULTS.alpha;
    this.minDist = options.minDist ?? DEFAULTS.minDist;
    this.jump = options.jump ?? DEFAULTS.jump;
    this.camera = options.camera ?? null;
    const colors = options.colors ?? ["gold", "pink"];
    this.stops = new Float32Array(Math.max(1, colors.length) * 3);
    this.stops.fill(1);
    colors.forEach((c, i) => {
      writeColor(c, this.stops, i * 3);
    });
  }

  /**
   * Follow `anchor` this frame: a point in the stage's pixels or a 3D object, plus an offset in
   * pixels. Call it every frame the trail should run.
   */
  track(anchor: Anchor, offsetX = 0, offsetY = 0): void {
    this.system.touch(this, anchor, offsetX, offsetY);
  }

  /** Forget the tail now (the anchor was moved on purpose to somewhere else). */
  cut(): void {
    this.cutPending = true;
  }

  /** True while the trail has anything on the screen. */
  get live(): boolean {
    return this.slot >= 0;
  }
}

/**
 * The simulation of every trail. It owns no GPU object and imports no three code but types: it
 * writes the vertices of every ribbon into `data` (`SLOT_FLOATS` a slot), and the actor uploads it.
 * `step(dt)` follows the anchors, remembers points, drops old ones and rebuilds the strips; call it
 * once a frame as late as possible.
 */
export class TrailSystem {
  readonly data = new Float32Array(TRAIL_SLOTS * SLOT_FLOATS);
  /** One past the highest slot in use, for the draw range. */
  used = 0;
  time = 0;
  private readonly slots: Slot[] = [];
  private readonly style: RibbonStyle = {
    width: 1,
    taper: 1,
    fade: 1,
    alpha: 1,
    life: 1,
    stops: new Float32Array(3),
  };

  constructor(private readonly projector: Projector) {
    for (let i = 0; i < TRAIL_SLOTS; i++) this.slots.push(new Slot());
  }

  create(options: TrailOptions = {}): TrailHandle {
    return new TrailHandle(this, options);
  }

  /** Trails that hold a slot: the pass is drawn while this is above zero. */
  get active(): number {
    let n = 0;
    for (const s of this.slots) if (s.active) n++;
    return n;
  }

  /** Used by a handle. */
  touch(handle: TrailHandle, anchor: Anchor, offX: number, offY: number): void {
    handle.anchor.set(anchor, handle.camera, offX, offY);
    handle.tracked = true;
    if (handle.slot < 0) {
      const at = this.slots.findIndex((s) => !s.active);
      if (at < 0) return;
      const free = this.slots[at]!;
      free.active = true;
      free.handle = handle;
      free.history.reset();
      free.hasHead = false;
      free.hasPrev = false;
      free.lastPush = -Infinity;
      handle.slot = at;
    }
  }

  /** How many points a trail remembers behind its head (a debugging and test aid). */
  remembered(handle: TrailHandle): number {
    return handle.slot < 0 ? 0 : this.slots[handle.slot]!.history.length;
  }

  clear(): void {
    for (const s of this.slots) this.free(s);
    this.used = 0;
  }

  step(dt: number): void {
    if (dt > 0) this.time += dt;
    const now = this.time;
    let used = 0;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]!;
      const h = s.handle;
      if (!s.active || !h) continue;
      this.stepSlot(s, h, i, dt, now);
      if (s.active) used = i + 1;
    }
    this.used = used;
  }

  private stepSlot(s: Slot, h: TrailHandle, index: number, dt: number, now: number): void {
    if (h.cutPending) {
      s.history.reset();
      s.hasPrev = false;
      h.cutPending = false;
    }
    s.hasHead = false;
    if (h.tracked) {
      const ref = h.anchor;
      this.resolve(ref);
      if (ref.visible) {
        const x = ref.x;
        const y = ref.y;
        if (s.hasPrev && Math.hypot(x - s.prevX, y - s.prevY) > h.jump) {
          s.history.reset();
        }
        s.head.x = x;
        s.head.y = y;
        s.hasHead = true;
        s.prevX = x;
        s.prevY = y;
        s.hasPrev = true;
        if (dt > 0 && now - s.lastPush >= h.life / (TRAIL_POINTS - 2)) {
          const n = s.history.length;
          const k = s.history.newest(0);
          const far = n === 0 || Math.hypot(x - s.history.x[k]!, y - s.history.y[k]!) >= h.minDist;
          if (far) {
            s.history.push(x, y, now);
            s.lastPush = now;
          }
        }
      } else {
        // Behind the camera or hidden: the tail is left to dissolve, and the next place is a new start.
        s.hasPrev = false;
      }
    } else {
      s.hasPrev = false;
    }
    h.tracked = false;
    if (dt > 0) s.history.dropBefore(now - h.life);
    if (!s.hasHead && s.history.length === 0) {
      this.free(s);
      return;
    }
    const style = this.style;
    style.width = h.width;
    style.taper = h.taper;
    style.fade = h.fade;
    style.alpha = h.alpha;
    style.life = h.life;
    style.stops = h.stops;
    writeRibbon(
      this.data,
      index * SLOT_FLOATS,
      SLOT_PAIRS,
      s.hasHead ? s.head : null,
      s.history,
      now,
      style,
    );
  }

  private resolve(ref: AnchorRef): void {
    if (ref.object) {
      this.projector.project(ref);
    } else if (ref.point) {
      ref.x = ref.point.x + ref.offX;
      ref.y = ref.point.y + ref.offY;
      ref.visible = true;
    }
  }

  private free(s: Slot): void {
    if (s.handle) s.handle.slot = -1;
    s.handle = null;
    s.active = false;
    s.history.reset();
    const at = this.slots.indexOf(s) * SLOT_FLOATS;
    this.data.fill(0, at, at + SLOT_FLOATS);
  }
}
