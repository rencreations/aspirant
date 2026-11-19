import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureBuddies } from "../../actors/buddies";
import { ensureSelena } from "../../actors/selena";
import { ensureSilverbolt } from "../../actors/silverbolt";
import { ensureSheet } from "../../fx/sheet";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { whenIdle } from "../idle";
import { isPortrait } from "../vp";

import { loadOutCameras } from "./out-camera";
import { SelenaScene } from "./scene";
import { STORY } from "./stations";
import { AT, WORD_IN, beatsAt, newBeats, seg, selenaScreens, smooth, type Beats } from "./timeline";

const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The Selena section: the drawer with its words (DOM), the white of the way out, and
 * the scene of the three actors. `update` is a pure function of `local` plus the pointer (what the
 * actors do under it is theirs). The drawer, the words and the white work before any actor arrives.
 */
class SelenaRuntime implements SectionRuntime {
  private readonly b: Beats = newBeats();
  readonly scene: SelenaScene;
  private readonly drawer: HTMLElement | null;
  private readonly white: HTMLElement | null;
  private readonly front: HTMLElement | null;
  private readonly title: HTMLElement | null;
  private readonly body: HTMLElement | null;
  private readonly action: HTMLElement | null;
  private disposed = false;
  /** The actors have arrived, or have failed for good: the scene is as whole as it will be. */
  built = false;

  constructor(ctx: SectionCtx) {
    this.scene = new SelenaScene(ctx);
    const below = ctx.dom.below;
    const text = ctx.dom.text;
    this.drawer = below.querySelector<HTMLElement>("[data-selena-drawer]");
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
   * dragon eats her, so all three must be built.
   */
  ready(): boolean {
    return this.built;
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
    put(this.drawer, "visibility", b.drawer > 0 ? "inherit" : "hidden");
    // The words: the title, the line and the button come one after another, and leave in turn.
    this.word(this.title, u, 0);
    this.word(this.body, u, 1);
    this.word(this.action, u, 2);

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
    const shown = smooth(seg(u, inAt, inAt + WORD_IN));
    // They leave with the drawer, in the first part of the out animation.
    const gone = 1 - this.b.out.room;
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
      // The pair after her (the registry steps actors in the order they were made), then the sheet.
      ensureBuddies(ctx),
      loadOutCameras(),
    ]).then(async ([sl, sb, pair, cams]) => {
      if (runtime.isDisposed) return;
      // The sheet reads her hand: it is built once she is.
      const sheet = sl.status === "fulfilled" ? await ensureSheet(ctx).catch(() => null) : null;
      if (runtime.isDisposed) return;
      runtime.built = true;
      runtime.scene.setActors({
        sl: sl.status === "fulfilled" ? sl.value : null,
        sb: sb.status === "fulfilled" ? sb.value : null,
        pair: pair.status === "fulfilled" ? pair.value : null,
        sheet,
        cams: cams.status === "fulfilled" ? cams.value : null,
      });
    });
  };
  whenIdle(join, 3000);
  return runtime;
}
