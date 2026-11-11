import {
  clipLayers,
  cubicBezier,
  place,
  windowFrames,
  type Easing,
} from "@/features/story/morph/morph-math";

import {
  FLAT,
  frameBox,
  frameTransform,
  fullWindow,
  offsetOf,
  placement,
  ringContent,
  visibility,
  wholeFrame,
  wrapOffset,
  type RingGeometry,
} from "./ring";

/** The elements of one panel the driver moves, and the point of its picture that stays in view. */
export interface PanelEls {
  /** The box the size of the screen that carries the 3D placement and the fade. */
  panel: HTMLElement;
  /** Darkens a panel that shows its back. */
  dim: HTMLElement;
  /** The window: two clips that only translate, the counter layer and the picture. */
  outer: HTMLElement;
  inner: HTMLElement;
  counter: HTMLElement;
  content: HTMLElement;
  /** The splash art under the stage. */
  splash: HTMLElement;
  /** The box of the stage, the recording's own shape: it covers the screen, or shows whole. */
  frame: HTMLElement;
  /** Holds the live stage: it fades while the ring turns away from it. */
  live: HTMLElement;
  /** The point of the recording kept in view, 0 to 1 from the left. */
  focus: number;
}

const wholeEase = cubicBezier(0.65, 0, 0.2, 1);

/** How dark a panel is: the back of the ring shows the backs of the panels, in shade. */
function dimOf(offset: number): number {
  const a = Math.abs(offset);
  return Math.min(0.62, Math.max(0, ((a - 1.15) / 0.5) * 0.62));
}

const stepEase = cubicBezier(0.45, 0, 0.55, 1);
/** The launch and the way back: slow out of the ring, a long settle into place. */
export const MORPH_MS = 1150;
const morphEase = cubicBezier(0.72, 0, 0.18, 1);

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const translate = (p: { x: number; y: number }) => `translate(${px(p.x)}, ${px(p.y)})`;

interface Motion {
  from: number;
  to: number;
  ms: number;
  ease: Easing;
  anims: Animation[];
  done: Promise<boolean>;
}

/**
 * Places the panels on the ring and moves them. Nothing here touches React: the page gives it the
 * elements and calls it. A turn of the ring is a set of Web Animations (the compositor runs them),
 * a drag writes the transforms directly, and the launch and the way back animate one panel's
 * placement to flat while its window opens to the screen (or the other way).
 */
export class RingDriver {
  private els = new Map<number, PanelEls>();
  private g: RingGeometry | null = null;
  private motion: Motion | null = null;
  /** The panel that is the full screen view, or null on the ring. */
  private fullIndex: number | null = null;
  private morphing: Animation[] = [];
  /** The panel that shows its whole frame (Whole frame), or null. */
  private wholeIndex: number | null = null;
  private wholeAnims: Animation[] = [];
  private liveAnims = new Map<number, Animation>();
  /** Where the ring stands (the panel in front, a fraction while it turns), in [0, count). */
  p = 0;

  constructor(private readonly count: number) {}

  attach(index: number, els: PanelEls | null) {
    if (els) {
      this.els.set(index, els);
      if (this.g) this.layoutPanel(index, els);
    } else {
      this.els.delete(index);
    }
  }

  get geometry(): RingGeometry | null {
    return this.g;
  }

  /** The screen changed size: everything is placed again. */
  setGeometry(g: RingGeometry) {
    this.g = g;
    const p = this.halt();
    for (const [i, els] of this.els) this.layoutPanel(i, els);
    this.write(p);
  }

  private layoutPanel(index: number, els: PanelEls) {
    const g = this.g;
    if (!g) return;
    const full = this.fullIndex === index;
    const { win, content } = full ? fullWindow(g) : { win: g.win, content: ringContent(g) };
    const layers = clipLayers(win, content, g.view);
    els.outer.style.transform = translate(layers.outer);
    els.inner.style.transform = translate(layers.inner);
    els.counter.style.transform = translate(layers.counter);
    els.content.style.transform = place(layers.content);
    // The stage's box is set once per screen size (no motion), its whole frame by a transform.
    const box = frameBox(g.view, els.focus);
    els.frame.style.left = px(box.x);
    els.frame.style.top = px(box.y);
    els.frame.style.width = px(box.w);
    els.frame.style.height = px(box.h);
    const whole = this.wholeIndex === index;
    els.frame.style.transform = frameTransform(whole ? wholeFrame(g.view, box) : null);
    els.splash.style.opacity = whole ? "0" : "1";
  }

