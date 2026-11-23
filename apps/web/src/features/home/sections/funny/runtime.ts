import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { DollActor } from "../../actors/doll";
import type { DuoActor } from "../../actors/duo";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { KiteShot } from "../../actors/tetra/props/kite-shot";
import type { TetraActor } from "../../actors/tetra";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd } from "../../kernel/where";
import { ScrollTravel } from "../travel";
import { storyAt } from "./stations";
import {
  GONE,
  T,
  bob,
  cutMoment,
  dragonOnScreen,
  dragonX,
  geometry,
  lerp,
  lift,
  line,
  ramp,
  tetraPlace,
  type FunnyGeometry,
  type Spot,
} from "./timeline";

/** The dragon turned three quarters toward us, heading left. */
const YAW = -1.1;
/** The doll's mood while she is eaten: a loop of her cursing and screaming (seconds). */
const MOODS = [
  { face: "cursing", hold: 0.7 },
  { face: "scream", hold: 0.5, blend: 0.1 },
  { face: "angry", hold: 0.4, blend: 0.1 },
  { face: "cursing", hold: 0.8, blend: 0.1 },
] as const;
const MOOD_LOOP = 2.6;
/** A step of `local` this big in a frame is a jump (a scrollbar drag, a probe seek). */
const JUMP = 0.12;

const spot = (): Spot => ({ x: 0, y: 0, height: 0 });

/**
 * The funny section: Tetra flies a kite, Silverbolt crosses with the doll cursing in its mouth and
 * breaks the rope, Tetra runs off after it, the two drones stare, go to the middle and question each
 * other. Every frame is a pure function of `local`, the size of the screen and the section's own
 * small state (the cut, the marks already thrown). The actors are shared: each is set in full, every
 * frame it is shown. Tetra and her kite rise into view as Music scrolls up.
 */
class FunnyRuntime implements SectionRuntime {
  private tetra: TetraActor | null = null;
  private dragon: SilverboltActor | null = null;
  private doll: DollActor | null = null;
  private duo: DuoActor | null = null;
  private marks: MarksActor | null = null;
  private disposed = false;

  private readonly content: HTMLElement | null;
  private readonly links: HTMLElement[];
  private linksLive = true;
  private shownAmount = Number.NaN;
  private shownRise = Number.NaN;
  private shownH = Number.NaN;

  private geo: FunnyGeometry;
  private cutAt: ReturnType<typeof cutMoment>;
  private readonly travel = new ScrollTravel();
  private lastLocal = Number.NaN;
  private readonly kiteShot: KiteShot = {
    offsetY: 0,
    along: 0.5,
    releaseHand: { x: 0, y: 0 },
    pressure: 0,
    broken: false,
    fall: 0,
    nose: (out) => {
      const g = this.geo;
      const cut = this.cutAt.local;
      const local = Math.min(this.lastLocal, cut);
      if (this.dragon?.visible) {
        this.dragon.snoutOnStage(out);
        // After release the free ends spring from the impact site as the dragon keeps flying.
        out.x += dragonX(local, g, this.cutAt) - dragonX(this.lastLocal, g, this.cutAt);
      } else {
        out.x = dragonX(local, g, this.cutAt) - g.dragon.headLead * this.travel.heading;
        out.y = g.dragon.y + 0.2 * g.dragon.height;
      }
    },
  };

  private readonly tp = { x: 0, y: 0, running: false, speed: 0, arrive: 0, leave: 0 };
  private readonly aim = { x: 0, y: 0 };
  private readonly pa: Spot = spot();
  private readonly pb: Spot = spot();

  /** A control of the section has the keyboard's focus: its words stay shown wherever the scroll is. */
  private kbd = false;
  private readonly onFocusIn = (): void => {
    this.kbd = true;
  };
  private readonly onFocusOut = (e: FocusEvent): void => {
    const to = e.relatedTarget;
    if (!(to instanceof Node) || !this.ctx.dom.text.contains(to)) this.kbd = false;
  };

  /** Every actor has arrived or failed for good. */
  private loaded = false;

  constructor(private readonly ctx: SectionCtx) {
    ctx.dom.text.addEventListener("focusin", this.onFocusIn);
    ctx.dom.text.addEventListener("focusout", this.onFocusOut);
    // The page moved here because a control took the focus: the runtime arrives after that event.
    this.kbd = ctx.dom.text.contains(document.activeElement);
    this.content = ctx.dom.text.querySelector<HTMLElement>("[data-home-content]");
    this.links = Array.from(ctx.dom.text.querySelectorAll<HTMLElement>("a"));
    const v = ctx.viewport();
    this.geo = geometry(v.w, v.h);
    this.cutAt = cutMoment(this.geo);
    void this.load();
  }

