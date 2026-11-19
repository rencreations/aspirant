import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureSelena } from "../../actors/selena";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { beatFor } from "../../kernel/beat";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd, sectionScreens } from "../../kernel/where";
import { newBackdropPlan } from "../bolt/backdrop-plan";

import { planHandBackdrop } from "./backdrop-plan";
import { ensureCarry, type Carry } from "./carry";
import { whenIdle } from "./idle";
import { HAND_LAST } from "./stations";
import { handBeats, newHandBeats, seg, type HandBeats } from "./timeline";

const expoOut = (u: number): number => (u >= 1 ? 1 : 1 - 2 ** (-10 * u));
const f = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The hand section: one play (about two seconds) in which the hand rises, the doll lands in the palm
 * and sits, the words come in letter by letter and the hint says to hover; then the page rests with
 * the fingers live; then, as the page goes on to the list, the hand comes down and the words are left
 * behind above (a short join that follows the scroll). The actors are driven by `Carry` (shared with
 * the list); this file owns the words and the live backdrop (a deep nebula). The words work before
 * the actors have arrived (a jump into the section while the hand and the doll are still loading shows
 * the words and the empty stage, never a half page).
 */
class HandRuntime implements SectionRuntime {
  private carry: Carry | null = null;
  private disposed = false;
  private readonly b: HandBeats = newHandBeats();
  private readonly chars: HTMLElement[];
  private readonly head: HTMLElement | null;
  private readonly desc: HTMLElement | null;
  private readonly hint: HTMLElement | null;
  private readonly hintLine: HTMLElement | null;
  private readonly hintIcon: SVGElement | null;
  private readonly plan = newBackdropPlan();
  private vh = 900;

  constructor(
    private readonly ctx: SectionCtx,
    private readonly backdrop: Backdrop | null,
  ) {
    const root = ctx.dom.text;
    this.chars = Array.from(root.querySelectorAll<HTMLElement>("[data-hand-ch]"));
    this.head = root.querySelector<HTMLElement>("[data-hand-head]");
    this.desc = root.querySelector<HTMLElement>("[data-hand-desc]");
    this.hint = root.querySelector<HTMLElement>("[data-hand-hint]");
    this.hintLine = root.querySelector<HTMLElement>("[data-hand-hint-line]");
    this.hintIcon = root.querySelector<SVGElement>("[data-hand-hint-icon]");
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  /** The hand and the doll are built (the list section shares them). */
  setCarry(carry: Carry | null): void {
    if (this.disposed) return;
    this.carry = carry;
  }

  update(v: number, frame: FrameInfo): void {
    // The lead goes with the scroll (negative beats are screens); the tail rests on the last beat.
    const t = Math.min(HAND_LAST, beatFor(v, 0, HAND_LAST, sectionScreens("hand")));
    // The join with the list: the screens past the place where the hand ends and the list begins.
    const ts = frame.S - sectionEnd("hand");
    this.vh = frame.viewport.h;
    this.carry?.drive(t, ts, 0, frame, t >= 0);
    this.words(handBeats(t, ts, this.b), frame.time);
    const plan = planHandBackdrop(t, this.plan);
    this.backdrop?.set(plan.kind, plan.options);
  }

  /** The title letter by letter (oryzo's recipe: a slide of a quarter em and a fade, staggered). */
  private words(b: HandBeats, time: number): void {
    const n = this.chars.length;
    const out = b.textOut;
    for (let k = 0; k < n; k += 1) {
      const u = n > 1 ? k / (n - 1) : 0;
      const c = expoOut(seg(b.title, u * 0.3, u * 0.3 + 0.6));
      const o = seg(b.title, u * 0.3, u * 0.3 + 0.4) * (1 - seg(out, u * 0.2, u * 0.2 + 0.6));
      const el = this.chars[k];
      put(el, "opacity", f(o));
      put(el, "transform", `translate3d(${f((1 - c) * 0.25)}em, 0, 0)`);
    }
    // Left behind above: the whole block rises away while the hand goes down.
    put(this.head, "transform", `translate3d(0, ${f(-out * out * 0.22 * this.vh)}px, 0)`);
    const d = b.desc * (1 - seg(out, 0.05, 0.7));
    put(this.desc, "opacity", f(d));
    put(this.desc, "transform", `translate3d(0, ${f((1 - b.desc) * 0.7)}em, 0)`);
    const h = b.hint * (1 - seg(out, 0, 0.35));
    put(this.hint, "opacity", f(h * 0.6));
    put(this.hintLine, "transform", `scaleX(${f(b.hint)})`);
    // The icon wobbles like the reference's (a sine of the time, a few degrees).
    const wob = Math.sin(3 * time);
    put(
      this.hintIcon,
      "transform",
      `translate3d(${f(wob * 12)}px, ${f(Math.cos(6 * time + Math.PI / 2) * 1.6)}px, 0) rotate(${f(Math.cos(3 * time) * -6)}deg)`,
    );
  }

  dispose(): void {
    this.disposed = true;
    this.carry = null;
    const root = this.ctx.dom.text;
    root
      .querySelectorAll<HTMLElement>(
        "[data-hand-ch], [data-hand-head], [data-hand-desc], [data-hand-hint], [data-hand-hint-line]",
      )
      .forEach((el) => {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      });
    this.hintIcon?.style.removeProperty("transform");
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const backdrop = await ensureBackdrop(ctx).catch(() => null);
  const runtime = new HandRuntime(ctx, backdrop);
  // The hand and the doll are the biggest files: the section is built without them and they join
  // when ready. The list section shares the same pair (`ensureCarry` builds them once). The section
  // mounts twelve screens early, so this falls in a pause of the scroll long before the hand shows;
  // Selena, the next heavy actor, is built right after them for the same reason (the list draws her).
  whenIdle(() => {
    if (runtime.isDisposed) return;
    void ensureCarry(ctx).then(
      (carry) => {
        runtime.setCarry(carry);
        if (!runtime.isDisposed) void ensureSelena(ctx).catch(() => undefined);
      },
      () => {
        runtime.setCarry(null);
      },
    );
  }, 1200);
  return runtime;
}
