import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDoll } from "../../actors/doll";
import { ensureSelena } from "../../actors/selena";
import { ensureSilverbolt } from "../../actors/silverbolt";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { ensureMarks } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { ensureCarry } from "../hand/carry";
import { whenIdle } from "../hand/idle";
import { isPortrait } from "../hand/timeline";

import { SelenaScene } from "./scene";
import { STORY } from "./stations";
import { AT, WORD_IN, beatsAt, newBeats, seg, selenaScreens, smooth, type Beats } from "./timeline";

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * Her colours for the aurora behind the room, lightened for the paper (the home is light only): the
 * cyan of her wings, her violet, the pink of her hair and the gold of her hair's ends.
 */
const AURORA = ["#8fe3ff", "#b7a4ff", "#ffa6d6", "#ffd89a"] as const;
/** How strong the aurora is behind the room. The drawer's words stay readable over it. */
const AURORA_AMOUNT = 1;
/**
 * What is left of the list's pastel sky once the aurora is in (the sky is opaque and sits over the
 * backdrop, so it gives way as the aurora comes in and a little of it stays as a haze).
 */
const SKY_LEFT = 0.22;

/**
 * The Selena section: the drawer with its words (DOM), the stars and the white of the way out, and
 * the scene of the three actors. `update` is a pure function of `local` plus the pointer (what the
 * actors do under it is theirs). The drawer, the words and the white work before any actor arrives.
 */
class SelenaRuntime implements SectionRuntime {
  private readonly b: Beats = newBeats();
  readonly scene: SelenaScene;
  private readonly drawer: HTMLElement | null;
  private readonly sky: HTMLElement | null;
  private readonly stars: SVGElement | null;
  private readonly star: SVGElement | null;
  private readonly white: HTMLElement | null;
  private readonly front: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly body: HTMLElement | null;
  private readonly action: HTMLElement | null;
  private disposed = false;
  /** The live backdrop, once the second canvas is made. Never required: the room works without. */
  backdrop: Backdrop | null = null;
  /** The actors have arrived, or have failed for good: the scene is as whole as it will be. */
  built = false;
  /** The aurora's shader is compiled (or the backdrop cannot be had). */
  warmed = false;
  /** The backdrop really draws. Without it the list's dusk sky stays, so the room is never a black void. */
  backdropOn = false;

