import { put } from "@/features/character/vexana/seams/scroll-kit";

import { dampTo, type Damped } from "../../actors/buddies/smooth";
import type { DollActor } from "../../actors/doll";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { TetraActor } from "../../actors/tetra";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd, sectionStart } from "../../kernel/where";
import { ScrollTravel } from "../travel";
import { type CoverSide } from "./covers";
import { TetraPath } from "./tetra-path";
import {
  DRAGON_LENGTH,
  HEAD_LEAD,
  T,
  dragonPlace,
  geometry,
  pairAt,
  poseAt,
  ramp,
  reachFor,
  RUN_ZONE,
  tetraRun,
  tetraStand,
  wordsAmount,
  wordsLeave,
  type ChaseGeometry,
  type Pair,
} from "./timeline";

/** The dragon heads right, turned three quarters toward us. */
const YAW = 1.1;
/** The doll runs side on, facing right. */
const DOLL_YAW = 0.5;
/**
 * The doll's face while she runs for her life (25 Nov 2026): a loop of quick, different fears, each one
 * on her face for a fraction of a second, so it never settles. She is scared, screams, goes wide eyed,
 * cries, begs, and screams again.
 */
const SCARED = [
  { face: "scared", hold: 0.26 },
  { face: "scream", hold: 0.34, blend: 0.07 },
  { face: "shocked", hold: 0.2, blend: 0.07 },
  { face: "crying", hold: 0.3, blend: 0.08 },
  { face: "worried", hold: 0.22, blend: 0.08 },
  { face: "scream", hold: 0.3, blend: 0.06 },
  { face: "scared", hold: 0.18, blend: 0.07 },
  { face: "crying", hold: 0.26, blend: 0.08 },
] as const;
const SCARED_LOOP = 2.41;
/** The doll's strides: cycles a second (a cycle is two strides). A run for her life is quick. */
const SPRINT_RATE = 3.2;
/** How high a stride throws her, as a share of her height, and how much she squashes and stretches. */
const BOUNCE = 0.11;
/** She looks back at the dragon this often (radians a second of the glance's wave). */
const GLANCE = 3.9;

/**
 * The chase and the comic: the doll runs for her life, Silverbolt chases her, Tetra chases both and
 * runs out of breath in the middle, pants, waves, sits and reads; the camera comes in on her and the
 * giant word COMIC, the two comics and the button arrive behind and beside her, then leave. Every
 * frame is a pure function of `local`, the size of the screen and the section's small state (the
 * page last turned). Nothing is written before the section's own start (the funny
 * section's drones are still riding out of the screen) and every actor is set in full each frame.
 */
class ChaseRuntime implements SectionRuntime {
  private tetra: TetraActor | null = null;
  private dragon: SilverboltActor | null = null;
  private doll: DollActor | null = null;
  private disposed = false;
  private entered = false;

  private readonly content: HTMLElement | null;
  private readonly word: HTMLElement | null;
  private readonly cards: Record<CoverSide, HTMLElement | null>;
  private readonly cta: HTMLElement | null;
  private readonly anchors: HTMLElement[];
  private linksLive = true;
  private shownAmount = Number.NaN;

  private geo: ChaseGeometry;