  /**
   * Whole frame on or off for a panel: the recording moves from covering the screen to fitting it
   * whole, centred, with black above and below (or back). One transform on the stage's box, and
   * the splash under it fades, so the bands are plain black.
   */
  whole(index: number, on: boolean, ms = 520) {
    const g = this.g;
    const els = this.els.get(index);
    if (!g || !els) return;
    if (on === (this.wholeIndex === index) && ms > 0) return;
    const fromFrame = getComputedStyle(els.frame).transform;
    const fromSplash = getComputedStyle(els.splash).opacity;
    for (const a of this.wholeAnims) a.cancel();
    this.wholeAnims = [];
    if (on) this.wholeIndex = index;
    else if (this.wholeIndex === index) this.wholeIndex = null;
    const box = frameBox(g.view, els.focus);
    const to = frameTransform(on ? wholeFrame(g.view, box) : null);
    els.frame.style.transform = to;
    els.splash.style.opacity = on ? "0" : "1";
    if (ms <= 0) return;
    const timing: KeyframeAnimationOptions = { duration: ms, easing: wholeEase.css };
    this.wholeAnims = [
      els.frame.animate(
        [{ transform: fromFrame === "none" ? frameTransform(null) : fromFrame }, { transform: to }],
        timing,
      ),
      els.splash.animate([{ opacity: fromSplash }, { opacity: on ? 0 : 1 }], timing),
    ];
  }

  get wholeOn(): number | null {
    return this.wholeIndex;
  }

