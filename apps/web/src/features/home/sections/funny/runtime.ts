import { put } from "@/features/character/vexana/seams/scroll-kit";

import type { DollActor } from "../../actors/doll";
import { DOLL_SIZE } from "../../actors/doll/place";
import type { DuoActor } from "../../actors/duo";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { TetraActor } from "../../actors/tetra";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd } from "../../kernel/where";
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
/**
 * The doll is made bigger than the dragon's mouth: she is wedged in it, head and legs out. This is
 * the size she is DRAWN at, in mouths: the actor draws her at `DOLL_SIZE` of the height asked for, so
 * the height asked for is this over it (she was 1.7 mouths before the doll was made smaller, and a
 * 1.45 mouth doll is still wedged).
 */
const DOLL_SCALE = 1.45 / DOLL_SIZE;
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
 * frame it is shown, and nothing is written before the section's own start (`local` 0) or after the
 * cast has gone.
 */
class FunnyRuntime implements SectionRuntime {
  private tetra: TetraActor | null = null;
  private dragon: SilverboltActor | null = null;
  private doll: DollActor | null = null;
  private duo: DuoActor | null = null;
  private marks: MarksActor | null = null;
  private disposed = false;
  private backdrop: Backdrop | null = null;
  private entered = false;
  private sinkSet = false;

  private readonly content: HTMLElement | null;
  private readonly links: HTMLElement[];
  private linksLive = true;
  private shownAmount = Number.NaN;
  private shownRise = Number.NaN;
  private shownH = Number.NaN;

  private geo: FunnyGeometry;
  private cutAt = { local: 0.3, at: 0.5 };

  // The section's own small state.
  private cutDone = false;
  private settleFrames = 0;
  private lastLocal = Number.NaN;
  private dustAt = 0;
  private veinAt = 0;
  private bangPending = false;
  private kiteShown = false;
  /** Frames Tetra has been drawn in a row: her marks are stale before the third (they read 0, 0). */
  private tetraFrames = 0;

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

