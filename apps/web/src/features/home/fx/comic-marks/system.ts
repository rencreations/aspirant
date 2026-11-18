import type { Camera } from "three";

import { KIND_INFO, defaultDirection, type MarkKind } from "./kinds";
import {
  AnchorRef,
  MarkPool,
  STRIDE,
  isObject3D,
  type Anchor,
  type Mark,
  type Projector,
} from "./mark";
import { TAU, clamp01, envelopeAt, hash01, type Envelope, type EnvelopeParams } from "./math";
import { writeColor, type MarkColor } from "./palette";
import { Spawn, spawnKind } from "./recipes";

export interface EmitOptions {
  /** Where: a point in the stage's pixels (origin in the middle, y up) or a 3D object. */
  at: Anchor;
  /** The camera that turns a 3D object into pixels. Default: the pass its scene is drawn by. */
  camera?: Camera;
  /** Pixels added to the anchor (screen space, y up). */
  offset?: { x: number; y: number };
  /** The height of the mark in CSS pixels. */
  size?: number;
  color?: MarkColor;
  /** The second colour (the core of a flash, the rays of a bang). */
  accent?: MarkColor;
  /** The tilt in radians, or for `speed` and `air` the direction (a quarter turn is up). */
  rotation?: number;
  /** Seconds. */
  duration?: number;
  count?: number;
  /** The same seed draws the same marks. Default: a counter, so repeats differ and a run is the same. */
  seed?: number;
  /** Stay with the anchor each frame. Default: yes for a 3D object, no for a point. */
  follow?: boolean;
  /** Seconds before the first part shows. */
  delay?: number;
  /**
   * 0 to 1, default 1: how hard it happened. A weak one is smaller (60 percent of the size at 0) and
   * has fewer parts (40 percent at 0). A caller's own size and count are scaled the same way.
   */
  strength?: number;
}

export interface SustainOptions {
  at?: Anchor;
  camera?: Camera;
  offset?: { x: number; y: number };
  size?: number;
  color?: MarkColor;
  accent?: MarkColor;
  /** The direction of `speed` and `air` streaks (a quarter turn is up). Default: up for air, right for speed. */
  direction?: number;
  seed?: number;
}

/** What a loop is, kept by its handle: it takes a slot only while it runs and gets the same one back. */
interface SustainConfig {
  kind: MarkKind;
  size: number;
  mixed: boolean;
  fill: Float32Array;
  accent: Float32Array;
  direction: number;
  hasDirection: boolean;
  seed: number;
  camera: Camera | null;
  offX: number;
  offY: number;
  start: Anchor;
}

/**
 * A loop of marks (a stream of notes, air past a falling doll, dizzy stars). Make it once, in `mount`;
 * set it with `update` every frame it should run; it goes quiet by itself when it is not set, and runs
 * again the next time it is. Like a trail it holds a slot only while it runs, so a handle that is
 * never set, or that was left idle while the visitor was elsewhere, costs nothing and is never dead.
 */
export class SustainHandle {
  /** The slot this handle runs in, or null. The system reads and writes it. */
  slot: SustainSlot | null = null;
  generation = -1;

  constructor(
    private readonly system: MarkSystem,
    readonly config: SustainConfig,
  ) {}

  /** True while the loop runs (it was set within the last 0.12 s and had a free slot). */
  get active(): boolean {
    const s = this.slot;
    return s !== null && s.active && s.generation === this.generation;
  }

  /** Move the loop to `anchor` and set how strong it is (0 is quiet, 1 is the kind's rate). Call it every frame it should run. */
  update(anchor: Anchor, intensity = 1, direction?: number): void {
    this.system.touch(this, anchor, intensity, direction);
  }

  /** End the loop now: what was made finishes by itself, and the handle can be set again later. */
  stop(): void {
    this.system.stopHandle(this);
  }
}

/** The state of one running loop. Pooled: `generation` tells a handle that its slot was reused. */
class SustainSlot {
  active = false;
  generation = 0;
  kind: MarkKind = "air";
  /** A new one for every run: marks that follow it keep following it after the loop has ended. */
  ref = new AnchorRef();
  follow = false;
  size = 60;
  direction = 0;
  hasDirection = false;
  intensity = 1;
  /** Seconds since the caller last set it. */
  idle = 0;
  acc = 0;
  beat = 0;
  seed = 1;
  mixed = true;
  readonly fill = new Float32Array(3);
  readonly accent = new Float32Array(3);
  /** The stars of a dizzy loop. */
  readonly held: Mark[] = [];
  readonly heldSerial: number[] = [];
}

