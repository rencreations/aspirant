import { libUrl } from "@/lib/library";
import { withSound } from "@/lib/sound-prompt";

import type { DuoActor } from "../../actors/duo";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { OUT_FROM, duoSpotsAt, newSpots, stepDance, type StageRect } from "./choreo";
import { VoicesDom } from "./dom";

/** A line that is still playing when the leave is this far along is stopped. */
const STOP_AT = OUT_FROM + 0.12;

/**
 * The voices section: the chooser, the eight lines of the chosen Aspirant, her splash art, and the
 * two Guinevere drones, who float in from the edges, dance on a line while it plays and settle in
 * the bottom corners at the end. The scroll decides how far the section has emerged or left
 * (`choreo.ts`); the visitor decides the Aspirant and what plays. Nothing plays by itself.
 */
class VoicesRuntime implements SectionRuntime {
  private readonly dom: VoicesDom;
  private readonly spots = newSpots();
  private readonly placeA = { x: 0, y: 0, height: 0 };
  private readonly placeB = { x: 0, y: 0, height: 0 };
  private dock: StageRect | null = null;
  private readonly rectScratch: StageRect = { left: 0, right: 0, top: 0, bottom: 0 };
  private dance = 0;
  /** The mean cost of `update` in milliseconds (an exponential mean, for the probes). */
  private cost = 0;
  private speaking = false;
  private activeUrl: string | null = null;
  private readonly stopListening: () => void;
  private observer: ResizeObserver | null = null;