  constructor(ctx: SectionCtx) {
    this.scene = new SelenaScene(ctx);
    const below = ctx.dom.below;
    const text = ctx.dom.text;
    this.drawer = below.querySelector<HTMLElement>("[data-selena-drawer]");
    this.sky = below.querySelector<HTMLElement>("[data-selena-sky]");
    this.stars = below.querySelector<SVGElement>("[data-selena-stars]");
    this.star = below.querySelector<SVGElement>("[data-selena-star]");
    this.white = below.querySelector<HTMLElement>("[data-selena-white]");
    this.front = text.querySelector<HTMLElement>("[data-selena-front]");
    this.title = text.querySelector<HTMLElement>("[data-selena-title]");
    this.body = text.querySelector<HTMLElement>("[data-selena-body]");
    this.action = text.querySelector<HTMLElement>("[data-selena-action]");
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * The ready gate: a play does not fire on an empty sky. The doll falls, the camera swings and the
   * dragon eats her, so all three must be built, and the aurora's shader compiled so that its first
   * draw does not hitch inside the play.
   */
  ready(): boolean {
    return this.built && this.warmed;
  }

  enter(): void {
    this.scene.enter();
  }

  leave(): void {
    this.scene.leave();
  }

  update(local: number, frame: FrameInfo): void {
    // The story is carried by the scroll's zones (`stations.ts`). In the tail the page has gone past
    // the end and only the white layer still moves, with the scroll.
    const u = Math.min(local, 1) * STORY;
    const tail = Math.max(0, local - 1) * selenaScreens();
    const b = beatsAt(u, this.b, tail);
    this.dom(b, u, isPortrait(frame.viewport));
    this.live(b, u);
    this.scene.apply(b, frame);
  }

  /** The aurora behind the room: it comes in with the drawer and goes with the white. */
  private live(b: Beats, u: number): void {
    const backdrop = this.backdrop;
    if (!backdrop) return;
    const enter = smooth(seg(u, 0, 0.9));
    const amount = AURORA_AMOUNT * enter * (1 - b.white);
    // Nothing is asked at the joint with the list (u 0): the sky of the list stays whole there.
    if (amount <= 0.002) return;
    backdrop.set("aurora", {
      theme: "daybreak",
      colors: AURORA,
      amount,
      speed: 0.9,
      scale: 1.1,
      intensity: 1.8,
    });
  }

  private dom(b: Beats, u: number, portrait: boolean): void {
    // The drawer slides in from the left (from the foot on a phone) and fades with it.
    const away = (1 - b.drawer) * 102;
    put(
      this.drawer,
      "transform",
      portrait ? `translate3d(0, ${f(away)}%, 0)` : `translate3d(${f(-away)}%, 0, 0)`,
    );
    put(this.drawer, "opacity", f(Math.min(1, b.drawer * 1.6)));
    put(this.drawer, "visibility", b.drawer > 0 ? "inherit" : "hidden");
    // The list's sky is opaque and sits over the backdrop: it gives way as the aurora comes in.
    const skyGone = this.backdropOn ? (1 - SKY_LEFT) * smooth(seg(u, 0, 0.9)) : 0;
    put(this.sky, "opacity", f(1 - skyGone));

    // The words: the title, the line and the button come one after another, and leave in turn.
    this.word(this.title, u, 0);
    this.word(this.body, u, 1);
    this.word(this.action, u, 2);

    // The sky is under the white: once the white is whole it is hidden, so the white that leaves in
    // the tail shows the ground (the voices' own) and never a flash of the night.
    put(this.sky, "visibility", b.white < 1 ? "inherit" : "hidden");

    // The stars come as the drawer opens. The four point star of the film's sky follows the camera.
    put(this.stars, "opacity", f(0.6 * smooth(seg(u, 0, 0.8)) * (1 - b.white)));
    const star = smooth(seg(u, AT.camera[0], AT.camera[0] + 0.5)) * (1 - b.white);
    put(this.star, "opacity", f(0.95 * star));
    put(this.star, "transform", `scale(${f(0.8 + 0.2 * star)})`);

    // The white: the way out, then it leaves again in the tail, under the next section's own.
    const white = b.white * (1 - b.whiteOut);
    put(this.white, "opacity", f(white));
    put(this.white, "visibility", white > 0 ? "inherit" : "hidden");
    put(this.front, "opacity", f(b.front));
    put(this.front, "visibility", b.front > 0 ? "visible" : "hidden");
  }

  private word(el: HTMLElement | null, u: number, index: number): void {
    if (!el) return;
    const inAt = AT.words[0] + index * 0.1;
    const outAt = AT.wordsOut[0] + index * 0.04;
    const shown = smooth(seg(u, inAt, inAt + WORD_IN));
    const gone = smooth(seg(u, outAt, outAt + 0.15));
    put(el, "opacity", f(shown * (1 - gone)));
    put(el, "transform", `translate3d(0, ${f(26 * (1 - shown) - 22 * gone)}px, 0)`);
  }

  dispose(): void {
    this.disposed = true;
    this.scene.leave();
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  const runtime = new SelenaRuntime(ctx);
  // The actors are the biggest files: the section is built without them and they join when ready,
  // each when the page is idle (the long task of building one falls between two scroll events).
  const join = (): void => {
    if (runtime.isDisposed) return;
    void Promise.allSettled([
      ensureSelena(ctx),
      ensureSilverbolt(ctx),
      ensureDoll(ctx),
      ensureMarks(ctx),
      ensureCarry(ctx),
    ]).then(([sl, sb, doll, marks, carry]) => {
      if (runtime.isDisposed) return;
      runtime.built = true;
      runtime.scene.setActors({
        sl: sl.status === "fulfilled" ? sl.value : null,
        sb: sb.status === "fulfilled" ? sb.value : null,
        doll: doll.status === "fulfilled" ? doll.value : null,
        marks: marks.status === "fulfilled" ? marks.value : null,
        carry: carry.status === "fulfilled" ? carry.value : null,
      });
    });
  };
  whenIdle(join, 3000);
  // The backdrop is a second small canvas: made once, shared by every section. The shader is compiled
  // now so that it never compiles in the middle of the room's first play.
  void ensureBackdrop(ctx).then(
    (backdrop) => {
      if (runtime.isDisposed) return;
      runtime.backdrop = backdrop;
      void backdrop.warm(["aurora"]).finally(() => {
        runtime.backdropOn = backdrop.state().available;
        runtime.warmed = true;
      });
    },
    () => {
      runtime.warmed = true;
    },
  );
  return runtime;
}