  /** Build or find every actor; each one that arrives is used from the next frame, whatever the others do. */
  private async load(): Promise<void> {
    const ctx = this.ctx;
    const take = async <A>(what: string, make: () => Promise<A>, set: (a: A) => void) => {
      try {
        const a = await make();
        if (!this.disposed) set(a);
      } catch (error) {
        console.warn(`[home funny] ${what} did not load`, error);
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
      take(
        "the duo",
        async () => (await import("../../actors/duo")).ensureDuo(ctx),
        (a) => (this.duo = a),
      ),
    ]);
    this.loaded = true;
  }

  /** The ready gate: the scenes need Tetra, the dragon, the doll and the duo built. */
  ready(): boolean {
    return this.loaded;
  }

  enter(): void {
    this.travel.reset();
    this.lastLocal = Number.NaN;
    this.dragon?.calm();
    this.duo?.setMarkSink(null);
  }

  leave(): void {
    this.tetra?.kite.fly(null);
    this.tetra?.runSpeed(0);
    // The doll leaves the dragon's mouth with the section: the earlier sections place her on their own.
    if (this.doll?.parentSocket) this.doll.detach();
  }

  update(scroll: number, frame: FrameInfo): void {
    const local = storyAt(scroll);
    this.travel.update(frame, scroll > 0.5);
    const { w, h } = frame.viewport;
    if (w !== this.geo.w || h !== this.geo.h) {
      this.geo = geometry(w, h);
      this.cutAt = cutMoment(this.geo);
    }
    const snapped =
      this.lastLocal < this.cutAt.local &&
      local >= this.cutAt.local &&
      local - this.lastLocal < JUMP;
    this.lastLocal = local;
    if (local < 0) {
      this.words(0, 0, h);
      this.drawTetra(0, false, (frame.S - sectionEnd("music")) * h);
      return;
    }
    // The page rides up in the tail, by the real scroll: the duo and the words are gone for any jump.
    const rise = lift(frame.S - sectionEnd("funny"));
    const gone = 1 - ramp(rise, GONE - 0.2, GONE);
    this.words((this.kbd ? 1 : ramp(local, T.textFrom, T.textTo)) * gone, rise, h);
    if (rise >= GONE) return;
    this.drawDragon(local, frame.time);
    this.drawTetra(local, snapped);
    this.drawDuo(local, rise);
  }

  // ---------------------------------------------------------------------------------------- words

  /** The words: an amount 0 to 1 and how far the page has risen (screens). */
  private words(amount: number, rise: number, h: number): void {
    // Nothing is formatted or written while the words stand still.
    if (amount === this.shownAmount && rise === this.shownRise && h === this.shownH) return;
    this.shownAmount = amount;
    this.shownRise = rise;
    this.shownH = h;
    put(this.content, "opacity", String(Number(amount.toFixed(3))));
    put(
      this.content,
      "transform",
      rise > 0 ? `translate3d(0, ${(-rise * h).toFixed(1)}px, 0)` : "none",
    );
    const live = amount > 0.05;
    if (live !== this.linksLive) {
      this.linksLive = live;
      for (const a of this.links) a.style.pointerEvents = live ? "" : "none";
    }
  }

  // ---------------------------------------------------------------------------------------- Tetra

  private drawTetra(local: number, snapped: boolean, offsetY = 0): void {
    const tetra = this.tetra;
    if (!tetra) return;
    const g = this.geo;
    const { contact, local: cut, at } = this.cutAt;
    if (local >= Math.max(cut + T.kiteGone, T.dragonOut)) {
      tetra.kite.fly(null);
      return;
    }
    const p = tetraPlace(local, g, cut, this.tp);
    const pressure = ramp(local, contact - 0.008, contact + 0.008);
    const release = line(local, cut, cut + T.kiteGone);
    const brace = pressure * (1 - ramp(local, cut, cut + 0.025));
    // Returning from below, she enters from the left behind the dragon and finishes at the reel.
    const left = -g.w / 2 - g.tetra.height * 0.6 - 40;
    const behind = dragonX(local, g, this.cutAt) - g.dragon.height * 1.12 - g.w * 0.13;
    const returningX = Math.max(left, Math.min(g.tetra.x, behind));
    const follow = this.travel.reverse;
    const x = lerp(p.x, returningX, follow);
    const outward = ramp(local, cut + T.runFrom - 0.018, cut + T.runFrom + 0.015);
    const inward = ramp(g.tetra.x - returningX, 0, g.tetra.height * 0.24);
    const run = lerp(outward, inward, follow);
    tetra.visible = true;
    tetra.place({
      x: x - brace * g.tetra.height * 0.045,
      y: p.y + offsetY,
      height: g.tetra.height,
      yaw: lerp(-0.22, this.travel.runYaw(-1), run),
    });
    tetra.look(null);
    tetra.setInteractive(local < contact);
    tetra.setReel(false);
    tetra.runSpeed(lerp(p.speed, 0.84, follow));
    tetra.pose("run", run, "kite");
    if (local >= cut) tetra.setFace("angry", 1);
    else if (local >= contact - 0.015) tetra.setFace("surprised", 1);
    else tetra.setFace("happy", 0.7);

    const shot = this.kiteShot;
    shot.offsetY = offsetY;
    shot.along = at;
    shot.releaseHand.x = g.tetra.x - 0.12 * g.tetra.height;
    shot.releaseHand.y = g.tetra.y + 0.5 * g.tetra.height;
    shot.pressure = pressure;
    shot.broken = local >= cut;
    shot.fall = release;
    // The wind carries the sail. The nose pulls the knot a little closer before the string breaks.
    tetra.kite.fly(
      {
        x: g.kite.x - g.kite.height * 0.16 * ramp(local, contact, cut),
        y: g.kite.y,
        height: g.kite.height,
      },
      shot,
    );

    if (snapped && this.marks) {
      const hit = { x: 0, y: 0 };
      shot.nose(hit);
      this.marks.emit("spark", { at: hit, size: g.kite.height * 0.18, count: 1 });
    }
  }

