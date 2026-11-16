import type Lenis from "lenis";

import type { PointerState } from "@/lib/hooks";
import { useSiteStore } from "@/lib/stores";

import { clamp, mix, ramp } from "../choreo/ease";
import { createFace, stepFace, type FaceFrame } from "../choreo/face";
import {
  createFollower,
  flightOf,
  floatOf,
  lookAt,
  stepFollower,
  syncFollower,
} from "../choreo/follower";
import { INTRO, introAt, type IntroGeo } from "../choreo/intro";
import { layerStep } from "../choreo/layering";
import {
  buildPath,
  completeLayout,
  type FaceName,
  type Path,
  type PathLayout,
  type Side,
  type Target,
} from "../choreo/path";
import { createRig, stepRig, type RigPose } from "../choreo/rig";
import {
  createSpin,
  createTricks,
  startTrick,
  stepSpin,
  stepTricks,
  trickPose,
  type TrickKind,
} from "../choreo/tricks";
import { uncovered, type Box } from "../film-geometry";
import { LAYER } from "../layout";
import { stageRefs, useAboutStage, type EngineState, type IntroPhase } from "../stage-bus";

import type { DroneDraw, DroneScene, TrailPoint } from "./drone-scene";
import { measureAnchors } from "./measure";

/**
 * The director: the one clock of the drone. It is not in the lazy chunk, because it also runs
 * when there is no scene to draw (the title still appears in its bands on a browser without
 * WebGL). Each frame it reads the scroll and the pointer, asks the path where the drone belongs,
 * steps the springs, the tricks, the rig and the face, hands the result to the scene, and moves
 * the button that follows the drone. It also plays the opening and sets its phases.
 */

interface DirectorParts {
  /** The fixed layer the canvas is in. Its size is the screen; its place in the stack changes. */
  layer: HTMLElement;
  /** The page's root, where the anchors are. */
  root: HTMLElement;
  /** An unseen box as wide as the gutter and as tall as the bar. */
  probe: HTMLElement;
  /** The round button that follows the drone. */
  button: HTMLButtonElement;
  getLenis: () => Lenis | null;
  pointer: { readonly current: PointerState };
  /** Where the still picture goes when there is no scene (the hero's place in the document). */
  onStill: (place: { x: number; y: number; size: number }) => void;
}

export interface Director {
  /** The scene to draw with, or null when it has gone. */
  setScene: (scene: DroneScene | null) => void;
  /** The scene is drawing, or there will be none. The opening waits for one of the two. */
  setEngine: (engine: Exclude<EngineState, "pending">) => void;
  /** The visitor pressed the drone. */
  press: () => void;
  /** The pointer is over the drone, or has left it. */
  hover: (over: boolean) => void;
  dispose: () => void;
}

/** What the probes read. */
interface DroneState {
  phase: IntroPhase;
  engine: EngineState;
  pose: { x: number; y: number; size: number; yaw: number; pitch: number; roll: number };
  target: { x: number; y: number; size: number; station: string };
  uncovered: number;
  side: Side;
  trick: string | null;
  speed: number;
}

interface DroneProbe {
  state: () => DroneState;
  /** The layout the path was built from, as it was last measured. */
  layout: () => PathLayout;
  freeze: (on: boolean) => void;
  seekIntro: (seconds: number) => void;
  skipIntro: () => void;
}

declare global {
  interface Window {
    __aboutDrone?: DroneProbe;
  }
}

