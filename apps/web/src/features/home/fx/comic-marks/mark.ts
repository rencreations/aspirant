import type { Camera, Object3D } from "three";

/** Floats per instance in the buffer the shader reads (five vec4). */
export const STRIDE = 20;

/** A place a mark can stand on or follow: a point in the stage's pixels, or a 3D object. */
export type Anchor = { x: number; y: number } | Object3D;

export function isObject3D(a: Anchor): a is Object3D {
  return (a as Object3D).isObject3D === true;
}

/**
 * A live anchor shared by the marks of one call. `x` and `y` are where it is this frame in the
 * stage's pixel frame (origin in the middle, y up), already including `offX` and `offY`.
 */
export class AnchorRef {
  object: Object3D | null = null;
  point: { x: number; y: number } | null = null;
  camera: Camera | null = null;
  offX = 0;
  offY = 0;
  x = 0;
  y = 0;
  /** False when the anchor is behind the camera: its marks are not drawn that frame. */
  visible = true;
  /** The frame this was last resolved in. */
  stamp = -1;

  set(anchor: Anchor, camera: Camera | null, offX: number, offY: number): void {
    if (isObject3D(anchor)) {
      this.object = anchor;
      this.point = null;
    } else {
      this.object = null;
      this.point = anchor;
    }
    this.camera = camera;
    this.offX = offX;
    this.offY = offY;
    this.stamp = -1;
    this.visible = true;
  }
}

/** Turns an anchor that is a 3D object into pixels. Provided by the actor (it knows the cameras). */
export interface Projector {
  project(ref: AnchorRef): void;
}

/** One drawn shape: the unit the shader draws and the sim moves. All numbers are plain, no objects. */
export class Mark {
  alive = false;
  /** Bumped when the mark is handed out again, so a holder can tell it was recycled. */
  serial = 0;
  layer = 1;
  ref: AnchorRef | null = null;
  /** The base position when there is no anchor to follow. */
  bx = 0;
  by = 0;
  /** The offset from the base or the anchor, moved by the mark's own motion. */
  ox = 0;
  oy = 0;
  vx = 0;
  vy = 0;
  gx = 0;
  gy = 0;
  drag = 0;
  rot = 0;
  spin = 0;
  sway = 0;
  swayHz = 0;
  swayPhase = 0;
  /** An orbit around the base: replaces the free motion. */
  orbit = false;
  orbPhase = 0;
  orbSpeed = 0;
  orbRx = 0;
  orbRy = 0;
  orbTilt = 0;
  prim = 0;
  size = 40;
  aspect = 1;
  param = 0;
  variant = 0;
  seed = 0;
  fr = 1;
  fg = 1;
  fb = 1;
  ar = 1;
  ag = 1;
  ab = 1;
  /** The outline in CSS pixels, or 0 for the shader's own (it grows with the size). */
  outline = 0;
  age = 0;
  life = 1;
  popT = 0.16;
  fadeT = 0.3;
  overshoot = 1.7;
  squash = 0.2;
  held = false;
  /** Extra scale a second, for puffs that swell. */
  grow = 0;
  throb = 0;
  throbHz = 0;
  wobble = 0;
  wobbleHz = 0;
  /** Scale by depth for an orbit (the far side is smaller): 0 is none. */
  depth = 0;

  reset(): void {
    this.ref = null;
    this.bx = this.by = this.ox = this.oy = 0;
    this.vx = this.vy = this.gx = this.gy = this.drag = 0;
    this.rot = this.spin = 0;
    this.sway = this.swayHz = this.swayPhase = 0;
    this.orbit = false;
    this.orbPhase = this.orbSpeed = this.orbRx = this.orbRy = this.orbTilt = 0;
    this.prim = 0;
    this.size = 40;
    this.aspect = 1;
    this.param = 0;
    this.variant = 0;
    this.seed = 0;
    this.fr = this.fg = this.fb = 1;
    this.ar = this.ag = this.ab = 1;
    this.outline = 0;
    this.age = 0;
    this.life = 1;
    this.popT = 0.16;
    this.fadeT = 0.3;
    this.overshoot = 1.7;
    this.squash = 0.2;
    this.held = false;
    this.grow = 0;
    this.throb = this.throbHz = 0;
    this.wobble = this.wobbleHz = 0;
    this.depth = 0;
  }
}

/**
 * A fixed set of marks, drawn in three layers (behind, middle, front) and inside a layer in the
 * order they were made, so the newest is on top. Nothing is allocated after the constructor.
 */
export class MarkPool {
  private readonly free: Mark[] = [];
  /** The live marks per layer, oldest first. */
  readonly layers: [Mark[], Mark[], Mark[]] = [[], [], []];

  constructor(readonly capacity: number) {
    for (let i = capacity - 1; i >= 0; i--) this.free.push(new Mark());
  }

  get live(): number {
    return this.layers[0].length + this.layers[1].length + this.layers[2].length;
  }

  /**
   * A fresh mark in `layer`. When the pool is full the oldest mark of the furthest back layer is
   * recycled: a burst that is too big loses its oldest parts, it never throws.
   */
  acquire(layer: 0 | 1 | 2): Mark {
    let m = this.free.pop();
    if (!m) {
      const donor = this.layers.find((list) => list.length > 0);
      m = donor?.shift();
      if (!m) throw new Error("mark pool of zero capacity");
    }
    m.reset();
    m.alive = true;
    m.serial += 1;
    m.layer = layer;
    this.layers[layer].push(m);
    return m;
  }

  /** Take dead marks out of every layer in place (order kept) and give them back. */
  sweep(): void {
    for (const list of this.layers) {
      let w = 0;
      for (const m of list) {
        if (m.alive) list[w++] = m;
        else this.free.push(m);
      }
      list.length = w;
    }
  }

  clear(): void {
    for (const list of this.layers) {
      for (const m of list) {
        m.alive = false;
        this.free.push(m);
      }
      list.length = 0;
    }
  }
}
