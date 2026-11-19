import type { Object3D } from "three";

import { withSound } from "@/lib/sound-prompt";

import type { DuoActor } from "../../actors/duo";
import type { BellView, GramophoneActor } from "../../actors/gramophone/actor";
import type { TrackArt } from "../../actors/records/covers";
import type { RecordsActor } from "../../actors/records/actor";
import type { MarksActor } from "../../fx/comic-marks";
import type { SustainHandle } from "../../fx/comic-marks/system";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { newSpots, ramp, smooth } from "../voices/choreo";
import { bridgeDuoMarks } from "../voices/marks-bridge";

import {
  arrivalAt,
  arrivalOf,
  EXIT_RESET,
  exitAt,
  j10,
  j11,
  layoutFor,
  leaveWeight,
  newArrival,
  newLayout,
  riseAt,
  type Place,
} from "./choreo";
import { MusicDom, type Phase } from "./dom";
import { Scheduler, type DroneSpot } from "./scheduler";

/** The shared pass the pair of drones is drawn in, and its place in the draw order (the lit cast is 30). */
const DUO_PASS = "perspective";
const DUO_UNDER_CAST = 20;
const DUO_OVER_CAST = 35;
/** Turns a second of the crank the right drone gives the machine. */
const CRANK_RPS = 1.6;
/** The key that turns the crank adds this much for a moment. */
const BOOST_RPS = 0.8;
/** What the key turns the crank at when no drone is at it (before a record is picked). */
const KEY_RPS = 1.4;
const BOOST_SECONDS = 2.5;
/** The level of a song, as in the Music room. */
const MUSIC_VOLUME = 0.7;
/** The platter must turn this fast (turns a second) before the needle's song starts. */
const PLATTER_MIN_RPS = 0.3;

/** The work a drone is on: "free" (it floats where `place` says), "crank", or the key of a haul. */
type Solo = string;

/**
 * The music section. The two drones leave the screen, and as the scroll carries the first zone
 * the right hand drone drags the gramophone in and the left hand one drags in a crate of records.
 * The page is then free: the visitor picks a record, the left drone puts it on and lowers the
 * needle, the right drone cranks, notes come out of the horn and the song plays. The second zone
 * takes everything off again and leaves the pair hovering at the top left for the next section.
 *
 * `local` is the zones' value (the scroll's), so the arrival is a function of it and nothing else. `update(1)`
 * leaves nothing behind: every persistent setter of the duo and the gramophone is cleared.
 */
