import { SRGBColorSpace, Texture } from "three";

import { put } from "@/features/character/vexana/seams/scroll-kit";

import { drawnHeight, walkPhaseFor, type DollActor } from "../../actors/doll";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { TetraActor } from "../../actors/tetra";
import type { Backdrop } from "../../fx/backdrop";
import type { MarksActor } from "../../fx/comic-marks";
import type { SustainHandle } from "../../fx/comic-marks/system";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd } from "../../kernel/where";
import { backdropAt } from "./backdrop";
import { coverBitmap, loadCovers, type CoverSide } from "./covers";
import {
  T,
  beatAt,
  dollPlace,
  dragonPlace,
  geometry,
  lerp,
  ramp,
  tetraRun,
  tetraStand,
  wordsAmount,
  wordsLeave,
  type ChaseGeometry,
} from "./timeline";

/** The dragon heads right, turned three quarters toward us. */
const YAW = 1.1;
/** The doll runs side on, facing right. */
const DOLL_YAW = 0.5;
const SCARED = [
  { face: "scared", hold: 0.6 },
  { face: "scream", hold: 0.5, blend: 0.1 },
  { face: "scared", hold: 0.4, blend: 0.1 },
  { face: "crying", hold: 0.4, blend: 0.1 },
] as const;
const SCARED_LOOP = 1.9;
/** A page of the comic turns this often while she reads (seconds). */
const PAGE_EVERY = 3.4;

interface Point {
  x: number;
  y: number;
}
const point = (): Point => ({ x: 0, y: 0 });

/**
 * The chase and the comic: the doll runs for her life, Silverbolt chases her, Tetra chases both and
 * runs out of breath in the middle, pants, waves, sits and reads; the camera comes in on her and the
 * giant word COMIC, the two comics and the button arrive behind and beside her, then leave. Every
 * frame is a pure function of `local`, the size of the screen and the section's small state (the
 * marks thrown, the page last turned). Nothing is written before the section's own start (the funny
 * section's drones are still riding out of the screen) and every actor is set in full each frame.
 */
class ChaseRuntime implements SectionRuntime {
  private tetra: TetraActor | null = null;
  private dragon: SilverboltActor | null = null;
  private doll: DollActor | null = null;
  private marks: MarksActor | null = null;
  private backdrop: Backdrop | null = null;
  private disposed = false;
  private entered = false;

  private readonly content: HTMLElement | null;
  private readonly word: HTMLElement | null;
  private readonly cards: Record<CoverSide, HTMLElement | null>;
  private readonly links: Record<CoverSide, HTMLElement | null>;
  private readonly cta: HTMLElement | null;
  private readonly anchors: HTMLElement[];
  private linksLive = true;
  private shownAmount = Number.NaN;

  private geo: ChaseGeometry;
  private readonly textures: Texture[] = [];
  private coversSet = false;

  private speedDoll: SustainHandle | null = null;
  private speedDragon: SustainHandle | null = null;
  private speedTetra: SustainHandle | null = null;
  private beads: SustainHandle | null = null;
  private steam: SustainHandle | null = null;

  private dustAt = 0;
  private veinAt = 0;
  private sweatAt = 0;
  private pageAt = 0;
  private lastLocal = Number.NaN;
  /** Frames each runner has been drawn in a row: a mark point is stale (0, 0) before the third. */
  private dollFrames = 0;
  private tetraFrames = 0;

  private readonly dp = { x: 0, y: 0, dist: 0, on: false };
  private readonly bp = { x: 0, y: 0, pitch: 0, roll: 0, on: false };
  private readonly tr = { x: 0, y: 0, speed: 0, running: false };
  private readonly ts = { x: 0, y: 0, height: 0 };
  private readonly dollHead = { x: 0, y: 0, s: 1, unit: 1 };
  private readonly anchorA = point();
  private readonly anchorB = point();
  private readonly anchorC = point();