/** The layer over the film, for the dive toward the visitor. */
const FRONT = LAYER.film + 1;
/** The button's own size in CSS pixels, before it is scaled to the drone. */
const BUTTON_PX = 100;
/** A scroll further than this from the top skips the opening: the page was opened part way. */
const OPENED_DOWN = 8;
/** The turns the statement gives the drone over its stretch of scroll. */
const STATEMENT_TURNS = 1.75;
/** The answers to a press, in order. Many quick presses make it dizzy. */
const ANSWERS: readonly TrickKind[] = ["hop", "roll", "nod"];
const DIZZY_PRESSES = 4;
const DIZZY_WINDOW = 2400;
/** The opening starts to run after this many quick frames in a row, or this long, in seconds. */
const CALM_FRAMES = 2;
const CALM_WAIT = 0.5;
/** How often, in seconds, the page under a resting drone is looked at, and where (in reaches). */
const LOOK_EVERY = 0.25;
const LOOK_AT: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
/** A scroll faster than this, in screens per second, leaves no time to go round the film. */
const HURRY_SPEED = 0.45;
/** The trail: how many places it keeps and how long a place lives, in seconds. */
const TRAIL_PLACES = 20;
const TRAIL_LIFE = 0.36;
/** The keys that scroll a page. */
const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
  "Spacebar",
]);

function introOff(): boolean {
  try {
    return window.sessionStorage.getItem("aspirants:intro") === "off";
  } catch {
    return false;
  }
}

