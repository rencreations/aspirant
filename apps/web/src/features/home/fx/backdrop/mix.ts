/**
 * The cross-fade of the backdrop, as pure arithmetic. Two things move:
 *
 *  - the layers: when a section asks for another kind, the new one comes in over `FADE_S` and the
 *    others give way, their weights always summing to 1 (the canvas is drawn as
 *    `old * (1 - t) + new * t` in premultiplied colour, a true linear cross-fade with no dip);
 *  - the presence: the whole backdrop fades in when a section wants it and out when no section does.
 *
 * A kind that arrives in the middle of a fade takes the share the others had; at most `MAX_LAYERS`
 * are kept (the weakest of the others is dropped). Nothing here touches the DOM or three.
 */

/** Seconds a cross-fade, a fade in or a fade out takes. */
export const FADE_S = 0.5;
/** Most layers drawn at once. A fourth arrival drops the weakest of the others. */
export const MAX_LAYERS = 3;
/** Under this a weight is zero and the layer is dropped. */
const EPS = 0.001;

/** Smooth in, smooth out: the curve of every fade (0 to 1). */
export function easeFade(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** The inverse of `easeFade`, so a layer that comes back mid-fade carries on from where it was. */
function invEase(y: number): number {
  const v = Math.min(1, Math.max(0, y));
  return 0.5 - Math.sin(Math.asin(1 - 2 * v) / 3);
}

export interface FadeLayer<K extends string> {
  readonly kind: K;
  /** The weight this layer is drawn with, 0 to 1. All layers sum to 1. */
  w: number;
  /** For a layer that is giving way: its share of what the top layer leaves (shares sum to 1). */
  share: number;
  /** Progress of the top layer's fade in (linear, 0 to 1). Meaningless for the others. */
  p: number;
}

export class FadeMix<K extends string> {
  /** Oldest first, the layer that is coming in (or stands) last. */
  readonly layers: Array<FadeLayer<K>> = [];
  /** Linear progress of the whole backdrop's fade, 0 (hidden) to 1 (shown). */
  presence = 0;

  /** The eased weight of the whole backdrop. Multiply every layer's weight by it. */
  master(): number {
    return easeFade(this.presence);
  }

  /** The draw-skip rule: nothing is drawn (and the canvas is hidden) when this is false. */
  active(): boolean {
    return this.presence > EPS && this.layers.length > 0;
  }

  top(): FadeLayer<K> | undefined {
    return this.layers[this.layers.length - 1];
  }

  /**
   * One step. `want` is the kind a section asked for this frame, or null when none did. `snap` puts
   * the end state in at once (a jump of the scroll, a probe).
   */
  step(dt: number, want: K | null, snap = false): void {
    if (snap) {
      this.layers.length = 0;
      if (want !== null) {
        this.layers.push({ kind: want, w: 1, share: 1, p: 1 });
        this.presence = 1;
      } else {
        this.presence = 0;
      }
      return;
    }
    const d = dt > 0 ? dt / FADE_S : 0;
    if (want === null) {
      this.presence = Math.max(0, this.presence - d);
    } else {
      // Nothing of the old one is left to cross with: start fresh.
      if (this.presence <= EPS) this.layers.length = 0;
      this.presence = Math.min(1, this.presence + d);
      const top = this.top();
      if (!top) this.layers.push({ kind: want, w: 1, share: 1, p: 1 });
      else if (top.kind !== want) this.push(want);
    }
    this.advance(d);
  }

  private push(kind: K): void {
    const at = this.layers.findIndex((l) => l.kind === kind);
    if (at >= 0) {
      // Back to a kind that is still fading out: carry on from its weight.
      const [back] = this.layers.splice(at, 1);
      const others = this.layers.reduce((sum, l) => sum + l.w, 0);
      for (const l of this.layers) l.share = others > EPS ? l.w / others : 1;
      back!.p = invEase(back!.w);
      this.layers.push(back!);
      return;
    }
    for (const l of this.layers) l.share = l.w;
    this.layers.push({ kind, w: 0, share: 0, p: 0 });
    while (this.layers.length > MAX_LAYERS) {
      let weakest = 0;
      for (let i = 1; i < this.layers.length - 1; i++) {
        if (this.layers[i]!.share < this.layers[weakest]!.share) weakest = i;
      }
      this.layers.splice(weakest, 1);
      const sum = this.layers.slice(0, -1).reduce((s, l) => s + l.share, 0);
      for (let i = 0; i < this.layers.length - 1; i++) {
        const l = this.layers[i]!;
        l.share = sum > EPS ? l.share / sum : 1;
      }
    }
  }

  private advance(d: number): void {
    const top = this.top();
    if (!top) return;
    top.p = Math.min(1, top.p + d);
    top.w = easeFade(top.p);
    const left = 1 - top.w;
    for (let i = 0; i < this.layers.length - 1; i++) {
      const l = this.layers[i]!;
      l.w = l.share * left;
    }
    if (top.p >= 1) {
      this.layers.splice(0, this.layers.length - 1);
      top.w = 1;
      top.share = 1;
    } else {
      for (let i = this.layers.length - 2; i >= 0; i--) {
        if (this.layers[i]!.w < EPS) this.layers.splice(i, 1);
      }
    }
  }
}