  /** A control of the section has the keyboard's focus: its words stay shown wherever the scroll is. */
  private kbd = false;
  private readonly onFocusIn = (): void => {
    this.kbd = true;
  };
  private readonly onFocusOut = (e: FocusEvent): void => {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !this.ctx.dom.text.contains(to)) this.kbd = false;
  };

  constructor(private readonly ctx: SectionCtx) {
    const text = ctx.dom.text;
    text.addEventListener("focusin", this.onFocusIn);
    text.addEventListener("focusout", this.onFocusOut);
    // The page moved here because a control took the focus: the runtime arrives after that event.
    this.kbd = text.contains(document.activeElement);
    this.content = text.querySelector<HTMLElement>("[data-home-content]");
    this.word = ctx.dom.below.querySelector<HTMLElement>("[data-chase-word]");
    const card = (side: CoverSide) =>
      text.querySelector<HTMLElement>(`[data-chase-card="${side}"]`);
    const link = (side: CoverSide) =>
      text.querySelector<HTMLElement>(`[data-chase-link="${side}"]`);
    this.cards = { left: card("left"), right: card("right") };
    this.links = { left: link("left"), right: link("right") };
    this.cta = text.querySelector<HTMLElement>("[data-chase-cta]");
    this.anchors = Array.from(text.querySelectorAll<HTMLElement>("a"));
    const v = ctx.viewport();
    this.geo = geometry(v.w, v.h);
    void this.load();
  }

  /** Every actor has arrived or failed for good, and the backdrop's shaders are compiled. */
  private loaded = false;

  /** The ready gate: the run and the book need Tetra, the dragon and the doll built. */
  ready(): boolean {
    return this.loaded;
  }

  /** Build or find every actor; each one that arrives is used from the next frame, whatever the others do. */
  private async load(): Promise<void> {
    const ctx = this.ctx;
    const take = async <A>(what: string, make: () => Promise<A>, set: (a: A) => void) => {
      try {
        const a = await make();
        if (!this.disposed) set(a);
      } catch (error) {
        console.warn(`[home chase] ${what} did not load`, error);
      }
    };
    await Promise.all([
      take(
        "the marks",
        async () => (await import("../../fx/comic-marks")).ensureMarks(ctx),
        (a) => {
          this.marks = a;
          this.speedDoll = a.sustain("speed", { size: 0.2 * this.geo.h, direction: Math.PI });
          this.speedDragon = a.sustain("speed", { size: 0.26 * this.geo.h, direction: Math.PI });
          this.speedTetra = a.sustain("speed", { size: 0.14 * this.geo.h, direction: Math.PI });
          this.beads = a.sustain("beads", { size: 0.1 * this.geo.h });
          this.steam = a.sustain("steam", { size: 0.035 * this.geo.h });
        },
      ),
      take(
        "the backdrop",
        async () => {
          const a = await (await import("../../fx/backdrop")).ensureBackdrop(ctx);
          // Compiled before the first play, so its first draw is no hitch inside the scene.
          await a.warm(["speed-lines", "soft-aurora", "pixel-blast"]).catch(() => undefined);
          return a;
        },
        (a) => {
          this.backdrop = a;
        },
      ),
      take(
        "Tetra",
        async () => (await import("../../actors/tetra")).ensureTetra(ctx),
        (a) => (this.tetra = a),
      ),
      take(
        "Silverbolt",
        async () => (await import("../../actors/silverbolt")).ensureSilverbolt(ctx),
        (a) => (this.dragon = a),
      ),
      take(
        "the doll",
        async () => (await import("../../actors/doll")).ensureDoll(ctx),
        (a) => (this.doll = a),
      ),
    ]);
    this.loaded = true;
    // The covers come last and on their own: the book keeps its plain boards until they are here.
    void loadCovers().then(() => {
      this.setCovers();
    });
    if (this.entered) this.bindBook();
  }

  /** The two covers as textures on the book (a no-op until both the book and the pictures are here). */
  private setCovers(): void {
    const tetra = this.tetra;
    if (this.coversSet || this.disposed || !tetra) return;
    const left = coverBitmap("left");
    const right = coverBitmap("right");
    if (!left && !right) return;
    const make = (bitmap: ImageBitmap | null): Texture | null => {
      if (!bitmap) return null;
      const t = new Texture(bitmap);
      t.colorSpace = SRGBColorSpace;
      t.needsUpdate = true;
      this.textures.push(t);
      return t;
    };
    tetra.book.setCovers(make(left), make(right));
    this.coversSet = true;
  }

  /** A press on a cover of the book follows the real link (the page change goes through the site's transition). */
  private bindBook(): void {
    const tetra = this.tetra;
    if (!tetra) return;
    tetra.book.labels("READ", "READ");
    tetra.book.onPress((side) => {
      this.links[side === "left" ? "left" : "right"]?.click();
    });
    this.setCovers();
  }

  enter(): void {
    this.entered = true;
    this.lastLocal = Number.NaN;
    this.dragon?.calm();
    this.bindBook();
  }

  leave(): void {
    this.entered = false;
    this.tetra?.book.onPress(null);
    if (!this.kbd) this.words(0);
  }

  update(local: number, frame: FrameInfo): void {
    const { w, h } = frame.viewport;
    if (w !== this.geo.w || h !== this.geo.h) this.geo = geometry(w, h);
    const jumped = Number.isNaN(this.lastLocal) || Math.abs(local - this.lastLocal) > 0.12;
    this.lastLocal = local;
    // Nothing is written before the section's own start: the funny section's drones ride out first.
    if (local < 0) {
      this.words(0);
      return;
    }
    if (jumped) {
      this.dollFrames = this.tetraFrames = 0;
      // Only a seek that lands inside the scene clears: a slow entry through the lead or the tail
      // (local below 0 or above 1) must leave the neighbour's marks alone.
      if (local <= 1) this.marks?.clear();
    }
    // The words come in with the second play and go with the scroll after the section (`frame.S`),
    // so a section passed by a jump (replayed at its last station) shows none.
    const gone = wordsLeave(frame.S, sectionEnd("chase"));
    this.words(this.kbd ? 1 : wordsAmount(local) * (1 - gone));
    const ask = backdropAt(local);
    this.backdrop?.set(ask.kind, ask.options);
    this.drawDoll(local, frame, jumped);
    this.drawDragon(local, frame);
    this.drawTetra(local, frame, jumped);
  }

  // ---------------------------------------------------------------------------------------- words

  /** The word, the two comics and the button: how much of them is shown, 0 to 1. */
  private words(amount: number): void {
    // Nothing is formatted or written while the words stand still.
    if (amount === this.shownAmount) return;
    this.shownAmount = amount;
    const a = Math.min(1, amount * 1.15);
    const fmt = (v: number) => String(Number(v.toFixed(3)));
    put(this.word, "opacity", fmt(a));
    put(
      this.word,
      "transform",
      `translate3d(0, ${((1 - a) * 5).toFixed(2)}vh, 0) scale(${(0.9 + 0.1 * a).toFixed(3)})`,
    );
    const slide = (el: HTMLElement | null, side: number) => {
      put(el, "opacity", fmt(a));
      put(
        el,
        "transform",
        `translate3d(${(side * (1 - a) * 22).toFixed(2)}vw, ${((1 - a) * 3).toFixed(2)}vh, 0) rotate(${(side * (-1 - 4 * a)).toFixed(2)}deg)`,
      );
    };
    slide(this.cards.left, -1);
    slide(this.cards.right, 1);
    put(this.cta, "opacity", fmt(ramp(amount, 0.3, 1)));
    put(
      this.cta,
      "transform",
      `translate3d(0, ${((1 - ramp(amount, 0.3, 1)) * 2).toFixed(2)}vh, 0)`,
    );
    const live = amount > 0.5;
    if (live !== this.linksLive) {
      this.linksLive = live;
      for (const el of this.anchors) el.style.pointerEvents = live ? "" : "none";
    }
  }

  // ---------------------------------------------------------------------------------------- the doll

  private drawDoll(local: number, frame: FrameInfo, jumped: boolean): void {
    const doll = this.doll;
    const g = this.geo;
    const d = dollPlace(local, g, this.dp);
    if (!doll || !d.on) {
      this.beads?.stop();
      this.speedDoll?.stop();
      this.dollFrames = 0;
      return;
    }
    this.dollFrames++;
    // The funny section had her in the dragon's mouth: she is her own again.
    if (doll.parentSocket) doll.detach();
    doll.visible = true;
    doll.reset();
    doll.place({ x: d.x, y: d.y, z: 24, height: g.dollH, yaw: DOLL_YAW });
    doll.pose("run", 1);
    doll.walk(1, { phase: walkPhaseFor(d.dist, g.dollH), lean: 1 });
    doll.mood(SCARED, frame.time % SCARED_LOOP);
    doll.talk(0.6 + 0.4 * Math.sin(frame.time * 11));
    doll.blinkAuto(false);

    const marks = this.marks;
    if (!marks || jumped || frame.dt <= 0 || this.dollFrames <= 3) return;
    doll.markPoint("head", this.dollHead);
    this.anchorA.x = this.dollHead.x;
    this.anchorA.y = this.dollHead.y;
    this.beads?.update(this.anchorA, 0.8);
    const drawn = drawnHeight(g.dollH);
    this.anchorB.x = d.x - 0.7 * drawn;
    this.anchorB.y = d.y + 0.5 * drawn;
    this.speedDoll?.update(this.anchorB, 0.8, Math.PI);
    if (frame.time - this.dustAt > 0.2) {
      this.dustAt = frame.time;
      marks.emit("dust", { at: { x: d.x - 0.2 * drawn, y: d.y }, size: 0.3 * drawn });
    }
  }

  // ---------------------------------------------------------------------------------------- the dragon

  private drawDragon(local: number, frame: FrameInfo): void {
    const sb = this.dragon;
    const g = this.geo;
    const b = dragonPlace(local, g, this.bp);
    if (!sb || !b.on) {
      this.speedDragon?.stop();
      return;
    }
    sb.visible = true;
    sb.place({ x: b.x, y: b.y, z: 0, height: g.dragonH, yaw: YAW, pitch: b.pitch, roll: b.roll });
    sb.fly(frame.time, { amplitude: 1.25, speed: 1.3 });
    sb.face("growl", 0.7);
    // It snaps at her: the jaw opens wide and shuts again, three times a second.
    sb.jaw(0.5 + 0.5 * Math.abs(Math.sin(frame.time * Math.PI * 3)));
    sb.follow(0);
    sb.look(b.x + 900, b.y - 0.3 * g.dragonH);

    if (this.marks && frame.dt > 0) {
      this.anchorC.x = b.x - 2.2 * g.dragonH;
      this.anchorC.y = b.y;
      this.speedDragon?.update(this.anchorC, 0.9, Math.PI);
    }
  }

  // ---------------------------------------------------------------------------------------- Tetra

  private drawTetra(local: number, frame: FrameInfo, jumped: boolean): void {
    const tetra = this.tetra;
    const g = this.geo;
    if (!tetra || local < T.tetraFrom - 0.01) {
      this.tetraFrames = 0;
      return;
    }
    this.tetraFrames++;
    const beat = beatAt(local);
    const run = tetraRun(local, g, this.tr);
    const stand = tetraStand(local, g, this.ts);
    const stopped = local >= T.tetraTo;

    tetra.visible = true;
    tetra.kite.fly(null);
    tetra.setReel(false);
    tetra.place({
      x: stopped ? stand.x : run.x,
      y: stopped ? stand.y : run.y,
      height: stopped ? stand.height : g.tetraH,
      flip: false,
    });
    tetra.look("pointer");
    tetra.setInteractive(true);
    tetra.pose(beat, 1);
    tetra.runSpeed(run.speed);
    tetra.waveWith(1);
    if (beat === "run") tetra.setFace("angry", 1);
    else if (beat === "pant" || beat === "wave") tetra.setFace("tired", 1);
    else tetra.setFace(null);
    // She is the one who reads: the book is out and open by the pose itself.
    tetra.book.auto();
    if (beat === "read" && !jumped && frame.dt > 0 && frame.time - this.pageAt > PAGE_EVERY) {
      this.pageAt = frame.time;
      tetra.book.turnPage();
    }
    this.tetraMarks(tetra, beat, local, frame, jumped);
  }

  private tetraMarks(
    tetra: TetraActor,
    beat: string,
    local: number,
    frame: FrameInfo,
    jumped: boolean,
  ): void {
    const marks = this.marks;
    const g = this.geo;
    if (!marks || jumped || frame.dt <= 0 || this.tetraFrames <= 3) return;
    const m = tetra.marks();
    if (beat === "run") {
      this.anchorA.x = m.head.x;
      this.anchorA.y = m.head.y + 0.1 * g.tetraH;
      this.steam?.update(this.anchorA, 0.8, Math.PI / 2);
      this.anchorB.x = m.chest.x - 0.8 * g.tetraH;
      this.anchorB.y = m.chest.y;
      this.speedTetra?.update(this.anchorB, 0.6, Math.PI);
      if (frame.time - this.dustAt > 0.2) {
        this.dustAt = frame.time;
        marks.emit("dust", { at: { x: m.ground.x, y: m.ground.y }, size: 0.1 * g.tetraH });
      }
      if (frame.time - this.veinAt > 0.9) {
        this.veinAt = frame.time;
        marks.emit("vein", {
          at: { x: m.head.x + 0.08 * g.tetraH, y: m.head.y },
          offset: { x: 0, y: 0.1 * g.tetraH },
          size: 0.12 * g.tetraH,
        });
      }
    } else if (beat === "pant") {
      this.anchorA.x = m.head.x;
      this.anchorA.y = m.head.y;
      this.steam?.update(this.anchorA, 1, Math.PI / 4);
      if (frame.time - this.sweatAt > 0.7) {
        this.sweatAt = frame.time;
        marks.emit("sweat", {
          at: { x: m.head.x, y: m.head.y },
          offset: { x: 0.1 * g.tetraH, y: 0.04 * g.tetraH },
          size: 0.08 * g.tetraH,
          count: 2,
        });
        marks.emit("cloud", {
          at: { x: m.head.x, y: m.head.y },
          offset: { x: -0.12 * g.tetraH, y: 0.1 * g.tetraH },
          size: 0.16 * g.tetraH,
        });
      }
    } else if (beat === "wave" && frame.time - this.sweatAt > 1.2) {
      this.sweatAt = frame.time;
      marks.emit("sweat", {
        at: { x: m.head.x, y: m.head.y },
        offset: { x: 0.1 * g.tetraH, y: 0.04 * g.tetraH },
        size: 0.08 * g.tetraH,
      });
    }
    void local;
    void lerp;
  }

  dispose(): void {
    this.disposed = true;
    this.ctx.dom.text.removeEventListener("focusin", this.onFocusIn);
    this.ctx.dom.text.removeEventListener("focusout", this.onFocusOut);
    this.tetra?.book.onPress(null);
    this.tetra?.book.setCovers(null, null);
    for (const t of this.textures) t.dispose();
    this.textures.length = 0;
    for (const el of [this.word, this.cards.left, this.cards.right, this.cta, this.content]) {
      put(el, "opacity", "");
      put(el, "transform", "");
    }
    for (const el of this.anchors) el.style.pointerEvents = "";
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new ChaseRuntime(ctx);
}
