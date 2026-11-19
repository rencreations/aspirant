/**
 * The opening's scene: the drone that waits with the visitor while the page loads, and the intro
 * that follows the press (the two Guinevere drones swoop in with the logo, the drone dashes under it,
 * the three set it down, the pair pull it to the hero's size and leave: two seconds in all). It runs
 * inside the one stage of the home, in the engine's frame loop, while the page is not open yet. The
 * kernel gives it the frame (`update`), hides every actor first, and stops calling it when the page
 * opens.
 *
 *   loader   the drone pops in, small, in the middle of the screen and idles there (`loader.ts`:
 *            tricks, a cheer at each real quarter, a worried look when the files really stall); the
 *            loading screen draws the bar under it
 *   intro    after the press, a clock: `introAt(t)` (`timeline.ts`) gives every actor's state, the
 *            cues (`CUES`) fire the one-shots (the drone's shock mark and a few sounds)
 *   the end  the intro ends on joint J0 (the hero's first frame) and calls `finishIntro()`
 *
 * There are no comic marks here except the drone's shock mark, and no speech bubbles.
 *
 * The screen of the loader is DOM (`components/home-boot/`) and shares only `bus.ts` with this file.
 * See `docs/design/home/boot.md`.
 */
import { phaseAtLeast, setTapGuard, useHomeFlow } from "@/lib/home-flow";

import type { DroneActor } from "../actors/drone";
import type { DuoActor } from "../actors/duo";
import type { LogoActor, LogoPose } from "../fx/logo";
import type { ActorCtx } from "../actors/shared/types";
import type { FrameInfo } from "../kernel/types";
import { bootBus, resetBootBus } from "./bus";
import { liftStage } from "./lift";
import { newLoaderAction, newLoaderBrain, stepLoader } from "./loader";
import {
  CUES,
  INTRO_SECONDS,
  carriedRect,
  cuesBetween,
  introAt,
  loaderPlace,
  newIntroState,
  type CarriedRect,
  type IntroCue,
  type IntroGeo,
} from "./timeline";

export interface BootCtx extends ActorCtx {
  /** The home's canvas host: shown above the loading screen while the opening runs. */
  host: HTMLElement;
}

export interface BootRuntime {
  /** Once a frame while the page is not open. The kernel has hidden every actor already. */
  update(frame: FrameInfo): void;
  /** The scene is built and has drawn (or has failed): the page may be called ready. */
  ready(): boolean;
  /**
   * The drone is on the stage (or the scene failed): the sections near the top may start to build
   * and ask for their files. Until then the drone's files have the connection to themselves.
   */
  canPrime(): boolean;
  dispose(): void;
}

/** The probe: what the opening is doing, and a way to hold it at a time. */
interface BootProbe {
  state(): unknown;
  /** Put the intro at `t` seconds (in a frozen scene), running the actors up to it. */
  seekIntro(t: number): void;
}

declare global {
  interface Window {
    __homeBoot?: BootProbe;
  }
}

/** The logo is carried level: whatever the two gloves do, it tilts by this much at most (radians, about 3 degrees). */
const MAX_CARRY_ROLL = 0.05;

class BootScene implements BootRuntime {
  private drone: DroneActor | null = null;
  private duo: DuoActor | null = null;
  private logo: LogoActor | null = null;
  private built = false;
  private failed = false;
  private disposed = false;
  private drawn = 0;
  private lastFrame: FrameInfo | null = null;

  // The loader.
  private readonly brain = newLoaderBrain();
  private readonly action = newLoaderAction();
  private shownChecks = 0;
  /** Frames left in which the pair and the logo are drawn once, unseen, so their first real frame is cheap. */
  private warmLeft = 4;