  /**
   * Show or hide the live stage of a panel over its splash: it fades out while the ring turns away
   * from it, so the panel that leaves the front ends on its splash without a cut.
   */
  fadeLive(index: number, on: boolean, ms: number) {
    const els = this.els.get(index);
    if (!els) return;
    const from = getComputedStyle(els.live).opacity;
    this.liveAnims.get(index)?.cancel();
    this.liveAnims.delete(index);
    const to = on ? "1" : "0";
    els.live.style.opacity = to;
    if (ms <= 0 || from === to) return;
    this.liveAnims.set(
      index,
      els.live.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: "ease" }),
    );
  }

  /** Put every panel where it stands for the ring at `p`, at once. */
  write(p: number) {
    this.p = ((p % this.count) + this.count) % this.count;
    const g = this.g;
    if (!g) return;
    for (const [i, els] of this.els) {
      if (this.fullIndex === i) continue;
      const o = offsetOf(i, this.p, this.count);
      els.panel.style.transform = placement(g, o);
      els.panel.style.opacity = this.fullIndex === null ? String(visibility(o)) : "0";
      els.dim.style.opacity = String(dimOf(o));
    }
  }

  /** The ring's position now, also in the middle of a turn. */
  current(): number {
    const m = this.motion;
    if (!m) return this.p;
    const t = m.anims[0]?.currentTime;
    const time = typeof t === "number" ? t : 0;
    const k = m.ease(Math.min(1, Math.max(0, time / m.ms)));
    return m.from + (m.to - m.from) * k;
  }

  /** True while a turn of the ring runs (a glide, not a drag). */
  get moving(): boolean {
    return this.motion !== null;
  }

  /** Stop any turn where it is, keep that position, and return it. */
  halt(): number {
    const m = this.motion;
    if (!m) return this.p;
    const at = this.current();
    this.motion = null;
    for (const a of m.anims) a.cancel();
    this.write(at);
    return this.p;
  }

  /** Turn the ring from where it is to `to` (any real number, the turn takes the short way). */
  glide(to: number, ms: number, ease: Easing = stepEase): Promise<boolean> {
    return this.run(to, ms, ease);
  }

  private run(to: number, ms: number, ease: Easing): Promise<boolean> {
    const g = this.g;
    const from = this.halt();
    // Take the short way round: `to` is moved by whole turns to be near `from`.
    const target = from + wrapOffset(to - from, this.count);
    if (!g || ms <= 0 || Math.abs(target - from) < 1e-4) {
      this.write(target);
      return Promise.resolve(true);
    }
    const anims: Animation[] = [];
    const SAMPLES = 12;
    for (const [i, els] of this.els) {
      if (this.fullIndex === i) continue;
      const o0 = offsetOf(i, from, this.count);
      const panel: Keyframe[] = [];
      const dim: Keyframe[] = [];
      for (let k = 0; k <= SAMPLES; k += 1) {
        const q = k / SAMPLES;
        // Unwrapped, so a panel never jumps from one side of the ring to the other mid turn.
        const o = o0 - (target - from) * q;
        panel.push({ offset: q, transform: placement(g, o), opacity: visibility(o) });
        dim.push({ offset: q, opacity: dimOf(o) });
      }
      const timing: KeyframeAnimationOptions = { duration: ms, easing: ease.css, fill: "forwards" };
      anims.push(els.panel.animate(panel, timing), els.dim.animate(dim, timing));
    }
    const motion: Motion = { from, to: target, ms, ease, anims, done: Promise.resolve(false) };
    motion.done = Promise.all(anims.map((a) => a.finished)).then(
      () => {
        if (this.motion !== motion) return false;
        this.motion = null;
        this.write(target);
        for (const a of anims) a.cancel();
        return true;
      },
      () => false,
    );
    this.motion = motion;
    return motion.done;
  }

  /** The panel in front is the full screen view, at once (a visit straight to its page). */
  setFull(index: number) {
    this.halt();
    this.cancelMorph();
    this.fullIndex = index;
    const els = this.els.get(index);
    this.write(index);
    if (!els) return;
    els.panel.style.transform = FLAT;
    els.panel.style.opacity = "1";
    els.dim.style.opacity = "0";
    this.layoutPanel(index, els);
    for (const [i, other] of this.els) if (i !== index) other.panel.style.opacity = "0";
  }

  /** A visit straight to a full screen page: the view waits hidden, then fades in, plainly. */
  hide(index: number) {
    const els = this.els.get(index);
    if (els) els.panel.style.opacity = "0";
  }

  fadeIn(index: number) {
    const els = this.els.get(index);
    if (!els) return;
    els.panel.style.opacity = "1";
    els.panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: "ease-out" });
  }

  /** Back on the ring at once, `index` in front (a way back that could not run as a move). */
  setRing(index: number) {
    this.cancelMorph();
    const was = this.fullIndex;
    this.fullIndex = null;
    if (was !== null) {
      const els = this.els.get(was);
      if (els) this.layoutPanel(was, els);
    }
    this.write(index);
  }

  get full(): number | null {
    return this.fullIndex;
  }

  private cancelMorph() {
    for (const a of this.morphing) a.cancel();
    this.morphing = [];
  }

  /**
   * The launch: the panel in front leaves the ring and lies flat on the screen while its window
   * opens to the full screen, the picture growing to its full size. The other panels fade.
   * Resolves when it is done (false when something else took over).
   */
  expand(index: number, hold?: (anims: Animation[]) => void): Promise<boolean> {
    return this.morph(index, "out", hold);
  }

  /** The way back: the full screen view closes into its place on the ring. */
  collapse(index: number, hold?: (anims: Animation[]) => void): Promise<boolean> {
    return this.morph(index, "in", hold);
  }

  private morph(
    index: number,
    way: "out" | "in",
    hold?: (anims: Animation[]) => void,
  ): Promise<boolean> {
    const g = this.g;
    const els = this.els.get(index);
    if (!g || !els) return Promise.resolve(false);
    this.cancelMorph();
    // On the way out the ring stops where it is; on the way in it stands on the panel.
    const p = way === "out" ? this.halt() : index;
    if (way === "in") {
      this.fullIndex = index;
      this.write(index);
    }
    const o = offsetOf(index, p, this.count);
    const ring = { win: g.win, content: ringContent(g) };
    const full = fullWindow(g);
    const [a, b] = way === "out" ? [ring, full] : [full, ring];
    const frames = windowFrames(a.win, a.content, b.win, b.content, g.view);
    const onRing = placement(g, o);
    const timing: KeyframeAnimationOptions = {
      duration: MORPH_MS,
      easing: morphEase.css,
      fill: "forwards",
    };
    const anims: Animation[] = [
      els.panel.animate(
        way === "out"
          ? [
              { transform: onRing, opacity: 1 },
              { transform: FLAT, opacity: 1 },
            ]
          : [
              { transform: FLAT, opacity: 1 },
              { transform: onRing, opacity: 1 },
            ],
        timing,
      ),
      els.dim.animate(
        way === "out"
          ? [{ opacity: dimOf(o) }, { opacity: 0 }]
          : [{ opacity: 0 }, { opacity: dimOf(o) }],
        timing,
      ),
      els.outer.animate([{ transform: frames.outer[0] }, { transform: frames.outer[1] }], timing),
      els.inner.animate([{ transform: frames.inner[0] }, { transform: frames.inner[1] }], timing),
      els.counter.animate(
        [{ transform: frames.counter[0] }, { transform: frames.counter[1] }],
        timing,
      ),
      els.content.animate(
        [{ transform: frames.content[0] }, { transform: frames.content[1] }],
        timing,
      ),
    ];
    // The ring around it fades away early on the way out, and comes back late on the way in.
    for (const [i, other] of this.els) {
      if (i === index) continue;
      const v = visibility(offsetOf(i, p, this.count));
      anims.push(
        other.panel.animate(
          way === "out" ? [{ opacity: v }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: v }],
          {
            duration: MORPH_MS * 0.55,
            delay: way === "out" ? 0 : MORPH_MS * 0.45,
            easing: "ease-out",
            fill: "both",
          },
        ),
      );
    }
    this.morphing = anims;
    hold?.(anims);
    return Promise.all(anims.map((x) => x.finished)).then(
      () => {
        if (this.morphing !== anims) return false;
        this.morphing = [];
        if (way === "out") {
          this.fullIndex = index;
          this.write(p);
          els.panel.style.transform = FLAT;
          els.panel.style.opacity = "1";
          els.dim.style.opacity = "0";
          this.layoutPanel(index, els);
          for (const [i, other] of this.els) if (i !== index) other.panel.style.opacity = "0";
        } else {
          this.fullIndex = null;
          this.layoutPanel(index, els);
          this.write(index);
        }
        for (const x of anims) x.cancel();
        return true;
      },
      () => false,
    );
  }

  destroy() {
    this.halt();
    this.cancelMorph();
    for (const a of this.wholeAnims) a.cancel();
    for (const a of this.liveAnims.values()) a.cancel();
    this.wholeAnims = [];
    this.liveAnims.clear();
    this.els.clear();
  }
}