export function createDirector(parts: DirectorParts): Director {
  const { layer, root, probe, button } = parts;

  let scene: DroneScene | null = null;
  let engine: EngineState = "pending";
  let phase: IntroPhase = "wait";
  let disposed = false;

  // The layout and the path. Measured again when `stale` is set.
  let stale = true;
  let path: Path = buildPath(completeLayout(1, 1, 0, 0));
  let slot: Box | null = null;
  let titleBox: Box | null = null;

  // The opening's clock: -1 before it starts and after it has ended. It does not start to run
  // until the page has drawn two quick frames in a row (`calm`): the change of phase makes the
  // page draw itself again, and the first metres of the flight must not be lost to that.
  let introT = -1;
  let calm = 0;
  let held = 0;
  let introPlayed = false;
  let seeking: number | null = null;
  let edge = Infinity;
  let titleShown = false;

  let frozen = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let lastScroll = 0;
  /** How fast the page is being scrolled, smoothed, in screens per second. */
  let scrollSpeed = 0;

  const follower = createFollower(0, 0, 100);
  let placed = false;
  const tricks = createTricks();
  const spin = createSpin();
  const rig = createRig();
  const face = createFace();
  let side: Side = "behind";
  let engaged = 0;
  let hovered = false;
  let glee = 0;
  let presses: number[] = [];
  let answer = 0;
  let dizzyNext = false;
  let buttonOn = false;
  let overControl = false;
  let sinceLook = 0;

  /** True when a link or a button of the page lies under the drone's middle or near it. */
  const controlUnder = (x: number, y: number, reach: number): boolean => {
    for (const [dx, dy] of LOOK_AT) {
      for (const el of document.elementsFromPoint(x + dx * reach, y + dy * reach)) {
        if (el === button || !root.contains(el)) continue;
        if (el.closest("a[href], button, input, select, textarea, summary, [role='button']")) {
          return true;
        }
      }
    }
    return false;
  };
  let ringScale = 0;

  const pose = { x: 0, y: 0, size: 100, yaw: 0, pitch: 0, roll: 0 };
  /** Where the drone has just been, the newest first, with the time of each. */
  let been: Array<{ x: number; y: number; t: number }> = [];
  const trailPoints: TrailPoint[] = [];
  let target: Target = path.at(0);
  let seen = 1;
  let speed = 0;
  let rigPose: RigPose = stepRig(
    rig,
    { fast: 0, effort: 0, flare: 0, ax: 0, ay: 0, happy: 0, time: 0 },
    0,
  );
  let faceFrame: FaceFrame = { cell: "normal", blink: 0, lookX: 0, lookY: 0 };

  const setPhase = (next: IntroPhase) => {
    if (phase === next) return;
    phase = next;
    useAboutStage.setState({ phase: next });
  };

  const showTitle = () => {
    if (titleShown) return;
    // The title's handle may arrive after the director: it is read when it is needed.
    const title = stageRefs.title;
    if (!title) return;
    title.finish();
    titleShown = true;
  };

  const scrollNow = () => parts.getLenis()?.scroll ?? window.scrollY;

  /** Read the page: the screen, the bar, the gutter, the anchors, the title. */
  const measure = () => {
    stale = false;
    const vw = layer.clientWidth;
    const vh = layer.clientHeight;
    if (vw <= 0 || vh <= 0) return;
    const navH = probe.offsetHeight;
    const gutter = probe.offsetWidth;
    const anchors = measureAnchors(root);
    // The film says where its picture is. At the top of the page that is the preview's slot.
    if (stageRefs.film && window.scrollY < 1) slot = { ...stageRefs.film };
    path = buildPath(completeLayout(vw, vh, navH, gutter, anchors, slot));
    const rect = stageRefs.title?.rect();
    titleBox =
      rect && rect.width > 0
        ? { x: rect.left, y: rect.top + window.scrollY, w: rect.width, h: rect.height }
        : null;
    scene?.resize(vw, vh);
    const hero = path.layout.anchors[0];
    if (hero) parts.onStill({ x: hero.x, y: hero.y, size: hero.w });
  };

  const introGeo = (): IntroGeo => {
    const { vw, vh, navH, gutter, anchors } = path.layout;
    const hero = anchors[0];
    const first = path.at(0);
    return {
      vw,
      vh,
      // Until the first screen is there, a title as the design draws it: under the bar, as wide
      // as the page between the gutters.
      title: titleBox ?? {
        x: gutter,
        y: navH,
        w: vw - 2 * gutter,
        h: Math.min(0.34 * vh, 0.3 * vw),
      },
      hero: { x: hero?.x ?? first.x, y: hero?.y ?? first.y, size: hero?.w ?? first.size },
      restTurn: first.restTurn,
    };
  };

  /** Put the drone where the scroll says it is, at rest. */
  const placeAtScroll = () => {
    const t = path.at(scrollNow());
    syncFollower(follower, { ...t, yaw: t.restTurn, pitch: 0, roll: 0 }, 0);
    follower.x.v = 0;
    follower.y.v = 0;
    follower.size.v = 0;
    placed = true;
  };

  /** End the opening where it is: the title whole, everything shown, the flight carries on. */
  const endIntro = () => {
    introT = -1;
    seeking = null;
    showTitle();
    setPhase("done");
  };

  /** The loading screen is gone, the tab is seen and the scene is ready (or will never be). */
  const curtain = document.querySelector<HTMLElement>('[data-overlay="transition"]');
  const mayStart = () =>
    useSiteStore.getState().entered &&
    curtain?.dataset.active !== "true" &&
    !document.hidden &&
    engine !== "pending";

  const tryStart = () => {
    if (disposed || introPlayed || !mayStart()) return;
    introPlayed = true;
    // Always a fresh look at the page here: the title may have been measured before its faces
    // had arrived.
    measure();
    // Asked for off (a test), or the page was opened part way down: no flight.
    if (introOff() || window.scrollY > OPENED_DOWN) {
      placeAtScroll();
      endIntro();
      return;
    }
    introT = 0;
    calm = 0;
    held = 0;
    edge = Infinity;
    setPhase("title");
  };

  /** The visitor scrolls during the flight: the opening gives way at once, with no jump. */
  const onIntent = () => {
    if (introT < 0 || seeking !== null) return;
    endIntro();
  };
  const onKey = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.key)) onIntent();
  };

  /** One frame of the opening. Returns the frame's extras for the rig and the trail. */
  const stepIntro = (dt: number) => {
    const at = seeking ?? introT;
    const f = introAt(introGeo(), at);
    if (f.phase === "title") {
      edge = seeking !== null ? f.edge : Math.min(edge, f.edge);
      stageRefs.title?.setEdge(edge);
    } else {
      showTitle();
    }
    // With no scene the title is all there is to play: the description and the reel come as
    // soon as it is whole.
    setPhase(engine === "none" && f.phase === "landing" ? "landed" : f.phase);
    syncFollower(follower, f, dt);
    placed = true;
    Object.assign(pose, { x: f.x, y: f.y, size: f.size, yaw: f.yaw, pitch: f.pitch, roll: f.roll });
    if (seeking === null) {
      if (calm < CALM_FRAMES && held < CALM_WAIT) {
        calm = dt > 0 && dt < 0.03 ? calm + 1 : 0;
        held += dt;
      } else {
        introT += dt;
      }
      const end = engine === "none" ? INTRO.pass + 0.7 : INTRO.done;
      if (introT >= end) endIntro();
    }
    return f;
  };

  const press = () => {
    const now = performance.now();
    presses = presses.filter((t) => now - t < DIZZY_WINDOW);
    presses.push(now);
    if (presses.length >= DIZZY_PRESSES) {
      // It is refused while another answer plays: then it comes next, when that one is over.
      dizzyNext = !startTrick(tricks, "dizzy", 1);
      presses = [];
      return;
    }
    const kind = ANSWERS[answer % ANSWERS.length] ?? "hop";
    if (startTrick(tricks, kind, answer % 2 === 0 ? 1 : -1)) answer += 1;
  };

  const setButton = (on: boolean) => {
    if (on === buttonOn) return;
    buttonOn = on;
    button.inert = !on;
    if (on) delete button.dataset.off;
    else button.dataset.off = "";
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const elapsed = Math.max(0, (now - last) / 1000);
    const dt = frozen ? 0 : Math.min(0.05, elapsed);
    last = now;
    time += dt;
    if (stale) measure();
    const { vw, vh, navH } = path.layout;
    if (vw <= 1) return;

    const scroll = scrollNow();
    const moved = scroll - lastScroll;
    lastScroll = scroll;
    if (dt > 0) scrollSpeed = mix(scrollSpeed, Math.abs(moved) / dt / vh, 1 - Math.exp(-12 * dt));
    target = path.at(scroll);
    const film = stageRefs.film ?? path.film(scroll);

    let effort = 0;
    let flare = 0;
    let trail = 0;
    let wantedFace: FaceName = target.face;
    let eye = { x: 0, y: 0 };

    // A scroll that no wheel, touch or key announced (the scrollbar, a button that scrolls the
    // page) ends the opening the same way.
    if (introT >= 0 && seeking === null && scroll > OPENED_DOWN) endIntro();

    if (introT >= 0 || seeking !== null) {
      // The opening keeps to the wall clock (the title must be whole in its time), so a slow
      // frame is taken nearly whole here, where the springs below are stepped with care.
      const f = stepIntro(frozen ? 0 : Math.min(0.1, elapsed));
      effort = f.effort;
      flare = f.flare;
      trail = f.trail;
      wantedFace = f.face;
      speed = flightOf(follower, vh).speed;
    } else if (phase === "wait") {
      // Parked off the right of the screen, where the opening starts.
      const f = introAt(introGeo(), 0);
      Object.assign(pose, {
        x: f.x,
        y: f.y,
        size: f.size,
        yaw: f.yaw,
        pitch: f.pitch,
        roll: f.roll,
      });
    } else {
      if (!placed) placeAtScroll();

      // Which side of the film, and a way round when the change cannot be made in place.
      const layered = layerStep({
        wanted: path.side(scroll),
        actual: side,
        pose,
        target,
        film,
        vw,
        vh,
        navH,
        hurry: scrollSpeed > HURRY_SPEED,
      });
      if (layered.side !== side) {
        side = layered.side;
        layer.style.zIndex = String(side === "front" ? FRONT : LAYER.drone);
      }
      const goal = layered.detour ?? target;

      // A jump of the scroll to the far end of the page: the drone comes in from just off the
      // screen, not from thousands of pixels away.
      const far = 1.6 * vh;
      const dy = follower.y.x - goal.y;
      if (Math.abs(dy) > far) follower.y.x = goal.y + Math.sign(dy) * far;

      // At rest it looks at the pointer: the body turns and the eyes slide the same way.
      const p = parts.pointer.current;
      const point =
        stageRefs.gaze ?? (p.active && p.type === "mouse" ? { x: p.clientX, y: p.clientY } : null);
      engaged = mix(engaged, point ? 1 : 0, 1 - Math.exp(-5 * dt));
      const look = lookAt(pose, point, vh);
      eye = { x: look.eyeX * engaged, y: look.eyeY * engaged };
      // On the window's edge its chin is behind the film: it does not bow its face out of sight.
      const peeking = target.station === "perch" && side === "behind";
      const rest = {
        yaw: mix(target.restTurn, target.restTurn * 0.3 + look.yaw, engaged),
        pitch: peeking ? -0.1 + Math.min(0.12, look.pitch * engaged) : 0.03 + look.pitch * engaged,
      };
      stepFollower(follower, goal, rest, vh, dt);
      const flight = flightOf(follower, vh);
      speed = flight.speed;

      stepTricks(tricks, dt, { ...flight, travelling: target.travelling });
      if (dizzyNext && startTrick(tricks, "dizzy", 1)) dizzyNext = false;
      const show = trickPose(tricks);
      const span = Math.max(1, path.spin.to - path.spin.from);
      const turned = stepSpin(
        spin,
        Math.abs(moved) < 0.5 * vh ? moved : 0,
        scroll > path.spin.from && scroll < path.spin.to,
        (STATEMENT_TURNS * 2 * Math.PI) / span,
        dt,
      );

      const calm = 1 - flight.fast;
      const float = floatOf(time, calm, follower.size.x);
      pose.size = follower.size.x;
      pose.x = follower.x.x + float.dx + show.dx * pose.size;
      pose.y = follower.y.x + float.dy + show.dy * pose.size;
      pose.yaw = follower.yaw.x + turned + show.yaw;
      pose.pitch = follower.pitch.x + float.pitch + show.pitch;
      pose.roll = follower.roll.x + float.roll + show.roll;

      // It opens its wings to brake when it is slowing down hard.
      const along =
        flight.speed > 0.05
          ? -(flight.vx * follower.ax + flight.vy * follower.ay) / vh / flight.speed
          : 0;
      effort = show.effort;
      flare = Math.max(show.flare, ramp(1.2, 5, along) * ramp(0.1, 0.5, flight.speed));
      trail = ramp(0.55, 1.7, flight.speed);
      wantedFace = show.face ?? target.face;
    }

    glee = mix(glee, wantedFace === "happy" || hovered ? 1 : 0, 1 - Math.exp(-8 * dt));
    rigPose = stepRig(
      rig,
      {
        fast: flightOf(follower, vh).fast,
        effort,
        flare,
        ax: follower.ax / vh,
        ay: follower.ay / vh,
        happy: glee,
        time,
      },
      dt,
    );
    faceFrame = stepFace(face, wantedFace, eye, dt);

    // The trail: the places the drone has just been. In the opening they are worked out from
    // the opening itself (it is a function of time), so a held frame shows its true trail.
    trailPoints.length = 0;
    if (introT >= 0 || seeking !== null) {
      const at = seeking ?? introT;
      const geo = introGeo();
      for (let k = 0; k < TRAIL_PLACES; k += 1) {
        const age = k / (TRAIL_PLACES - 1);
        const back = at - age * TRAIL_LIFE;
        if (back < 0) break;
        const f = introAt(geo, back);
        trailPoints.push({ x: f.x, y: f.y, age });
      }
      been = [];
    } else if (dt > 0) {
      been.unshift({ x: pose.x, y: pose.y, t: time });
      while (been.length > TRAIL_PLACES || time - (been[been.length - 1]?.t ?? time) > TRAIL_LIFE) {
        been.pop();
      }
      if (trail > 0.01) {
        for (const b of been) trailPoints.push({ x: b.x, y: b.y, age: (time - b.t) / TRAIL_LIFE });
      }
    }

    seen = side === "front" ? 1 : uncovered(pose.x, pose.y, pose.size / 2, film);
    if (scene && engine === "ready") {
      const draw: DroneDraw = { ...pose, rig: rigPose, face: faceFrame, trail, trailPoints };
      scene.draw(draw);
    }

    // The page's own links and buttons come first: where the drone sits over one of them (a row
    // of the ledger is a link from edge to edge), its button stands down. Looked at a few times
    // a second, and only while the drone is still, so nothing is read from the page in a flight.
    sinceLook += dt;
    if (sinceLook > LOOK_EVERY && speed < 0.05 && target.travelling === 0) {
      sinceLook = 0;
      overControl = controlUnder(pose.x, pose.y, pose.size * 0.3);
    }

    // The button follows the drone while it sits where a press can reach it: at a station, slow,
    // on the screen, and not over the film's own controls or behind them.
    const overFilm = uncovered(pose.x, pose.y, pose.size / 2, film) < 1;
    const reachable =
      (phase === "done" || phase === "landed") &&
      engine === "ready" &&
      scene !== null &&
      target.travelling === 0 &&
      !target.parked &&
      !overControl &&
      speed < 0.4 &&
      pose.y > 0 &&
      pose.y < vh &&
      (side === "front" ? !overFilm : seen >= 0.6);
    setButton(reachable);
    if (reachable) {
      const k = (pose.size * 0.84) / BUTTON_PX;
      const half = BUTTON_PX / 2;
      button.style.transform = `translate3d(${(pose.x - half).toFixed(1)}px, ${(pose.y - half).toFixed(1)}px, 0) scale(${k.toFixed(3)})`;
      // The focus ring is drawn at the button's own scale: this undoes it. Written when it changes.
      if (Math.abs(k - ringScale) > 0.02 * k) {
        ringScale = k;
        button.style.setProperty("--inv", (1 / k).toFixed(4));
      }
    }
  };

  const run = () => {
    if (raf || disposed || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisible = () => {
    if (document.hidden) stop();
    else {
      run();
      tryStart();
    }
  };

  // What the opening waits for, held together: the gate, the curtain, the tab, the scene.
  const unsubscribe = useSiteStore.subscribe(tryStart);
  const watcher = new MutationObserver(tryStart);
  if (curtain) watcher.observe(curtain, { attributes: true, attributeFilter: ["data-active"] });
  document.addEventListener("visibilitychange", onVisible);

  // A new measure when the screen or the page's height changes. Only a flag is set here.
  const resized = new ResizeObserver(() => {
    stale = true;
  });
  resized.observe(layer);
  resized.observe(root);
  // The title is as wide as its faces make it: measure again when they have arrived.
  void document.fonts.ready.then(() => {
    stale = true;
  });

  window.addEventListener("wheel", onIntent, { passive: true });
  window.addEventListener("touchmove", onIntent, { passive: true });
  window.addEventListener("keydown", onKey);

  const probeApi: DroneProbe = {
    state: () => ({
      phase,
      engine,
      pose: { ...pose },
      target: { x: target.x, y: target.y, size: target.size, station: target.station },
      uncovered: seen,
      side,
      trick: tricks.active?.kind ?? null,
      speed,
    }),
    layout: () => path.layout,
    freeze: (on) => {
      frozen = on;
    },
    seekIntro: (seconds) => {
      if (stale) measure();
      introPlayed = true;
      seeking = clamp(seconds, 0, INTRO.done);
    },
    skipIntro: () => {
      introPlayed = true;
      if (stale) measure();
      if (introT < 0 && seeking === null) placeAtScroll();
      endIntro();
    },
  };
  window.__aboutDrone = probeApi;

  setButton(false);
  button.inert = true;
  button.dataset.off = "";
  run();
  tryStart();

  return {
    setScene: (next) => {
      scene = next;
      stale = true;
    },
    setEngine: (next) => {
      engine = next;
      useAboutStage.setState({ engine: next });
      tryStart();
    },
    press,
    hover: (over) => {
      hovered = over;
    },
    dispose: () => {
      disposed = true;
      stop();
      unsubscribe();
      watcher.disconnect();
      resized.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("wheel", onIntent);
      window.removeEventListener("touchmove", onIntent);
      window.removeEventListener("keydown", onKey);
      if (window.__aboutDrone === probeApi) delete window.__aboutDrone;
    },
  };
}