  private readonly path = new TetraPath();
  private readonly dir: Damped = { x: 0, v: 0 };
  private readonly runShare: Damped = { x: 1, v: 0 };
  private returnTail = 0;
  private readonly travel = new ScrollTravel();
  private lastLocal = Number.NaN;
  private readonly pair: Pair = { dollX: 0, dragonX: 0, dollZ: 0, dragonZ: 0, heading: 1 };
  private readonly back: Pair = { dollX: 0, dragonX: 0, dollZ: 0, dragonZ: 0, heading: -1 };
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
    this.cards = { left: card("left"), right: card("right") };
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
    if (this.entered) this.bindBook();
  }

  /**
   * A press on the book (either board) follows the real link to all the comics (the page change goes
   * through the site's transition): the book carries no picture, so it does not say which comic.
   */
  private bindBook(): void {
    const tetra = this.tetra;
    if (!tetra) return;
    tetra.book.labels("READ", "READ");
    tetra.book.onPress(() => {
      this.cta?.querySelector<HTMLElement>("a")?.click();
    });
  }

  enter(): void {
    this.travel.reset();
    this.path.reset();
    this.dir.x = 0;
    this.dir.v = 0;
    this.runShare.x = 1;
    this.runShare.v = 0;
    this.entered = true;
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
    // The pair is one formation: forward as the scroll goes, and turned about its middle when it
    // goes back. The same formation at its full turn is where the returning Tetra falls in behind.
    // Before the run's zone the story stays at its start but the scroll goes on: the pair that
    // walks out to the left on a scroll back keeps walking until all of it, tail included, is gone.
    const early = sectionStart("chase") + RUN_ZONE.at - frame.S;
    const pairAtClock = reachFor(local, early);
    pairAt(pairAtClock, this.geo, this.travel.reverse, this.pair);
    pairAt(pairAtClock, this.geo, 1, this.back);
    // Heading left the dragon's tail is on its right: the end of it is where Tetra waits until it has gone by.
    this.returnTail = this.back.dragonX + (DRAGON_LENGTH - HEAD_LEAD) * this.geo.dragonH;
    this.drawDoll(pairAtClock, frame);
    this.drawDragon(pairAtClock, frame);
    this.drawTetra(local, jumped, frame);
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
    if (!doll || local > T.tetraTo) return;
    const pair = this.pair;
    const x = pair.dollX;
    if (Math.abs(x) > g.w / 2 + g.dollH * 0.49 + 30) return;
    // The funny section had her in the dragon's mouth: she is her own again.
    if (doll.parentSocket) doll.detach();
    doll.visible = true;
    doll.reset();
    // A cartoon sprint (25 Nov 2026): the stride is the clock's, so she runs at full tilt whatever the
    // scroll does. Every footfall throws her up (`air`) and she lands squashed.
    const phase = frame.time * SPRINT_RATE;
    const air = Math.abs(Math.sin(phase * Math.PI * 2));
    doll.place({
      x,
      y: g.floor + BOUNCE * g.dollH * air,
      z: 24 + pair.dollZ,
      height: g.dollH,
      yaw: DOLL_YAW * pair.heading,
      // Her whole body leans into the run, and rocks a little with each stride.
      roll: -(0.2 + 0.07 * Math.sin(phase * Math.PI * 2)) * pair.heading,
    });
    doll.pose("stand", 1);
    doll.walk(0);
    doll.sprint(1, phase);
    doll.squash(0.12 * air - 0.2 * (1 - air) ** 2);
    doll.mood(SCARED, frame.time % SCARED_LOOP);
    // She screams and gabbles with the footfalls, and looks back at the jaws behind her, then ahead
    // for a way out, then back again.
    doll.talk(0.55 + 0.45 * Math.sin(frame.time * 14));
    doll.blinkAuto(false);
    const glance = 0.5 + 0.5 * Math.sin(frame.time * GLANCE);
    const jaws = pair.dragonX + HEAD_LEAD * g.dragonH * pair.heading;
    const ahead = x + 900 * pair.heading;
    doll.look({
      x: ahead + (jaws - ahead) * glance * glance,
      y: g.floor + g.dollH * (0.55 + 0.1 * (1 - glance)),
    });
  }

  // ---------------------------------------------------------------------------------------- the dragon

  private drawDragon(local: number, frame: FrameInfo): void {
    const sb = this.dragon;
    const g = this.geo;
    if (!sb || local > T.tetraTo) return;
    const pair = this.pair;
    const b = dragonPlace(local, g, this.bp);
    const limit = g.w / 2 + g.dragonH * 3.5 + 32;
    const x = pair.dragonX;
    if (Math.abs(x) >= limit - 1) return;
    sb.visible = true;
    sb.place({
      x,
      y: b.y + Math.sin(frame.time * 3.1) * 0.048 * g.dragonH,
      z: pair.dragonZ,
      height: g.dragonH,
      yaw: YAW * pair.heading,
      pitch: b.pitch,
      roll: b.roll + 0.15 * (1 - pair.heading ** 2),
    });
    sb.fly(frame.time, { amplitude: 1.25, speed: 1.3 });
    sb.face("growl", 0.7);
    // It snaps at her: the jaw opens wide and shuts again, three times a second.
    sb.jaw(0.5 + 0.5 * Math.abs(Math.sin(frame.time * Math.PI * 3)));
    sb.follow(0);
    sb.look(x + 900 * pair.heading, b.y - 0.3 * g.dragonH);
  }

  // ---------------------------------------------------------------------------------------- Tetra

  private drawTetra(local: number, jumped: boolean, frame: FrameInfo): void {
    const tetra = this.tetra;
    const g = this.geo;
    // She is not cut off at the start of the story: on a scroll back she goes on running to the left
    // behind the pair's tail until she is off the screen. She is not drawn only when she is there
    // already (before her entrance she waits off the left edge).
    if (!tetra) return;
    const dt = frame.dt;
    const run = tetraRun(local, g, this.tr);
    const stand = tetraStand(local, g, this.ts);
    const stopped = local >= T.tetraTo;
    const left = -g.w / 2 - 0.5 * g.tetraH - 40;
    // Going back she does not turn with the pair: she stops where she is, out of breath, lets them
    // pass, and runs after the tail (`tetra-path.ts`).
    // Once she has stopped (the pant, the wave, the seat, the book) the direction of the scroll does not
    // move her: the comic stands whichever way the visitor turns.
    const backward = !stopped && this.travel.backward && this.travel.reverse > 0.02;
    const behind = Math.max(left, this.returnTail + 0.3 * g.tetraH);
    const x = this.path.step({
      forwardX: stopped ? stand.x : run.x,
      behindX: behind,
      backward,
      corner: 0.2 * g.tetraH,
      dt,
      jumped,
    });
    if (!stopped && x <= left) return;
    // How much of her is running: all of it going down, and what her speed says going back (so she
    // slows into a stop and speeds into the chase, and pants in between).
    const runTarget = backward ? Math.min(1, Math.abs(this.path.speed) / (0.45 * g.tetraH)) : 1;
    const runShare = dampTo(this.runShare, runTarget, 0.2, 99, dt);
    // Which way she faces follows her own movement, slowly: no sudden turn.
    const dirTarget = backward
      ? Math.max(-1, Math.min(1, this.path.speed / (0.45 * g.tetraH)))
      : 1 - ramp(local, T.tetraTo - 0.027, T.tetraTo + 0.014);
    const dir = dampTo(this.dir, dirTarget, 0.24, 99, dt);
    // Waiting for the pair, she steps toward the camera so they run past behind her.
    const wait = backward ? 1 - runShare : 0;

    // The run pose turns her hips by 0.62: take it off only as far as the run pose is worn (the pant
    // blends out of it), so a pose with no hip turn is never rotated by it.
    const pose = poseAt(local);
    const runWeight =
      pose.name === "run"
        ? runShare
        : pose.name === "pant"
          ? 1 - ramp(local, pose.start, pose.end)
          : 0;
    tetra.visible = true;
    tetra.place({
      x,
      y: stopped ? stand.y : run.y,
      z: 46 * wait,
      height: stopped ? stand.height : g.tetraH,
      yaw: dir * 1.49 - 0.62 * runWeight,
    });
    // She watches the doll go by while she waits.
    if (backward && runShare < 0.6) {
      tetra.look({ x: this.pair.dollX, y: g.floor + 0.5 * g.dollH });
    } else {
      tetra.look("pointer");
    }
    tetra.setInteractive(true);
    tetra.runSpeed(runShare * (backward ? 0.85 : run.speed));
    // Her breath is in her body and her face: no comic mark floats over her (the owner, 25 Nov 2026).
    if (pose.name === "run") {
      tetra.poseMix([
        ["run", runShare],
        ["pant", 1 - runShare],
      ]);
    } else {
      tetra.pose(pose.name, ramp(local, pose.start, pose.end), pose.from);
    }
    // The book comes out of the pocket, comes to her chest and into both hands, and then opens: three
    // steps that overlap, each over its own stretch of the scroll, so no part of it snaps.
    tetra.book.scene(
      ramp(local, T.bookOutFrom, T.bookOutTo),
      ramp(local, T.openFrom, T.openTo),
      ramp(local, T.bookInFrom, T.bookInTo),
    );
    tetra.setFace(null);
  }

  dispose(): void {
    this.disposed = true;
    this.ctx.dom.text.removeEventListener("focusin", this.onFocusIn);
    this.ctx.dom.text.removeEventListener("focusout", this.onFocusOut);
    this.tetra?.book.onPress(null);
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