/** A loop the caller stops setting goes quiet after this long. */
export const SUSTAIN_IDLE_S = 0.12;
const MAX_BEATS_PER_STEP = 4;
const SLOTS = 24;

/**
 * The simulation of every mark: a fixed pool, the sustained loops, and the buffer the shader reads
 * (`data`, `STRIDE` floats an instance, `count` of them in use). It owns no GPU object and imports
 * no three code, so all of it is tested in plain functions. `step(dt)` ages everything, moves it,
 * follows the anchors and writes the buffer; call it once a frame, as late as possible (after the
 * actors have moved), then draw `count` instances.
 */
export class MarkSystem {
  readonly pool: MarkPool;
  readonly data: Float32Array;
  count = 0;
  private stamp = 0;
  private seedCounter = 1;
  private readonly spawn: Spawn;
  private readonly slots: SustainSlot[] = [];
  private readonly scratch = new AnchorRef();
  private readonly env: Envelope = { scale: 1, squash: 0, alpha: 1 };
  private readonly envParams: EnvelopeParams = {
    popT: 0,
    fadeT: 0,
    overshoot: 0,
    squash: 0,
    held: false,
  };

  constructor(
    private readonly projector: Projector,
    capacity = 512,
  ) {
    this.pool = new MarkPool(capacity);
    this.data = new Float32Array(capacity * STRIDE);
    this.spawn = new Spawn(this.pool);
    for (let i = 0; i < SLOTS; i++) this.slots.push(new SustainSlot());
  }

  /** Marks alive (including ones waiting for their delay) and loops running: the pass is drawn while it is above zero. */
  get alive(): number {
    return this.pool.live;
  }

  get sustains(): number {
    let n = 0;
    for (const s of this.slots) if (s.active) n++;
    return n;
  }

  /** Fire and forget: put the marks of `kind` at `options.at`. */
  emit(kind: MarkKind, options: EmitOptions): void {
    const info = KIND_INFO[kind];
    const s = this.spawn;
    const follow = options.follow ?? isObject3D(options.at);
    this.scratch.set(
      options.at,
      options.camera ?? null,
      options.offset?.x ?? 0,
      options.offset?.y ?? 0,
    );
    this.resolve(this.scratch);
    if (!this.scratch.visible) return;
    s.kind = kind;
    const k = options.strength === undefined ? 1 : clamp01(options.strength);
    s.size = (options.size ?? info.size) * (0.6 + 0.4 * k);
    s.duration = options.duration ?? info.duration;
    s.count = Math.max(1, Math.round((options.count ?? info.count) * (0.4 + 0.6 * k)));
    s.seed = options.seed ?? this.seedCounter++;
    s.delay = options.delay ?? 0;
    s.hasRot = options.rotation !== undefined;
    s.rot = options.rotation ?? defaultDirection(kind);
    s.mixed = options.color === undefined;
    writeColor(options.color ?? info.color, s.fill, 0);
    writeColor(options.accent ?? info.accent, s.accent, 0);
    if (follow) {
      const ref = new AnchorRef();
      ref.set(options.at, options.camera ?? null, options.offset?.x ?? 0, options.offset?.y ?? 0);
      ref.x = this.scratch.x;
      ref.y = this.scratch.y;
      ref.stamp = this.stamp;
      s.ref = ref;
      s.bx = ref.x;
      s.by = ref.y;
    } else {
      s.ref = null;
      s.bx = this.scratch.x;
      s.by = this.scratch.y;
    }
    spawnKind(s);
  }

  /**
   * Make a loop of `kind` (a stream of notes, air streaks past a falling object, dizzy stars). It
   * takes no slot until the first `update` on the handle, and runs while the caller keeps calling it.
   */
  sustain(kind: MarkKind, options: SustainOptions = {}): SustainHandle {
    const info = KIND_INFO[kind];
    const config: SustainConfig = {
      kind,
      size: options.size ?? info.size,
      mixed: options.color === undefined,
      fill: new Float32Array(3),
      accent: new Float32Array(3),
      direction: options.direction ?? defaultDirection(kind),
      hasDirection: options.direction !== undefined,
      seed: options.seed ?? this.seedCounter++,
      camera: options.camera ?? null,
      offX: options.offset?.x ?? 0,
      offY: options.offset?.y ?? 0,
      start: options.at ?? { x: 0, y: 0 },
    };
    writeColor(options.color ?? info.color, config.fill, 0);
    writeColor(options.accent ?? info.accent, config.accent, 0);
    return new SustainHandle(this, config);
  }