  /** Every actor has arrived or failed for good, and the backdrop's shaders are compiled. */
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
        "the backdrop",
        async () => {
          const a = await ensureBackdrop(ctx);
          // Compiled before the first play, so its first draw is no hitch inside the scene.
          await a.warm(["soft-aurora", "light-rays"]).catch(() => undefined);
          return a;
        },
        (a) => {
          this.backdrop = a;
        },
      ),
      take(
        "the marks",
        async () => (await import("../../fx/comic-marks")).ensureMarks(ctx),
        (a) => (this.marks = a),
      ),
      take(
        "Tetra",
        async () => (await import("../../actors/tetra")).ensureTetra(ctx),
        (a) => {
          this.tetra = a;
          this.syncCut();
        },
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
    if (this.entered) void this.listen();
  }

  /** The ready gate: the scenes need Tetra, the dragon, the doll and the duo built. */
  ready(): boolean {
    return this.loaded;
  }

  enter(): void {
    this.entered = true;
    this.bangPending = false;
    this.lastLocal = Number.NaN;
    // The actor remembers a cut across a hide and a show: the flag follows it, so a visit that comes
    // back above the cut mends the rope (the marks of the neighbours are left alone: only a jump clears).
    this.syncCut();
    this.dragon?.calm();
    void this.listen();
  }

  leave(): void {
    this.entered = false;
    this.sinkSet = false;
    this.duo?.setMarkSink(null);
    // The doll leaves the dragon's mouth with the section: the earlier sections place her on their own.
    if (this.doll?.parentSocket) this.doll.detach();
  }

  /** Whether the actor's rope is cut, read once (on entering and when Tetra arrives). */
  private syncCut(): void {
    if (this.tetra) this.cutDone = this.tetra.kite.state().state === "cut";
  }

  /** The duo's cues become the home's comic marks (the one sink the duo has). */
  private async listen(): Promise<void> {
    const duo = this.duo;
    const marks = this.marks;
    if (!duo || !marks || this.sinkSet) return;
    this.sinkSet = true;
    const { comicMark } = await import("../../actors/duo/marks-map");
    if (this.disposed || !this.entered) return;
    duo.setMarkSink((m) => {
      const c = comicMark(m);
      marks.emit(c.kind, {
        at: { x: m.x, y: m.y },
        size: c.size,
        color: c.color,
        rotation: c.rotation,
      });
    });
  }

  update(local: number, frame: FrameInfo): void {
    const { w, h } = frame.viewport;
    if (w !== this.geo.w || h !== this.geo.h) {
      this.geo = geometry(w, h);
      this.cutAt = cutMoment(this.geo);
    }
    const jumped = Number.isNaN(this.lastLocal) || Math.abs(local - this.lastLocal) > JUMP;
    this.lastLocal = local;
    // Nothing is written before the section's own start: the music is still on the stage.
    if (local < 0) {
      this.words(0, 0, h);
      return;
    }
    if (jumped) {
      this.tetraFrames = 0;
      // Only a seek that lands inside the scene clears: a slow entry through the lead or the tail
      // (local below 0 or above 1) must leave the neighbour's marks alone.
      if (local <= 1) this.marks?.clear();
    }
    // The page rides up in the tail, by the real scroll: the duo and the words are gone for any jump.
    const rise = lift(frame.S - sectionEnd("funny"));
    const gone = 1 - ramp(rise, GONE - 0.2, GONE);
    this.words((this.kbd ? 1 : ramp(local, T.textFrom, T.textTo)) * gone, rise, h);
    if (rise >= GONE) return;
    this.drawSky(local, gone);
    this.drawTetra(local, frame, jumped);
    this.drawDragon(local, frame);
    this.drawDuo(local, rise);
  }

  /** The live sky: soft light while Tetra flies her kite and the dragon crosses, rays for the question. */
  private drawSky(local: number, gone: number): void {
    const backdrop = this.backdrop;
    if (!backdrop) return;
    if (ramp(local, T.centreFrom, T.centreTo) > 0.5) {
      backdrop.set("light-rays", {
        theme: "daybreak",
        amount: 0.9 * gone,
        speed: 0.7,
      });
    } else {
      backdrop.set("soft-aurora", {
        theme: "daybreak",
        amount: 0.9 * gone,
        speed: 0.8,
        scale: 1.2,
      });
    }
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

  private drawTetra(local: number, frame: FrameInfo, jumped: boolean): void {
    const tetra = this.tetra;
    if (!tetra) return;
    const g = this.geo;
    const cut = this.cutAt.local;
    // She has run off and the kite is gone: nothing of hers is on the stage.
    if (local > cut + T.kiteGone + 0.02) {
      this.tetraFrames = 0;
      return;
    }
    const p = tetraPlace(local, g, cut, this.tp);
    this.tetraFrames++;

    // The rope is whole until the head meets it and cut after. Idempotent in `local`.
    const wantCut = local >= cut;
    if (wantCut && !this.cutDone) {
      this.cutDone = true;
      const near = tetra.kite.ropeNear(dragonX(cut, g) - g.dragon.headLead, g.dragon.y);
      tetra.kite.cut(near && near.dist < 90 ? near.at : this.cutAt.at, "fall");
      if (jumped) this.settleFrames = 2;
      else this.bangPending = true;
    } else if (!wantCut && this.cutDone) {
      this.cutDone = false;
      this.kiteShown = false;
      tetra.kite.mend();
    }
    if (this.settleFrames > 0 && --this.settleFrames === 0) tetra.kite.settle(4);

    tetra.visible = true;
    tetra.place({ x: p.x, y: p.y, height: g.tetra.height, flip: true });
    tetra.look("pointer");
    tetra.setInteractive(local < cut + T.runFrom);
    tetra.setReel(false);
    if (p.running) {
      tetra.pose("run", 1);
      tetra.runSpeed(p.speed);
    } else {
      tetra.pose("kite", 1);
      tetra.runSpeed(0);
    }
    // Her face: her own, then startled as the dragon comes, then furious.
    const startle = line(local, T.dragonIn, cut);
    if (local >= cut + 0.01) tetra.setFace("angry", 1);
    else if (startle > 0.6) tetra.setFace("surprised", 1);
    else tetra.setFace(null);

    // The kite: behind her while she runs in, then up in the sky, then down and away in a puff.
    const settled = ramp(local, T.enterEnd * 0.4, T.enterEnd + 0.04);
    const kx = lerp(p.x + 0.14 * g.w, g.kite.x, settled);
    const ky = lerp(g.tetra.y + 0.55 * g.tetra.height, g.kite.y, settled);
    tetra.kite.ground(null);
    const away = ramp(local, cut + T.kiteAway, cut + T.kiteGone);
    if (away < 0.97) {
      tetra.kite.fly({ x: kx, y: ky, height: Math.max(8, g.kite.height * (1 - away)) });
      this.kiteShown = true;
    } else {
      if (this.kiteShown && !jumped && this.marks) {
        const sail = tetra.kite.state().sail;
        this.marks.emit("poof", { at: { x: sail.x, y: sail.y }, size: 0.5 * g.kite.height });
      }
      this.kiteShown = false;
      tetra.kite.fly(null);
    }

    // Her run: dust at her feet and a vein over her head.
    const marks = this.marks;
    const inView = Math.abs(p.x) < g.w / 2 + 0.2 * g.tetra.height;
    if (marks && p.running && inView && this.tetraFrames > 3 && !jumped && frame.dt > 0) {
      const m = tetra.marks();
      if (frame.time - this.dustAt > 0.22) {
        this.dustAt = frame.time;
        // Behind her heels (she runs left), where she stands: not from her marks, which lag a frame.
        marks.emit("dust", {
          at: { x: p.x + 0.12 * g.tetra.height, y: p.y },
          size: 0.1 * g.tetra.height,
        });
      }
      if (local > cut + 0.015 && frame.time - this.veinAt > 0.9) {
        this.veinAt = frame.time;
        marks.emit("vein", {
          at: { x: m.head.x, y: m.head.y },
          offset: { x: 0, y: 0.1 * g.tetra.height },
          size: 0.12 * g.tetra.height,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------------------- the dragon

  private drawDragon(local: number, frame: FrameInfo): void {
    const sb = this.dragon;
    const doll = this.doll;
    if (!sb || !doll || !dragonOnScreen(local)) return;
    const g = this.geo;
    const b = bob(frame.time, g);
    const x = dragonX(local, g);
    sb.visible = true;
    sb.place({ x, y: b.y, z: 0, height: g.dragon.height, yaw: YAW, pitch: b.pitch, roll: b.roll });
    sb.fly(frame.time, { amplitude: 1, speed: 1 });
    sb.face("smile", 1);
    sb.jaw(0.6 + 0.05 * Math.sin(frame.time * 4));
    sb.follow(0);
    sb.look(x - 900, b.y);

    // The doll is wedged in its open mouth, facing us, cursing.
    const mouth = sb.socket("mouth");
    if (doll.parentSocket !== mouth) doll.attach(mouth, { keepWorld: false });
    const metre = sb.metre;
    doll.visible = true;
    doll.reset();
    doll.place({
      x: 0,
      y: -0.03 * metre,
      z: 0.04 * metre,
      height: DOLL_SCALE * 0.3 * metre,
      yaw: -YAW,
      pivot: "center",
    });
    doll.pose("scream", 1);
    doll.flail(0.4, 2.4);
    doll.mood(MOODS, frame.time % MOOD_LOOP);
    doll.talk(0.55 + 0.45 * Math.sin(frame.time * 13));
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
      aim.x = dragonX(local, g) - g.dragon.headLead;
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

    // The cut startles them: a bang over each.
    if (this.bangPending && this.marks) {
      this.bangPending = false;
      this.marks.emit("bang", { at: { x: a.x, y: a.y + 0.62 * a.height }, size: 0.8 * a.height });
      this.marks.emit("bang", {
        at: { x: b.x, y: b.y + 0.62 * b.height },
        size: 0.8 * b.height,
        delay: 0.12,
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    this.ctx.dom.text.removeEventListener("focusin", this.onFocusIn);
    this.ctx.dom.text.removeEventListener("focusout", this.onFocusOut);
    this.duo?.setMarkSink(null);
    if (this.doll?.parentSocket) this.doll.detach();
    put(this.content, "opacity", "");
    put(this.content, "transform", "");
    for (const a of this.links) a.style.pointerEvents = "";
  }
}

export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new FunnyRuntime(ctx);
}