  // The intro.
  private introT = -1;
  private prevT = 0;
  private started = false;
  private finished = false;
  private readonly state = newIntroState();
  private readonly carried: CarriedRect = { cx: 0, cy: 0, width: 0, roll: 0 };
  private readonly pa = { x: 0, y: 0 };
  private readonly pb = { x: 0, y: 0 };
  private readonly rect = { cx: 0, cy: 0, width: 0 };
  private readonly logoPose: LogoPose = {};
  private readonly dronePlace = { x: 0, y: 0, height: 0 };
  private readonly loaderAt = { x: 0, y: 0, height: 0 };
  private readonly lookAt = { x: 0, y: 0 };
  private readonly duoA = { x: 0, y: 0, height: 0 };
  private readonly duoB = { x: 0, y: 0, height: 0 };
  private readonly dirs: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: -1, y: -0.55 },
    { x: 1, y: 0.55 },
  ];

  private readonly onDown = (): void => {
    // The press that begins now is on the drone when the kernel's hit test says so. This listener
    // was added after the hub's, so the hub has already resolved this press.
    bootBus.pressOnDrone = this.ctx.pointer.state.hit === "drone";
  };

  constructor(private readonly ctx: BootCtx) {
    bootBus.stage = "building";
    liftStage(ctx.host);
    setTapGuard(() => bootBus.pressOnDrone);
    window.addEventListener("pointerdown", this.onDown, { passive: true });
    window.__homeBoot = {
      state: () => this.report(),
      seekIntro: (t) => {
        this.seek(t);
      },
    };
    void this.build();
  }

  ready(): boolean {
    return this.failed || (this.built && this.drawn >= 2);
  }

  canPrime(): boolean {
    return this.failed || bootBus.droneShown;
  }

  // ---------------------------------------------------------------- building

  private async build(): Promise<void> {
    try {
      // The drone first: it is what the visitor sees while everything else arrives. Then the others
      // one by one, so no two shader compiles land in the same frame.
      const droneMod = await import("../actors/drone");
      this.drone = await droneMod.ensureDrone(this.ctx);
      if (this.disposed) return;
      const duoMod = await import("../actors/duo");
      this.duo = await duoMod.ensureDuo(this.ctx);
      if (this.disposed) return;
      const logoMod = await import("../fx/logo");
      this.logo = await logoMod.ensureLogo(this.ctx);
      if (this.disposed) return;
      this.built = true;
      bootBus.stage = "ready";
    } catch (error) {
      // A failure handled: the loading screen goes on with what it has and the intro is skipped.
      console.warn("[home] the opening's scene failed; the page opens without the intro.", error);
      this.failed = true;
      bootBus.stage = "failed";
    }
  }

  // ---------------------------------------------------------------- the frame

  update(frame: FrameInfo): void {
    if (this.disposed) return;
    this.lastFrame = frame;
    const drone = this.drone;
    if (!drone) return;
    const flow = useHomeFlow.getState();
    if (flow.phase === "intro" && this.built && !this.failed) {
      this.runIntro(frame);
    } else {
      this.runLoader(frame);
    }
    if (this.built || this.failed) this.drawn += 1;
  }

  private runLoader(frame: FrameInfo): void {
    const drone = this.drone;
    if (!drone) return;
    const flow = useHomeFlow.getState();
    const geo = frame.viewport;
    const mouse = this.ctx.pointer.state.inside && this.ctx.pointer.state.type === "mouse";
    stepLoader(
      this.brain,
      {
        dt: frame.dt,
        progress: flow.progress?.progress ?? 0,
        done: phaseAtLeast(flow.phase, "tap"),
        slow: flow.notes.slow,
        offline: flow.notes.offline,
        retrying: flow.notes.retrying,
        pointerInside: mouse,
      },
      this.action,
    );
    this.warm(geo);
    drone.visible = true;
    drone.appear();
    drone.place(loaderPlace(geo, this.loaderAt));
    if (mouse) {
      drone.look("pointer");
    } else if (this.action.look) {
      this.lookAt.x = this.action.look.x * (geo.w / 2);
      this.lookAt.y = this.action.look.y * (geo.h / 2);
      drone.look(this.lookAt);
    }
    const a = this.action;
    if (a.trick) drone.trickNow(a.trick, this.brain.cheered % 2 === 0 ? 1 : -1);
    if (a.face) drone.emote(a.face, a.faceSeconds);
    // The loading screen's plain mark can leave once the drone has really appeared.
    if (!bootBus.droneShown && this.shownChecks++ % 6 === 0 && drone.state().presence > 0.3) {
      bootBus.droneShown = true;
    }
  }

  /**
   * The first frame of the pair and the logo uploads their buffers and textures (about 60 ms in the
   * dev server). Draw them once while the loading screen waits: the logo at no opacity, the pair a
   * pixel tall in a corner. Nothing is seen and nothing can be pressed.
   */
  private warm(geo: IntroGeo): void {
    const { duo, logo } = this;
    if (this.warmLeft <= 0 || !duo || !logo || !this.built) return;
    this.warmLeft -= 1;
    logo.visible = true;
    this.rect.cx = 0;
    this.rect.cy = 0;
    this.rect.width = 200;
    this.logoPose.opacity = 0;
    logo.place(this.rect, this.logoPose);
    this.logoPose.opacity = undefined;
    duo.visible = true;
    this.duoA.x = geo.w / 2 - 2;
    this.duoA.y = -geo.h / 2 + 2;
    this.duoA.height = 1;
    this.duoB.x = this.duoA.x;
    this.duoB.y = this.duoA.y;
    this.duoB.height = 1;
    duo.place(this.duoA, this.duoB);
    duo.pose("float", 1);
  }

  // ---------------------------------------------------------------- the intro

  private startIntro(): void {
    this.started = true;
    this.introT = 0;
    this.prevT = -1e-6;
    bootBus.introT = 0;
    this.duo?.restart();
    this.duo?.ambient(false);
    // The pair draw no comic marks (sweat, sparks, hearts): the owner wants the necessary ones only.
    this.duo?.setMarkSink(null);
  }

  private runIntro(frame: FrameInfo): void {
    if (!this.started) this.startIntro();
    this.introT += frame.dt;
    const t = this.introT;
    cuesBetween(this.prevT, t, (cue) => this.fire(cue));
    this.prevT = t;
    bootBus.introT = t;
    this.applyAt(t, frame);
    if (t >= INTRO_SECONDS && !this.finished) this.finish();
  }

  /** Hand the state of the intro at `t` to every actor. */
  private applyAt(t: number, frame: FrameInfo): void {
    const drone = this.drone;
    const duo = this.duo;
    const logo = this.logo;
    if (!drone || !duo || !logo) return;
    const geo: IntroGeo = frame.viewport;
    const s = introAt(t, geo, this.state);

    drone.visible = true;
    this.dronePlace.x = s.drone.x;
    this.dronePlace.y = s.drone.y;
    this.dronePlace.height = s.drone.height;
    drone.place(this.dronePlace);
    drone.pose(s.dronePose, s.droneSide);
    drone.face(s.droneFace ?? "normal", 1);
    if (s.lookPointer) drone.look("pointer");
    else {
      this.lookAt.x = s.look.x;
      this.lookAt.y = s.look.y;
      drone.look(this.lookAt);
    }

    duo.visible = s.duoOn;
    if (s.duoOn) {
      this.duoA.x = s.duoA.x;
      this.duoA.y = s.duoA.y;
      this.duoA.height = s.duoA.height;
      this.duoB.x = s.duoB.x;
      this.duoB.y = s.duoB.y;
      this.duoB.height = s.duoB.height;
      duo.place(this.duoA, this.duoB);
      switch (s.duoMode) {
        case "carry":
          duo.carry(null, s.carry);
          break;
        case "pull":
          duo.pull(null, s.pull);
          break;
        case "leave":
          this.dirs[0].x = s.leaveA.x;
          this.dirs[0].y = s.leaveA.y;
          this.dirs[1].x = s.leaveB.x;
          this.dirs[1].y = s.leaveB.y;
          duo.pose("leave", s.poseW, { dirs: this.dirs });
          break;
      }
      // Settle this frame's gloves before the logo is put between them.
      duo.update(frame);
    }

    logo.visible = s.logoOn;
    if (s.logoOn) {
      const w = s.duoOn ? s.logoCarried : 0;
      this.rect.cx = s.logo.cx;
      this.rect.cy = s.logo.cy;
      this.rect.width = s.logo.width;
      let roll = 0;
      if (w > 0.001) {
        duo.gloveAt("a", "L", this.pa);
        duo.gloveAt("b", "R", this.pb);
        const c = carriedRect(this.pa, this.pb, this.carried);
        this.rect.cx += (c.cx - this.rect.cx) * w;
        this.rect.cy += (c.cy - this.rect.cy) * w;
        this.rect.width += (c.width - this.rect.width) * w;
        roll = Math.max(-MAX_CARRY_ROLL, Math.min(MAX_CARRY_ROLL, c.roll)) * w;
      }
      const pose = this.logoPose;
      pose.roll = roll;
      pose.tension = s.logoTension;
      pose.wobble = s.logoWobble;
      pose.wave = s.logoWave;
      logo.place(this.rect, pose);
    }
  }

  /** One thing that happens once. */
  private fire(cue: IntroCue): void {
    const drone = this.drone;
    if (!drone) return;
    switch (cue.kind) {
      case "shock":
        // The one comic mark of the opening: the drone sees the pair.
        drone.shock(0.55);
        break;
      case "blip":
        this.ctx.audio.blip(cue.sound);
        break;
    }
  }

  private finish(): void {
    this.finished = true;
    const drone = this.drone;
    if (drone) {
      drone.pose(null);
      drone.face("normal", 1);
      drone.look("pointer");
      drone.setInteractive(true);
    }
    if (this.duo) {
      this.duo.setMarkSink(null);
      this.duo.restart();
      this.duo.ambient(true);
      this.duo.visible = false;
    }
    bootBus.introT = INTRO_SECONDS;
    // The page opens: the sections take over in the next frame (joint J0 is this frame).
    useHomeFlow.getState().finishIntro();
  }

  // ---------------------------------------------------------------- probes

  private report(): unknown {
    return {
      stage: bootBus.stage,
      phase: useHomeFlow.getState().phase,
      introT: this.introT,
      drawn: this.drawn,
      droneShown: bootBus.droneShown,
      drone: this.drone?.state() ?? null,
      duo: this.duo?.state() ?? null,
      logo: this.logo?.currentRect() ?? null,
      intro: this.state,
      cues: CUES.length,
    };
  }

  /**
   * Hold the intro at `t` seconds, for a frame sheet (the scene is frozen, so nothing else moves):
   * the actors are run from the start of the intro in small steps so their springs are where they
   * would have been. Not used by the page itself.
   */
  private seek(t: number): void {
    const frame = this.lastFrame;
    const drone = this.drone;
    const duo = this.duo;
    const logo = this.logo;
    if (!frame || !drone || !duo || !logo) return;
    if (useHomeFlow.getState().phase !== "intro") return;
    const step = 1 / 60;
    this.startIntro();
    const target = Math.max(0, Math.min(INTRO_SECONDS, t));
    let now = Math.max(0, target - 1.6);
    // Begin 1.6 s early (or at 0) so the springs have settled by `target`.
    let prev = now - 1e-6;
    this.applyAt(now, frame);
    drone.snapTo(this.dronePlace);
    while (now < target - 1e-9) {
      now = Math.min(target, now + step);
      cuesBetween(prev, now, (cue) => this.fire(cue));
      prev = now;
      this.applyAt(now, frame);
      drone.advance(step);
      duo.advance(step);
      logo.update({ ...frame, dt: step });
    }
    this.introT = target;
    this.prevT = target;
  }

  // ---------------------------------------------------------------- the end

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("pointerdown", this.onDown);
    setTapGuard(null);
    try {
      this.duo?.setMarkSink(null);
    } catch {
      /* the actor may be gone already */
    }
    if (window.__homeBoot) delete window.__homeBoot;
    resetBootBus();
  }
}

/** Build the opening's scene. Called by the engine for a document load of the home page. */
export function createBootRuntime(ctx: BootCtx): BootRuntime {
  return new BootScene(ctx);
}