  constructor(
    private readonly ctx: SectionCtx,
    private readonly duo: DuoActor | null,
    private readonly marks: MarksActor | null,
  ) {
    this.dom = new VoicesDom(
      ctx.dom.text.querySelector<HTMLElement>("[data-voices]") ?? ctx.dom.text,
      ctx.dom.below,
      {
        select: (index) => {
          this.choose(index);
        },
        play: (line) => {
          this.play(line);
        },
      },
    );
    this.stopListening = ctx.audio.onVoiceChange((state) => {
      if (!state.playing) {
        this.activeUrl = null;
        this.speaking = false;
        this.dom.clearLines();
      }
    });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.measure);
      for (const el of ctx.dom.text.querySelectorAll<HTMLElement>(
        "[data-voices-panel], [data-voices-dock], [data-voices-part='listening']",
      )) {
        this.observer.observe(el);
      }
    }
    this.dom.listening?.addEventListener("scroll", this.measure, { passive: true });
    this.measure();
    (window as unknown as { __homeVoices?: unknown }).__homeVoices = {
      state: () => ({
        index: this.dom.index,
        speaking: this.speaking,
        dance: this.dance,
        url: this.activeUrl,
        dock: this.dock,
        placed: [{ ...this.placeA }, { ...this.placeB }],
        cost: this.cost,
      }),
      select: (index: number) => {
        this.choose(index);
      },
    };
  }

  /**
   * The ready gate of the way in: it does not start before the art of the Aspirant shown is decoded,
   * so her picture comes in with the words and the drones, never after them. Until then the screen
   * stays on Selena's white and the page is free.
   */
  ready(): boolean {
    return this.dom.artReady();
  }

  update(local: number, frame: FrameInfo): void {
    const t0 = performance.now();
    this.step(local, frame);
    this.cost += (performance.now() - t0 - this.cost) * 0.05;
  }

  private step(local: number, frame: FrameInfo): void {
    this.dom.apply(local, frame.viewport.w);
    // The list has faded: a line still playing would be a voice from a page nobody can see.
    if (local > STOP_AT && this.activeUrl !== null) this.stopOurVoice();
    const duo = this.duo;
    if (!duo) return;
    duo.visible = this.dock !== null || local >= OUT_FROM;
    const spots = duoSpotsAt(local, frame.viewport, this.dock, this.spots);
    const a = this.placeA;
    const b = this.placeB;
    a.x = spots.a.x;
    a.y = spots.a.y;
    a.height = spots.a.h;
    b.x = spots.b.x;
    b.y = spots.b.y;
    b.height = spots.b.h;
    duo.place(a, b);
    this.dance = stepDance(this.dance, this.speaking, frame.dt);
    if (this.dance > 0.02) duo.pose("dance", this.dance);
    else duo.pose("float", 1);
  }

  enter(): void {
    this.measure();
    this.duo?.restart();
    this.duo?.setMarkSink(null);
  }

  leave(): void {
    this.dom.closePicker();
    this.stopOurVoice();
    this.speaking = false;
    this.dance = 0;
  }

  dispose(): void {
    this.stopOurVoice();
    this.stopListening();
    this.observer?.disconnect();
    this.dom.listening?.removeEventListener("scroll", this.measure);
    this.dom.dispose();
    const w = window as unknown as { __homeVoices?: unknown };
    delete w.__homeVoices;
  }

  // ---- the visitor ---------------------------------------------------------------------

  private choose(index: number): void {
    if (index === this.dom.index) return;
    this.stopOurVoice();
    this.dom.setActive(index);
    this.measure();
    this.ctx.audio.blip("click");
  }

  private play(line: HTMLElement): void {
    const key = line.dataset.key;
    if (!key) return;
    const url = libUrl(key);
    const gain = Number(line.dataset.gain);
    const audio = this.ctx.audio;
    audio.unlock();
    const voice = audio.getVoiceState();
    if (voice.playing && voice.url === url) {
      audio.stopVoice();
      return;
    }
    withSound("This voice line", () => {
      audio.blip("click");
      // `playVoice` stops the line that is playing first, and that announces "stopped" at once,
      // which wipes `activeUrl`. So this line is marked only after the call has begun.
      const started = audio.playVoice(url, { gainDb: Number.isFinite(gain) ? gain : undefined });
      this.activeUrl = url;
      this.speaking = false;
      this.dom.setLine(line, "loading");
      void started.then((ok) => {
        // Another line took over while this one's file was coming: it has its own state.
        if (this.activeUrl !== url) return;
        if (!ok) {
          this.activeUrl = null;
          this.dom.setLine(line, "idle");
          return;
        }
        this.dom.setLine(line, "playing");
        this.speaking = true;
        if (this.dock && this.duo?.visible) {
          const { x, y, height } = this.placeB;
          this.marks?.emit("note", {
            at: { x, y: y + height * 0.5 },
            size: height * 0.48,
            count: 1,
          });
        }
      });
    });
  }

  private stopOurVoice(): void {
    if (this.activeUrl === null) return;
    this.ctx.audio.stopVoice();
    this.activeUrl = null;
    this.speaking = false;
    this.dom.clearLines();
  }

  // ---- the layout ----------------------------------------------------------------------

  /** Use layout offsets so entrance transforms never become part of the resting position. */
  private readonly measure = (): void => {
    const dock = this.dom.dock;
    const column = this.dom.listening;
    if (!dock || !column || dock.offsetWidth === 0) {
      this.dock = null;
      return;
    }
    const { w, h } = this.ctx.viewport();
    let left = 0;
    let top = 0;
    for (
      let el: HTMLElement | null = dock;
      el && el !== column;
      el = el.offsetParent as HTMLElement | null
    ) {
      left += el.offsetLeft;
      top += el.offsetTop;
    }
    top -= column.scrollTop;
    if (top < -1 || top + dock.offsetHeight > column.clientHeight + 1) {
      this.dock = null;
      return;
    }
    left += column.offsetLeft;
    top += column.offsetTop;
    const r = this.rectScratch;
    r.left = left - w / 2;
    r.right = left + dock.offsetWidth - w / 2;
    r.top = h / 2 - top;
    r.bottom = h / 2 - (top + dock.offsetHeight);
    this.dock = r;
  };
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  let duo: DuoActor | null = null;
  let marks: MarksActor | null = null;
  try {
    const [{ ensureDuo }, { ensureMarks }] = await Promise.all([
      import("../../actors/duo"),
      import("../../fx/comic-marks"),
    ]);
    [duo, marks] = await Promise.all([ensureDuo(ctx), ensureMarks(ctx)]);
  } catch (error) {
    // The pair is a flourish: the chooser and the lines work without it.
    console.warn("voices: the drones could not be made", error);
  }
  return new VoicesRuntime(ctx, duo, marks);
}