  /** Used by a handle. Takes a free slot when the loop is not running, then sets it. */
  touch(handle: SustainHandle, anchor: Anchor, intensity: number, direction?: number): void {
    const c = handle.config;
    if (direction !== undefined) {
      c.direction = direction;
      c.hasDirection = true;
    }
    if (!handle.active && !this.start(handle)) return;
    const slot = handle.slot!;
    slot.ref.set(anchor, c.camera, c.offX, c.offY);
    slot.intensity = Math.max(0, intensity);
    slot.idle = 0;
    if (direction !== undefined) {
      slot.direction = direction;
      slot.hasDirection = true;
    }
  }

  /** Used by a handle. */
  stopHandle(handle: SustainHandle): void {
    if (handle.active) this.endSustain(handle.slot!);
  }

  /** Put the loop in a free slot. False when every slot is taken (the loop does nothing until one frees). */
  private start(handle: SustainHandle): boolean {
    const slot = this.slots.find((s) => !s.active);
    if (!slot) return false;
    const c = handle.config;
    slot.active = true;
    slot.generation += 1;
    slot.kind = c.kind;
    slot.size = c.size;
    slot.follow = c.kind === "dizzy" ? true : (KIND_INFO[c.kind].sustain?.follow ?? false);
    slot.hasDirection = c.hasDirection;
    slot.direction = c.direction;
    slot.intensity = 1;
    slot.idle = 0;
    slot.acc = 0.999;
    slot.beat = 0;
    slot.seed = c.seed;
    slot.mixed = c.mixed;
    slot.fill.set(c.fill);
    slot.accent.set(c.accent);
    slot.held.length = 0;
    slot.heldSerial.length = 0;
    // A new reference every run: marks that follow it keep following it after the loop has ended.
    slot.ref = new AnchorRef();
    slot.ref.set(c.start, c.camera, c.offX, c.offY);
    handle.slot = slot;
    handle.generation = slot.generation;
    return true;
  }

  /** Marks already made finish; a dizzy loop lets its stars go. The slot is free again. */
  private endSustain(slot: SustainSlot): void {
    for (let i = 0; i < slot.held.length; i++) {
      const m = slot.held[i]!;
      if (m.alive && m.serial === slot.heldSerial[i] && m.held) {
        m.held = false;
        m.life = Math.max(m.age, 0) + m.fadeT;
      }
    }
    slot.held.length = 0;
    slot.heldSerial.length = 0;
    slot.active = false;
  }

  /** Remove everything: marks and loops. */
  clear(): void {
    this.pool.clear();
    for (const s of this.slots) {
      s.active = false;
      s.held.length = 0;
      s.heldSerial.length = 0;
    }
    this.count = 0;
  }

