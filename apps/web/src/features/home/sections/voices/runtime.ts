import { libUrl } from "@/lib/library";
import { withSound } from "@/lib/sound-prompt";

import type { DuoActor } from "../../actors/duo";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import {
  OUT_FROM,
  duoSpotsAt,
  emergeAt,
  leaveAt,
  newSpots,
  stepDance,
  type StageRect,
} from "./choreo";
import { VoicesDom } from "./dom";
import { bridgeDuoMarks } from "./marks-bridge";

/** A line that is still playing when the leave is this far along is stopped. */
const STOP_AT = OUT_FROM + 0.12;
/** The calm backdrop behind the chooser and the art: slow pastel waves along the foot. */
const BACKDROP_AMOUNT = 0.85;
/** A heart between the drones: the first after this many seconds of dancing, then this often. */
const HEART_FIRST = 0.5;
const HEART_EVERY = 1.15;

interface Place {
  x: number;
  y: number;
  height: number;
}

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
  /** The frame of the art in the stage's pixels (origin in the middle, y up), or null before it is measured. */
  private art: StageRect | null = null;
  private readonly rectScratch: StageRect = { left: 0, right: 0, top: 0, bottom: 0 };
  private dance = 0;
  private heartIn = HEART_FIRST;
  private readonly heartAt = { x: 0, y: 0 };
  /** The mean cost of `update` in milliseconds (an exponential mean, for the probes). */
  private cost = 0;
  private speaking = false;
  private activeUrl: string | null = null;
  private readonly stopListening: () => void;
  private observer: ResizeObserver | null = null;
  /** The live backdrop, once the second canvas is made. The section works without it. */
  backdrop: Backdrop | null = null;
  /** The waves' shader is compiled (or the backdrop cannot be had). */
  warmed = false;

  /** The ready gate: the entrance's first draw of the waves is no hitch. The pair is built already. */
  ready(): boolean {
    return this.warmed;
  }

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
    if (this.dom.artFrame && typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => {
        this.measure();
      });
      this.observer.observe(this.dom.artFrame);
    }
    this.measure();
    if (duo && marks) bridgeDuoMarks(duo, marks);
    (window as unknown as { __homeVoices?: unknown }).__homeVoices = {
      state: () => ({
        index: this.dom.index,
        speaking: this.speaking,
        dance: this.dance,
        url: this.activeUrl,
        art: this.art,
        placed: [{ ...this.placeA }, { ...this.placeB }],
        cost: this.cost,
      }),
      select: (index: number) => {
        this.choose(index);
      },
    };
  }

  update(local: number, frame: FrameInfo): void {
    const t0 = performance.now();
    this.step(local, frame);
    this.cost += (performance.now() - t0 - this.cost) * 0.05;
  }

  private step(local: number, frame: FrameInfo): void {
    this.dom.apply(local, frame.viewport.w);
    // The backdrop comes in with the title and goes with the list. Nothing is asked while the
    // section has not begun (its lead), so Selena's last frames keep the ground.
    const enter = emergeAt(local, 0) * (1 - leaveAt(local));
    if (this.backdrop && enter > 0.002) {
      this.backdrop.set("waves", {
        theme: "daybreak",
        amount: BACKDROP_AMOUNT * enter,
        speed: 0.6,
      });
    }
    // The list has faded: a line still playing would be a voice from a page nobody can see.
    if (local > STOP_AT && this.activeUrl !== null) this.stopOurVoice();
    const duo = this.duo;
    if (!duo) return;
    duo.visible = true;
    const spots = duoSpotsAt(local, frame.viewport, this.art, this.spots);
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
    this.hearts(frame.dt, a, b);
  }

  /** While they dance on a line, a heart pops up between them now and then. */
  private hearts(dt: number, a: Place, b: Place): void {
    const marks = this.marks;
    if (!marks || this.dance < 0.6) {
      this.heartIn = HEART_FIRST;
      return;
    }
    this.heartIn -= dt;
    if (this.heartIn > 0) return;
    this.heartIn = HEART_EVERY;
    this.heartAt.x = (a.x + b.x) / 2;
    this.heartAt.y = Math.max(a.y, b.y) + 0.7 * Math.max(a.height, b.height);
    marks.emit("heart", {
      at: this.heartAt,
      size: 0.4 * Math.max(a.height, b.height),
      color: "pink",
      count: 1,
      strength: this.dance,
    });
  }

  enter(): void {
    this.measure();
    this.duo?.restart();
    if (this.duo && this.marks) bridgeDuoMarks(this.duo, this.marks);
  }

  leave(): void {
    this.stopOurVoice();
    this.speaking = false;
    this.dance = 0;
  }

  dispose(): void {
    this.stopOurVoice();
    this.stopListening();
    this.observer?.disconnect();
    this.dom.dispose();
    const w = window as unknown as { __homeVoices?: unknown };
    delete w.__homeVoices;
  }

  // ---- the visitor ---------------------------------------------------------------------

  private choose(index: number): void {
    if (index === this.dom.index) return;
    this.stopOurVoice();
    this.dom.setActive(index);
    this.ctx.audio.blip("click");
    this.duo?.react("hello");
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
        this.duo?.react("cheer", "a");
        this.duo?.react("hop", "b");
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

  /** Where the art stands, in the stage's pixels. The layers start at the top left of the screen. */
  private measure(): void {
    const frame = this.dom.artFrame;
    if (!frame) return;
    const { w, h } = this.ctx.viewport();
    const left = frame.offsetLeft;
    const top = frame.offsetTop;
    const r = this.rectScratch;
    r.left = left - w / 2;
    r.right = left + frame.offsetWidth - w / 2;
    r.top = h / 2 - top;
    r.bottom = h / 2 - (top + frame.offsetHeight);
    this.art = r;
  }
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
  const runtime = new VoicesRuntime(ctx, duo, marks);
  void ensureBackdrop(ctx).then(
    (backdrop) => {
      runtime.backdrop = backdrop;
      void backdrop.warm(["waves"]).finally(() => {
        runtime.warmed = true;
      });
    },
    () => {
      runtime.warmed = true;
    },
  );
  return runtime;
}
