import { SRGBColorSpace, Texture } from "three";

import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { DollActor } from "../../actors/doll";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { TetraActor } from "../../actors/tetra";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd } from "../../kernel/where";
import { ScrollTravel } from "../travel";
import { coverBitmap, loadCovers, type CoverSide } from "./covers";
import {
  T,
  dollPlace,
  dragonPlace,
  geometry,
  lerp,
  poseAt,
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

  private wasPanting = false;
  private pageAt = 0;
  private readonly travel = new ScrollTravel();
  private returnDragonX = 0;
  private lastLocal = Number.NaN;
  private readonly dp = { x: 0, y: 0, dist: 0, on: false };
  private readonly bp = { x: 0, y: 0, pitch: 0, roll: 0, on: false };
  private readonly tr = { x: 0, y: 0, speed: 0, running: false };
  private readonly ts = { x: 0, y: 0, height: 0 };
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

  /** Every actor has arrived or failed for good. */
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
        (a) => (this.marks = a),
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
    this.travel.reset();
    this.entered = true;
    this.wasPanting = false;
    this.lastLocal = Number.NaN;
    this.dragon?.calm();
    this.bindBook();
  }

  leave(): void {
    this.entered = false;
    this.tetra?.book.auto();
    this.tetra?.book.onPress(null);
    if (!this.kbd) this.words(0);
  }

  update(local: number, frame: FrameInfo): void {
    this.travel.update(frame, local > T.tetraTo);
    const { w, h } = frame.viewport;
    if (w !== this.geo.w || h !== this.geo.h) this.geo = geometry(w, h);
    const jumped = Number.isNaN(this.lastLocal) || Math.abs(local - this.lastLocal) > 0.12;
    this.lastLocal = local;
    // Nothing is written before the section's own start: the funny section's drones ride out first.
    if (local < 0) {
      this.words(0);
      return;
    }
    // The words come in with the second zone and go with the scroll after the section (`frame.S`),
    // so a section passed by a jump (replayed at its last station) shows none.
    const gone = wordsLeave(frame.S, sectionEnd("chase"));
    this.words(this.kbd ? 1 : wordsAmount(local) * (1 - gone));
    this.drawDoll(local, frame);
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

  private drawDoll(local: number, frame: FrameInfo): void {
    const doll = this.doll;
    const g = this.geo;
    if (!doll || local < T.dollFrom || local > T.tetraTo) return;
    const reverseX = -dollPlace(T.tetraTo + T.dollFrom - local, g, this.dp).x;
    const d = dollPlace(local, g, this.dp);
    const x = lerp(d.x, reverseX, this.travel.reverse);
    if (Math.abs(x) > g.w / 2 + g.dollH * 0.49 + 30) return;
    // The funny section had her in the dragon's mouth: she is her own again.
    if (doll.parentSocket) doll.detach();
    doll.visible = true;
    doll.reset();
    doll.place({
      x,
      y: g.floor + 0.015 * g.dollH * Math.abs(Math.sin(frame.time * 10)),
      z: 24,
      height: g.dollH,
      yaw: DOLL_YAW * this.travel.heading,
    });
    doll.pose("run", 1);
    doll.walk(1, { rate: 1.65, lean: 1 });
    doll.mood(SCARED, frame.time % SCARED_LOOP);
    doll.talk(0.6 + 0.4 * Math.sin(frame.time * 11));
    doll.blinkAuto(false);
  }

  // ---------------------------------------------------------------------------------------- the dragon

  private drawDragon(local: number, frame: FrameInfo): void {
    const sb = this.dragon;
    const g = this.geo;
    const mirrored = dragonPlace(T.tetraTo + T.dollFrom - local, g, this.bp);
    this.returnDragonX = -mirrored.x;
    if (!sb || local < T.dollFrom || local > T.tetraTo) return;
    const b = dragonPlace(local, g, this.bp);
    const limit = g.w / 2 + g.dragonH * 3.5 + 32;
    const bound = (v: number) => Math.max(-limit, Math.min(limit, v));
    const x = lerp(bound(b.x), bound(this.returnDragonX), this.travel.reverse);
    if (Math.abs(x) >= limit - 1) return;
    sb.visible = true;
    sb.place({
      x,
      y: b.y + Math.sin(frame.time * 3.1) * 0.048 * g.dragonH,
      z: 0,
      height: g.dragonH,
      yaw: YAW * this.travel.heading,
      pitch: b.pitch,
      roll: b.roll + 0.15 * (1 - this.travel.heading ** 2),
    });
    sb.fly(frame.time, { amplitude: 1.25, speed: 1.3 });
    sb.face("growl", 0.7);
    // It snaps at her: the jaw opens wide and shuts again, three times a second.
    sb.jaw(0.5 + 0.5 * Math.abs(Math.sin(frame.time * Math.PI * 3)));
    sb.follow(0);
    sb.look(x + 900 * this.travel.heading, b.y - 0.3 * g.dragonH);
  }

  // ---------------------------------------------------------------------------------------- Tetra

  private drawTetra(local: number, frame: FrameInfo, jumped: boolean): void {
    const tetra = this.tetra;
    const g = this.geo;
    if (!tetra || local < T.dollFrom) return;
    const run = tetraRun(local, g, this.tr);
    const stand = tetraStand(local, g, this.ts);
    const stopped = local >= T.tetraTo;
    const left = -g.w / 2 - 0.5 * g.tetraH - 40;
    // Wait for the returning pair to pass, then fall in behind the tail.
    const returning = Math.max(
      left,
      Math.min(0, this.returnDragonX + g.dragonH * 2.0 + g.w * 0.12),
    );
    const x = stopped ? stand.x : lerp(run.x, returning, this.travel.reverse);
    const chase = lerp(1, ramp(-returning, 0, g.tetraH * 0.12), this.travel.reverse);
    const stride = chase * (1 - ramp(local, T.tetraTo - 0.027, T.tetraTo + 0.014));

    tetra.visible = true;
    tetra.kite.fly(null);
    tetra.setReel(false);
    tetra.place({
      x,
      y: stopped ? stand.y : run.y,
      height: stopped ? stand.height : g.tetraH,
      yaw: this.travel.runYaw(1) * stride,
    });
    tetra.look("pointer");
    tetra.setInteractive(true);
    tetra.runSpeed(lerp(run.speed, 0.85, this.travel.reverse));
    const panting = local >= T.tetraTo && local < T.panted;
    if (panting && !this.wasPanting && !jumped) {
      const head = tetra.marks().head;
      this.marks?.emit("sweat", { at: { x: head.x, y: head.y }, size: 0.075 * g.tetraH, count: 1 });
    }
    this.wasPanting = panting;
    const pose = poseAt(local);
    if (pose.name === "run") tetra.pose("run", chase, "pant");
    else tetra.pose(pose.name, ramp(local, pose.start, pose.end), pose.from);
    const open = ramp(local, 0.789, 0.832);
    tetra.book.scene(ramp(local, 0.716, 0.731), open, open);
    tetra.setFace(null);
    if (open === 1 && !jumped && frame.dt > 0 && frame.time - this.pageAt > PAGE_EVERY) {
      this.pageAt = frame.time;
      tetra.book.turnPage();
    }
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