  /** Age and move every mark, run the loops, write the buffer. `dt` in seconds (0 holds still). */
  step(dt: number): void {
    this.stamp += 1;
    if (dt > 0) for (const slot of this.slots) if (slot.active) this.stepSustain(slot, dt);
    let n = 0;
    const d = this.data;
    const env = this.env;
    const ep = this.envParams;
    for (const layer of this.pool.layers) {
      for (const m of layer) {
        if (dt > 0) m.age += dt;
        if (!m.held && m.age >= m.life) {
          m.alive = false;
          continue;
        }
        if (m.age < 0) continue;
        if (dt > 0) this.move(m, dt);
        const ref = m.ref;
        if (ref && ref.stamp !== this.stamp) {
          this.resolve(ref);
          ref.stamp = this.stamp;
        }
        if (ref && !ref.visible) continue;
        let x = (ref ? ref.x : m.bx) + m.ox;
        const y = (ref ? ref.y : m.by) + m.oy;
        if (m.sway !== 0) x += m.sway * Math.sin(TAU * m.swayHz * m.age + m.swayPhase);
        ep.popT = m.popT;
        ep.fadeT = m.fadeT;
        ep.overshoot = m.overshoot;
        ep.squash = m.squash;
        ep.held = m.held;
        envelopeAt(m.age, m.life, ep, env);
        let scale = env.scale;
        if (m.throb !== 0) scale *= 1 + m.throb * Math.sin(TAU * m.throbHz * m.age);
        if (m.grow !== 0) scale *= 1 + m.grow * m.age;
        if (m.depth !== 0) scale *= 1 - m.depth * Math.sin(m.orbPhase);
        const rot =
          m.rot +
          m.spin * m.age +
          (m.wobble !== 0 ? m.wobble * Math.sin(TAU * m.wobbleHz * m.age + (m.seed & 255)) : 0);
        if (env.alpha <= 0.002 || scale <= 0.001) continue;
        const o = n * STRIDE;
        d[o] = x;
        d[o + 1] = y;
        d[o + 2] = m.size;
        d[o + 3] = rot;
        d[o + 4] = scale * (1 + env.squash);
        d[o + 5] = scale * (1 - env.squash);
        d[o + 6] = env.alpha;
        d[o + 7] = m.prim;
        d[o + 8] = m.held ? clamp01(m.age / 2) : clamp01(m.age / m.life);
        d[o + 9] = (m.seed & 0xffff) / 65536;
        d[o + 10] = m.param;
        d[o + 11] = m.aspect;
        d[o + 12] = m.fr;
        d[o + 13] = m.fg;
        d[o + 14] = m.fb;
        d[o + 15] = m.variant;
        d[o + 16] = m.ar;
        d[o + 17] = m.ag;
        d[o + 18] = m.ab;
        d[o + 19] = m.outline;
        n++;
      }
    }
    this.pool.sweep();
    this.count = n;
  }

  private move(m: Mark, dt: number): void {
    if (m.orbit) {
      m.orbPhase += m.orbSpeed * dt;
      m.ox = m.orbRx * Math.cos(m.orbPhase);
      m.oy = m.orbRy * Math.sin(m.orbPhase);
      return;
    }
    m.vx += m.gx * dt;
    m.vy += m.gy * dt;
    if (m.drag !== 0) {
      const k = Math.exp(-m.drag * dt);
      m.vx *= k;
      m.vy *= k;
    }
    m.ox += m.vx * dt;
    m.oy += m.vy * dt;
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

  private stepSustain(slot: SustainSlot, dt: number): void {
    slot.idle += dt;
    if (slot.idle > SUSTAIN_IDLE_S) {
      this.endSustain(slot);
      return;
    }
    if (slot.intensity <= 0) return;
    const info = KIND_INFO[slot.kind];
    const s = this.spawn;
    s.kind = slot.kind;
    s.size = slot.size;
    s.duration = info.duration;
    s.hasRot = slot.hasDirection;
    s.rot = slot.direction;
    s.mixed = slot.mixed;
    s.fill.set(slot.fill);
    s.accent.set(slot.accent);
    s.delay = 0;
    s.ref = null;

    if (slot.kind === "dizzy") {
      if (slot.held.length === 0) {
        this.resolve(slot.ref);
        slot.ref.stamp = this.stamp;
        s.ref = slot.ref;
        s.bx = slot.ref.x;
        s.by = slot.ref.y;
        s.count = info.count;
        s.seed = slot.seed;
        const before = this.pool.layers[1].length;
        spawnKind(s);
        const list = this.pool.layers[1];
        for (let i = before; i < list.length; i++) {
          const m = list[i]!;
          m.held = true;
          slot.held.push(m);
          slot.heldSerial.push(m.serial);
        }
      }
      return;
    }

    slot.acc += (info.sustain?.rate ?? 0) * slot.intensity * dt;
    let beats = 0;
    while (slot.acc >= 1 && beats < MAX_BEATS_PER_STEP) {
      slot.acc -= 1;
      beats++;
      this.resolve(slot.ref);
      slot.ref.stamp = this.stamp;
      if (!slot.ref.visible) continue;
      s.count = 1;
      s.seed = (slot.seed * 7919 + slot.beat++) | 0;
      if (slot.follow) {
        s.ref = slot.ref;
        s.bx = slot.ref.x;
        s.by = slot.ref.y;
      } else {
        s.ref = null;
        s.bx = slot.ref.x;
        s.by = slot.ref.y;
        // A loop that leaves its marks behind spreads them a little, so a stream is not a line of dots.
        s.bx += (hash01(s.seed, 1) - 0.5) * slot.size * 0.3;
        s.by += (hash01(s.seed, 2) - 0.5) * slot.size * 0.2;
      }
      spawnKind(s);
    }
    if (slot.acc > 2) slot.acc = 1;
  }
}
