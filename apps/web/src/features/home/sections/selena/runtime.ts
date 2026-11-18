import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDoll } from "../../actors/doll";
import { ensureSelena } from "../../actors/selena";
import { ensureSilverbolt } from "../../actors/silverbolt";
import { ensureMarks } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { ensureCarry } from "../hand/carry";
import { whenIdle } from "../hand/idle";
import { isPortrait } from "../hand/timeline";

import { SelenaScene } from "./scene";
import { AT, SELENA_SCREENS, beatsAt, newBeats, seg, smooth, type Beats } from "./timeline";

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The Selena section: the drawer with its words (DOM), the stars and the white of the way out, and
 * the scene of the three actors. `update` is a pure function of `local` plus the pointer (what the
 * actors do under it is theirs). The drawer, the words and the white work before any actor arrives.
 */
class SelenaRuntime implements SectionRuntime {
  private readonly b: Beats = newBeats();
  readonly scene: SelenaScene;
  private readonly drawer: HTMLElement | null;
  private readonly stars: SVGElement | null;
  private readonly star: SVGElement | null;
  private readonly white: HTMLElement | null;
  private readonly front: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly body: HTMLElement | null;
  private readonly action: HTMLElement | null;
  private disposed = false;

  constructor(ctx: SectionCtx) {
    this.scene = new SelenaScene(ctx);
    const below = ctx.dom.below;
    const text = ctx.dom.text;
    this.drawer = below.querySelector<HTMLElement>("[data-selena-drawer]");
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

  enter(): void {
    this.scene.enter();
  }

  leave(): void {
    this.scene.leave();
  }

  update(local: number, frame: FrameInfo): void {
    const u = local * SELENA_SCREENS;
    const b = beatsAt(u, this.b);
    this.dom(b, u, isPortrait(frame.viewport));
    this.scene.apply(b, frame);
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
    put(this.drawer, "visibility", b.drawer > 0 ? "visible" : "hidden");

    // The words: the title, the line and the button come one after another, and leave in turn.
    this.word(this.title, u, 0);
    this.word(this.body, u, 1);
    this.word(this.action, u, 2);

    // The stars come as the drawer opens. The four point star of the film's sky follows the camera.
    put(this.stars, "opacity", f(0.9 * smooth(seg(u, 0, 0.8)) * (1 - b.white)));
    const star = smooth(seg(u, 2.25, 2.75)) * (1 - b.white);
    put(this.star, "opacity", f(0.92 * star));
    put(this.star, "transform", `scale(${f(0.8 + 0.2 * star)})`);

    // The white: the way out, then it leaves again in the tail, under the next section's own.
    const white = b.white * (1 - b.whiteOut);
    put(this.white, "opacity", f(white));
    put(this.white, "visibility", white > 0 ? "visible" : "hidden");
    put(this.front, "opacity", f(b.front));
    put(this.front, "visibility", b.front > 0 ? "visible" : "hidden");
  }

  private word(el: HTMLElement | null, u: number, index: number): void {
    if (!el) return;
    const inAt = AT.words[0] + index * 0.12;
    const outAt = AT.wordsOut[0] + index * 0.06;
    const shown = smooth(seg(u, inAt, inAt + 0.45));
    const gone = smooth(seg(u, outAt, outAt + 0.2));
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
  return runtime;
}