class MusicRuntime implements SectionRuntime {
  private readonly dom: MusicDom;
  private readonly sched = new Scheduler();
  private readonly layout = newLayout();
  private readonly arrival = newArrival();
  private readonly spots = newSpots();
  private readonly endSpots = newSpots();
  private readonly placeA = { x: 0, y: 0, height: 0 };
  private readonly placeB = { x: 0, y: 0, height: 0 };
  private readonly bell: BellView = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, r: 0 };
  private readonly notePoint = { x: 0, y: 0 };
  private readonly dragDir = { x: 0, y: 0 };

  private g: GramophoneActor | null = null;
  private r: RecordsActor | null = null;
  private tracks: readonly TrackArt[] = [];
  private notes: SustainHandle | null = null;
  private propsReady = false;
  /** `loadProps` has finished, with or without the props. */
  private propsDone = false;
  private disposed = false;

  private dt = 0;
  private local = -1;
  private queued: number | null = null;

  private musicOn = false;
  private musicEl: HTMLAudioElement | null = null;
  private boost = 0;
  private crankGain = 0;
  private readonly solo: [Solo, Solo] = ["free", "free"];
  private dirty = false;
  /** The mean cost of `update` in milliseconds (an exponential mean, for the probes). */
  private cost = 0;
  private readonly stopListening: Array<() => void> = [];

  constructor(
    private readonly ctx: SectionCtx,
    private readonly duo: DuoActor | null,
    private readonly marks: MarksActor | null,
  ) {
    const root = ctx.dom.text.querySelector<HTMLElement>("[data-music]") ?? ctx.dom.text;
    this.dom = new MusicDom(root, ctx.dom.text.querySelector<HTMLElement>("[data-home-content]"), {
      track: (index) => {
        this.choose(index);
      },
      another: () => {
        this.another();
      },
      crank: () => {
        this.boost = BOOST_SECONDS;
      },
    });
    if (marks) this.notes = marks.sustain("note", { size: 50 });
    if (duo && marks) bridgeDuoMarks(duo, marks);

    // A press on a sleeve is found by the pointer hub in the frame loop, not inside the event, so
    // the sound is unlocked here, on the press itself, while the scene is on the screen.
    const unlock = () => {
      if (this.propsReady && this.local >= 0 && this.local < 1) ctx.audio.unlock();
    };
    window.addEventListener("pointerdown", unlock, true);
    this.stopListening.push(() => {
      window.removeEventListener("pointerdown", unlock, true);
    });
    (window as unknown as { __homeMusic?: unknown }).__homeMusic = {
      state: () => ({
        local: this.local,
        step: this.sched.step,
        musicOn: this.musicOn,
        propsReady: this.propsReady,
        tracks: this.tracks.map((t) => t.title),
        solo: [...this.solo],
        platter: this.g ? this.g.platterRps : null,
        needleDown: this.g ? this.g.needleDown : null,
        disc: this.r ? this.r.phase : null,
        time: this.musicEl ? this.musicEl.currentTime : null,
        placed: [{ ...this.placeA }, { ...this.placeB }],
        cost: this.cost,
      }),
      choose: (i: number) => {
        this.choose(i);
      },
      another: () => {
        this.another();
      },
    };
  }

  /**
   * The ready gate: the arrival drags the gramophone in and carries the crate, so a play on a bare
   * stage would be a play of two drones in front of nothing. True once the props are made (or have
   * failed for good).
   */
  ready(): boolean {
    return this.propsDone;
  }

  /** Make the gramophone, the crate and the records' covers. Runs after the section has mounted. */
  async loadProps(): Promise<void> {
    try {
      const ctx = this.ctx;
      const [{ ensureGramophone }, { ensureRecords }] = await Promise.all([
        import("../../actors/gramophone"),
        import("../../actors/records"),
      ]);
      const [g, r] = await Promise.all([ensureGramophone(ctx), ensureRecords(ctx)]);
      const tracks = await r.useMusic(10);
      if (this.disposed) return;
      this.g = g;
      this.r = r;
      this.tracks = tracks;
      r.onPick = (index) => {
        this.press(index);
      };
      g.onNeedleLand = () => {
        this.ctx.audio.blip("click");
      };
      this.dom.buildKeys(tracks.map((t) => t.title));
      this.propsReady = true;
    } catch (error) {
      console.warn("music: the gramophone or the records could not be made", error);
    } finally {
      this.propsDone = true;
    }
  }

  // ---- the frame -----------------------------------------------------------------------

  update(local: number, frame: FrameInfo): void {
    const t0 = performance.now();
    this.step(local, frame);
    this.cost += (performance.now() - t0 - this.cost) * 0.05;
  }

  private step(local: number, frame: FrameInfo): void {
    const vp = frame.viewport;
    this.local = local;
    this.dt = frame.dt;

    const exit = exitAt(local);
    // The props are leaving: whatever the visitor had started ends now (the song fades, the disc
    // goes home). Otherwise a jump back in would find a record "playing" that nobody pressed, and
    // start the song by itself.
    if (exit > EXIT_RESET && this.sched.step !== "idle") this.resetScene();
    const A = arrivalOf(local);
    arrivalAt(A, this.arrival);

    const fade = ramp(local, 0.04, 0.12) * (1 - ramp(local, 0.9, 1));
    this.dom.setFade(fade, (1 - fade) * 14);

    // Before the section starts the voices section still owns the pair (its tail and this lead
    // overlap): at `local` 0 both agree on the corners (J10), so nothing is written until then.
    if (local < 0) {
      this.settleOnce();
      return;
    }
    if (local >= 1) {
      this.finish(vp);
      return;
    }
    this.dirty = true;

    layoutFor(vp, this.layout);
    const scene = A > 0 || exit > 0;
    const stands = this.propsReady && this.arrival.ready && exit === 0;

    // The scheduler: what the visitor started, in order.
    const cmd = this.sched.update({ dt: frame.dt, discPhase: this.r ? this.r.phase : "idle" });
    if (A < 0.3 && this.sched.step !== "idle") this.resetScene();
    if (this.queued !== null && this.sched.step === "idle" && stands) {
      const next = this.queued;
      this.queued = null;
      this.sched.choose(next);
    }
    this.onEdges(cmd.entered, cmd.choice);

    if (scene) {
      this.driveProps(vp, A, exit, stands, cmd.needle, cmd.crank, cmd.interactive);
      this.drivePair(vp, local, A, exit, cmd.crank, cmd.spot);
    } else {
      this.drivePairLeaving(vp, local);
      if (this.g) this.g.visible = false;
      if (this.r) this.r.visible = false;
    }
    this.driveSound(exit, cmd.music, cmd.choice);
    this.driveNotes();
    this.driveWords(stands, A > 0 && exit === 0);
    this.boost = Math.max(0, this.boost - frame.dt);
  }

  enter(): void {
    if (this.duo && this.marks) bridgeDuoMarks(this.duo, this.marks);
    // The drone that cranks stands at the gramophone: it is drawn over the lit cast, so the box
    // never hides half of it.
    this.ctx.stage.reorder(DUO_PASS, DUO_OVER_CAST);
  }

  leave(): void {
    this.ctx.stage.reorder(DUO_PASS, DUO_UNDER_CAST);
    this.resetScene();
  }

  dispose(): void {
    this.disposed = true;
    this.ctx.stage.reorder(DUO_PASS, DUO_UNDER_CAST);
    this.resetScene();
    for (const stop of this.stopListening) stop();
    this.stopListening.length = 0;
    this.notes?.stop();
    this.dom.dispose();
    delete (window as unknown as { __homeMusic?: unknown }).__homeMusic;
  }

  // ---- the visitor ---------------------------------------------------------------------

  /**
   * The pointer hub reports a mouse press at pointer-down and a finger's press only when it lifts as
   * a tap (a scroll that begins on the crate is never a press, `kernel/pointer.ts`).
   */
  private press(index: number): void {
    this.choose(index);
  }

  /** A record was chosen: by a press on a sleeve or by a key. */
  private choose(index: number): void {
    if (!this.propsReady || this.arrival.ready === false) return;
    if (index < 0 || index >= this.tracks.length) return;
    this.ctx.audio.unlock();
    withSound("This song", () => {
      if (this.sched.step === "idle") {
        this.sched.choose(index);
      } else if (this.sched.again()) {
        // Another song while one is out: this one goes back first.
        this.queued = index;
      }
    });
  }

  /** "Another record": the needle goes up, the song fades, the disc goes home. */
  private another(): void {
    this.sched.again();
  }

  // ---- the scene -----------------------------------------------------------------------

  private onEdges(entered: string | null, choice: number | null): void {
    const r = this.r;
    const g = this.g;
    if (!entered || !r || !g) return;
    if (entered === "fetch" && choice !== null) {
      r.setHandSocket(this.duo ? this.duo.anchor("a", "L") : null);
      r.pick(choice);
      this.dom.setTitle(this.tracks[choice]?.title ?? "");
    } else if (entered === "place") {
      r.putOn(g);
    } else if (entered === "return") {
      r.putBack();
    } else if (entered === "idle") {
      r.setHandSocket(null);
    }
  }

  private driveProps(
    vp: { w: number; h: number },
    A: number,
    exit: number,
    stands: boolean,
    needle: boolean,
    crank: boolean,
    interactive: boolean,
  ): void {
    const g = this.g;
    const r = this.r;
    if (!g || !r) return;
    const L = this.layout;
    const gOff = Math.max(this.arrival.gramophone, exit);
    const cOff = Math.max(this.arrival.crate, exit);
    const reachG = vp.w / 2 - L.gramophone.x + 0.62 * L.gramophone.height + 60;
    const reachC = L.crate.x + vp.w / 2 + 0.5 * L.crate.width + 60;
    const on = A > 0 || exit > 0;
    // Off the screen there is nothing to draw (the last hundredth of the way is past the edge).
    g.visible = on && gOff < 0.995;
    r.visible = on && cOff < 0.995;
    g.place({ x: L.gramophone.x + gOff * reachG, y: L.gramophone.y, height: L.gramophone.height });
    r.place({ x: L.crate.x - cOff * reachC, y: L.crate.y, width: L.crate.width });
    g.interactive = stands;
    r.interactive = stands && interactive && this.queued === null;
    g.setNeedle(needle && stands);
    if (crank && stands) {
      this.crankGain = Math.min(1, this.crankGain + this.dt / 0.9);
      const rps = (CRANK_RPS + (this.boost > 0 ? BOOST_RPS : 0)) * smooth(this.crankGain);
      this.duo?.crank("b", g.socket("crankHandle"), { speed: rps });
      this.solo[1] = "crank";
      g.driveCrank(this.duo ? this.duo.crankAngle("b") : null);
    } else {
      this.crankGain = 0;
      if (this.solo[1] === "crank") {
        this.duo?.release("b");
        this.solo[1] = "free";
      }
      g.driveCrank(null);
      // No drone is at the crank (before a record is picked, or the song has ended): the key
      // still turns it for a moment, and it coasts down when the key's time is up.
      g.setCrankSpeed(stands && this.boost > 0 ? KEY_RPS : 0);
    }
  }

  private haul(
    who: "a" | "b",
    key: string,
    handle: () => Object3D | null,
    dx: number,
    dy: number,
    strain: number,
  ): void {
    const duo = this.duo;
    if (!duo) return;
    const index = who === "a" ? 0 : 1;
    if (this.solo[index] === key) return;
    const object = handle();
    if (!object) return;
    this.dragDir.x = dx;
    this.dragDir.y = dy;
    duo.haul(who, object, { dir: this.dragDir, strain });
    this.solo[index] = key;
  }

  private free(who: "a" | "b"): void {
    const index = who === "a" ? 0 : 1;
    if (this.solo[index] === "free") return;
    this.duo?.release(who);
    this.solo[index] = "free";
  }

  /** The two drones while the scene is on the screen. */
  private drivePair(
    vp: { w: number; h: number },
    local: number,
    A: number,
    exit: number,
    crank: boolean,
    spot: DroneSpot,
  ): void {
    const duo = this.duo;
    const g = this.g;
    const r = this.r;
    if (!duo) return;
    const L = this.layout;
    const a = this.placeA;
    const b = this.placeB;
    const ball = L.aIdle.height;

    // Where each stands when it is free.
    const edge = vp.w / 2 + ball * 2;
    const aWait = A < 0.36;
    const bWait = A < 0.04;
    const goal: Place =
      spot === "crate" ? L.aCrate : spot === "platter" || spot === "needle" ? L.aPlatter : L.aIdle;
    a.x = aWait ? -edge : goal.x;
    a.y = aWait ? L.aIdle.y : goal.y;
    a.height = ball;
    b.x = bWait ? edge : L.bIdle.x;
    b.y = L.bIdle.y;
    b.height = ball;

    // After the props have gone the pair rises to the top left (J11).
    const rise = riseAt(local);
    if (rise > 0) {
      j11(vp, this.endSpots);
      a.x += (this.endSpots.a.x - a.x) * rise;
      a.y += (this.endSpots.a.y - a.y) * rise;
      a.height += (this.endSpots.a.h - a.height) * rise;
      b.x += (this.endSpots.b.x - b.x) * rise;
      b.y += (this.endSpots.b.y - b.y) * rise;
      b.height += (this.endSpots.b.h - b.height) * rise;
    }
    duo.visible = true;
    duo.place(a, b);
    duo.pose("float", 1);

    if (!g || !r) return;
    const leaving = exit > 0.02 && exit < 0.86;
    // The right drone: drags the gramophone in, cranks, drags it out.
    if (leaving) this.haul("b", "out", () => g.socket("dragBack"), 1, 0, 0.7);
    else if (this.arrival.dragging && exit === 0) {
      this.haul("b", "in", () => g.socket("dragFront"), -1, 0, 0.7);
    } else if (!(crank && this.arrival.ready && exit === 0)) this.free("b");
    // The left drone: drags the crate in, works the needle, drags the crate out.
    if (leaving) this.haul("a", "out", () => r.socket("carryL"), -1, 0, 0.6);
    else if (this.arrival.carrying && exit === 0) {
      this.haul("a", "in", () => r.socket("carryR"), 1, 0, 0.6);
    } else this.free("a");
  }

  /** The leave stretch and the empty screen: the pair zips off from the bottom corners. */
  private drivePairLeaving(vp: { w: number; h: number }, local: number): void {
    const duo = this.duo;
    if (!duo) return;
    this.free("a");
    this.free("b");
    const w = leaveWeight(local);
    j10(vp, this.spots);
    const a = this.placeA;
    const b = this.placeB;
    a.x = this.spots.a.x;
    a.y = this.spots.a.y;
    a.height = this.spots.a.h;
    b.x = this.spots.b.x;
    b.y = this.spots.b.y;
    b.height = this.spots.b.h;
    // Off the screen there is nothing to draw.
    duo.visible = w < 1;
    duo.place(a, b);
    duo.pose("leave", w);
  }

  // ---- sound ---------------------------------------------------------------------------

  private driveSound(exit: number, wants: boolean, choice: number | null): void {
    const g = this.g;
    if (!g) return;
    const may = wants && this.arrival.ready && exit < EXIT_RESET && choice !== null;
    if (may && !this.musicOn && g.needleDown && g.platterRps > PLATTER_MIN_RPS) {
      this.startSong(choice);
    } else if (!may && this.musicOn) {
      this.stopSong(600);
    }
  }

  private startSong(choice: number): void {
    const track = this.tracks[choice];
    if (!track) return;
    const audio = this.ctx.audio;
    audio.stopVoice();
    audio.playMusic(track.audio, { loop: false, volume: MUSIC_VOLUME, fadeMs: 1200 });
    const el = audio.getMusicElement();
    if (el) {
      el.loop = false;
      const ended = () => {
        if (this.musicEl === el) this.sched.trackEnded();
      };
      el.addEventListener("ended", ended, { once: true });
      this.musicEl = el;
    }
    this.musicOn = true;
    this.duo?.react("wink", "a");
  }

  private stopSong(fadeMs: number): void {
    if (!this.musicOn) return;
    this.musicOn = false;
    this.musicEl = null;
    this.ctx.audio.stopMusic(fadeMs);
  }

  /** The notes come out of the horn while the song plays. */
  private driveNotes(): void {
    const g = this.g;
    const notes = this.notes;
    if (!g || !notes || !this.musicOn) return;
    g.bellMouth(this.bell);
    const b = this.bell;
    this.notePoint.x = b.x + b.dx * b.r * 0.5;
    this.notePoint.y = b.y + b.dy * b.r * 0.5;
    notes.update(this.notePoint, 1);
  }

  // ---- the words -----------------------------------------------------------------------

  /** `arriving`: the scene is on its way in (A above 0) and not on its way out. */
  private driveWords(stands: boolean, arriving: boolean): void {
    const dom = this.dom;
    const step = this.sched.step;
    const phase: Phase = step !== "idle" ? "picked" : stands ? "ready" : arriving ? "wait" : "away";
    dom.setPhase(phase);
    dom.setSounding(this.musicOn);
    dom.setAgain(step === "needle" || step === "back" || step === "playing" || step === "ended");
  }

  // ---- ending --------------------------------------------------------------------------

  /** Everything that is the scene's and persists, put back: the song, the disc, the crank, the drones. */
  private resetScene(): void {
    this.stopSong(600);
    this.sched.reset();
    this.queued = null;
    this.crankGain = 0;
    this.boost = 0;
    this.free("a");
    this.free("b");
    this.g?.driveCrank(null);
    this.g?.setCrankSpeed(0);
    this.g?.setNeedle(false);
    this.r?.putBack();
    this.r?.setHandSocket(null);
    this.notes?.stop();
    this.dom.setPhase("away");
    this.dom.setAgain(false);
  }

  /** The scene has been on and is now behind or ahead of the section: put everything back, once. */
  private settleOnce(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.resetScene();
  }

  /** `local` 1 and past: the scene has gone, the pair hovers at the top left (J11). */
  private finish(vp: { w: number; h: number }): void {
    this.settleOnce();
    if (this.g) this.g.visible = false;
    if (this.r) this.r.visible = false;
    const duo = this.duo;
    if (!duo) return;
    j11(vp, this.endSpots);
    const a = this.placeA;
    const b = this.placeB;
    a.x = this.endSpots.a.x;
    a.y = this.endSpots.a.y;
    a.height = this.endSpots.a.h;
    b.x = this.endSpots.b.x;
    b.y = this.endSpots.b.y;
    b.height = this.endSpots.b.h;
    duo.visible = true;
    duo.place(a, b);
    duo.pose("float", 1);
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
    console.warn("music: the drones could not be made", error);
  }
  const runtime = new MusicRuntime(ctx, duo, marks);
  // The gramophone and the crate arrive in the background: the scene shows its waiting line meanwhile.
  void runtime.loadProps();
  return runtime;
}