  // ---------------------------------------------------------------------------------------- the dragon

  private drawDragon(local: number, time: number): void {
    const sb = this.dragon;
    const doll = this.doll;
    if (!sb || !doll || !dragonOnScreen(local)) return;
    const g = this.geo;
    const flight = time;
    const b = bob(flight, g);
    const x = dragonX(local, g, this.cutAt);
    sb.visible = true;
    sb.place({
      x,
      y: b.y,
      z: 0,
      height: g.dragon.height,
      yaw: YAW * this.travel.heading,
      pitch: b.pitch,
      roll: b.roll,
    });
    sb.fly(flight, { amplitude: 1, speed: 1 });
    sb.face("smile", 1);
    const chew = Math.cos(time * 4.5);
    sb.jaw(0.56 + 0.07 * chew);
    sb.follow(0);
    sb.look(x - 900 * this.travel.heading, b.y);

    // Her body rides between the teeth while her face stays turned toward the viewer.
    doll.visible = true;
    doll.reset();
    doll.placeInScene(sb.socket("mouth"), {
      x: 0.065 * this.travel.heading,
      y: 0.025,
      z: 0.04,
      height: 0.4 * g.dragon.height,
      stageRotation: true,
      yaw: 0.14 * Math.sin(time * 3.4),
      roll: 0.14 + 0.09 * chew,
      pivot: "center",
    });
    doll.pose("scream", 1);
    doll.flail(0.53, 2.4, time);
    doll.mood(MOODS, time % MOOD_LOOP);
    doll.talk(0.55 + 0.45 * Math.sin(time * 13));
    doll.blinkAuto(false);
  }

  // ---------------------------------------------------------------------------------------- the duo

  private drawDuo(local: number, rise: number): void {
    const duo = this.duo;
    if (!duo) return;
    const g = this.geo;
    const c = ramp(local, T.centreFrom, T.centreTo);
    const up = rise * g.h;
    const a = this.pa;
    const b = this.pb;
    a.x = lerp(g.watch[0].x, g.centre[0].x, c);
    a.y = lerp(g.watch[0].y, g.centre[0].y, c) + up;
    a.height = lerp(g.watch[0].height, g.centre[0].height, c);
    b.x = lerp(g.watch[1].x, g.centre[1].x, c);
    b.y = lerp(g.watch[1].y, g.centre[1].y, c) + up;
    b.height = lerp(g.watch[1].height, g.centre[1].height, c);
    duo.visible = true;
    duo.place(a, b);

    // What they look at: Tetra, then the dragon's head, then each other (no target).
    const aim = this.aim;
    const dragonOn = dragonOnScreen(local);
    if (dragonOn) {
      aim.x = dragonX(local, g, this.cutAt) - g.dragon.headLead * this.travel.heading;
      aim.y = g.dragon.y;
    } else {
      aim.x = g.tetra.x;
      aim.y = g.tetra.y + 0.8 * g.tetra.height;
    }
    // The poses take turns, each in and out at no weight, so a change never pops.
    if (local >= T.questionFrom) {
      duo.pose("question", ramp(local, T.questionFrom, T.questionFrom + 0.05));
    } else if (local >= T.confusedFrom) {
      const w =
        ramp(local, T.confusedFrom, T.confusedTo) *
        (1 - ramp(local, T.questionFrom - 0.04, T.questionFrom));
      duo.pose("confused", w, { target: dragonOn ? aim : null });
    } else if (local >= T.watchFrom) {
      const w =
        ramp(local, T.watchFrom, T.watchFrom + 0.04) *
        (1 - ramp(local, T.confusedFrom - 0.03, T.confusedFrom));
      duo.pose("stare", w, { target: aim });
    } else {
      duo.pose("float", 1, { target: aim });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.ctx.dom.text.removeEventListener("focusin", this.onFocusIn);
    this.ctx.dom.text.removeEventListener("focusout", this.onFocusOut);
    this.leave();
    put(this.content, "opacity", "");
    put(this.content, "transform", "");
    for (const a of this.links) a.style.pointerEvents = "";
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new FunnyRuntime(ctx);
}
