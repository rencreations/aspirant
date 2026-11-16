"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { useLenis } from "@/components/smooth-scroll";
import { usePointer } from "@/lib/hooks";
import { loadMedia } from "@/lib/media-store";
import { untilItArrives } from "@/lib/retry";

import kit from "../sections/kit.module.css";
import { stageRefs, type DroneReport, type ViewPoint } from "../stage-bus";

import { createFx } from "./fx";
import { TETRA_HEIGHT, TETRA_MODEL, TETRA_MODEL_BYTES } from "./model";
import { createPerformance, type Performance } from "./performance";
import type { TetraMarks } from "./pose";
import { holdDown, jumpTo } from "./scroll-hold";
import type { StageView, TetraScene } from "./tetra-scene";
import styles from "./tetra-stage.module.css";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/** The scene's script and the model are asked for when her phase is this near the screen. */
const NEAR = "120% 0px 120% 0px";
/** The entrance starts when this much of the stage is on the screen. */
const WELL_ON = 0.6;
/** Away for longer than this, in seconds, and she waves when the stage comes back. */
const AWAY = 3;
/** A lost context that has not come back after this long is replaced by a new scene. */
const LOST_WAIT_MS = 1500;
const REBUILDS = 3;

/**
 * The hold on the scroll while her entrance plays for the first time (the owner's request, 16 Nov
 * 2026): from the moment the stage is well on the screen until she has stood up, the page does not
 * go down past the place where the whole stage is in view. It goes up freely.
 *
 * - `armed`: the entrance has not played and may still be held.
 * - `held`: the page is kept at the stage. The entrance plays, or the model is still arriving.
 * - `done`: nothing is held, now or later in this visit.
 */
type Hold = "armed" | "held" | "done";
/** The room left under the stage when the page rests on it, in pixels. */
const REST_FOOT = 24;
/** The page glides the last stretch to its rest in this long, in seconds. */
const GLIDE = 0.7;
/** One step of the scroll longer than this many screens is a jump (a link, a key), not a scroll. */
const JUMP = 1.2;
/**
 * The longest the page is held once she has set off, in milliseconds: a safety net against a hold
 * nobody released (her entrance takes about four seconds), never a timer to wait for.
 */
const HOLD_LIMIT_MS = 12_000;
/** The cue to scroll on stays this long if the visitor does not scroll, in milliseconds. */
const CUE_MS = 6000;

/** Tests turn the page's openings off: then nothing is held either. */
function introOff(): boolean {
  try {
    return window.sessionStorage.getItem("aspirants:intro") === "off";
  } catch {
    return false;
  }
}

interface TetraState {
  ready: boolean;
  running: boolean;
  frames: number;
  mode: string;
  clock: number;
  move: string | null;
  runSeconds: number;
  stood: boolean;
  /** The hold on the scroll, and the scroll position the page rests at while it is held. */
  hold: Hold;
  rest: number;
  marks: TetraMarks | null;
  /** What the drone last said of itself, and whether she takes it to be at her side. */
  drone: DroneReport | null;
  droneHere: boolean;
}

interface TetraProbe {
  state: () => TetraState;
  /** Hold the clock. The stage is still drawn, at a standstill. */
  freeze: (on: boolean) => void;
  /** One frame, this many seconds on (while frozen). */
  advance: (seconds: number) => void;
  replay: () => void;
  skip: () => void;
  press: () => void;
  hover: (over: boolean) => void;
  /** Start one of her moves by name. */
  play: (kind: string) => void;
}

declare global {
  interface Window {
    __aboutTetra?: TetraProbe;
  }
}

/**
 * Tetra's own corner of the second phase: Angela's small companion, alive on the page. She comes
 * in once (a scurry from the left edge of the screen, a trip, a beat on the ground, up again, and
 * a wave for the visitor), then she stays: she breathes, blinks, looks at the pointer, answers a
 * hover and a press, and plays with the drone when it comes to rest at her side (the anchor
 * `tetra`, in the empty air beside her head).
 *
 * This shell is not lazy. It lays the stage out, asks for the scene (three, the model) when her
 * phase comes near the screen, and runs her clock only while the stage is on the screen and the
 * tab is seen. The page's loading never waits for her. Without WebGL, or with a model that is
 * gone, the stage is taken away and the words stay (a failure handled, not a version).
 *
 * The first time a visitor scrolls down to her, the page comes to rest on the stage and is held
 * there until she has stood up (see `Hold`); then a small cue says the page moves again, once.
 */
export function TetraStage() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const marksHost = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const wait = useRef<HTMLParagraphElement>(null);
  const waitBar = useRef<HTMLSpanElement>(null);
  const cue = useRef<HTMLParagraphElement>(null);
  const actor = useRef<Performance | null>(null);
  const pointer = usePointer();
  const { getLenis } = useLenis();

  useEffect(() => {
    const box = stage.current;
    const canvasHost = host.current;
    const overlay = marksHost.current;
    const markEl = mark.current;
    const shadowEl = shadow.current;
    const buttonEl = button.current;
    const anchorEl = anchor.current;
    const part = root.current;
    const waitEl = wait.current;
    const waitFill = waitBar.current;
    const cueEl = cue.current;
    if (!box || !canvasHost || !overlay || !markEl || !shadowEl || !buttonEl || !anchorEl) return;
    if (!part || !waitEl || !waitFill || !cueEl) return;
    if (!hasWebGL()) {
      // No scene will ever be drawn: the stage and its hint are taken away, the words stay.
      part.dataset.tetra = "none";
      return;
    }

    let disposed = false;
    let scene: TetraScene | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let asked = false;
    let rebuilds = 0;
    let lostTimer = 0;

    let near = false;
    let onScreen = false;
    let wellOn = false;
    let begun = false;
    let leftAt = 0;
    let stale = true;
    let frozen = false;
    let raf = 0;
    let last = 0;
    let frames = 0;
    let buttonOn = false;
    let dronePresses = -1;
    /** The drone's place beside her, on the stage, and what is known of the drone there. */
    const side = { x: 0, y: 0, w: 100 };
    const droneWas = { x: 0, y: 0, speed: 0, seen: false };
    let droneHere = false;

    // The hold on the scroll.
    let hold: Hold = introOff() ? "done" : "armed";
    /** Where the page rests with the whole stage in view, and where the hold begins. */
    let rest = 0;
    let trigger = 0;
    let lastY = window.scrollY;
    let unhold: (() => void) | null = null;
    let safety = 0;
    let touching = false;
    let cueTimer = 0;
    let cueAt = -1;
    let cueShown = false;

    let view: StageView = { width: 1, height: 1, markX: 0, groundY: 0, tall: 300 };
    let marks: TetraMarks | null = null;
    /** The point the drone is asked to look at: her face, in the viewport. */
    const eyes: ViewPoint = { x: 0, y: 0 };

    const fx = createFx(overlay, styles.pop ?? "");
    const perf = createPerformance({
      walkSpeed: () => scene?.walkSpeed ?? 0.186,
      clipSeconds: (name) => scene?.clipSeconds(name) ?? 1,
      height: TETRA_HEIGHT,
      cue: (cue) => {
        if (!marks) return;
        const at = marks[cue.at];
        fx.pop(cue.kind, at.x + cue.dx * view.tall, at.y - cue.dy * view.tall, {
          tone: cue.tone ?? "ink",
          size: (cue.size ?? 1) * clampSize(view.tall / 360),
        });
      },
      askDrone: (move) => {
        stageRefs.ask = move;
      },
    });
    actor.current = perf;

    /** Read the stage: its size, her mark, the ground and her height. Reads only. */
    const measure = () => {
      stale = false;
      const rect = box.getBoundingClientRect();
      const at = markEl.getBoundingClientRect();
      view = {
        width: rect.width,
        height: rect.height,
        markX: at.left - rect.left,
        groundY: at.bottom - rect.top,
        tall: at.height,
      };
      const place = anchorEl.getBoundingClientRect();
      side.x = place.left + place.width / 2 - rect.left;
      side.y = place.top + place.height / 2 - rect.top;
      side.w = Math.max(40, place.width);
      // The button is as big as she is. It is sized here and only moved after, so the ring a
      // key's focus draws round it keeps its shape.
      const w = view.tall * 0.62;
      const h = view.tall * 0.98;
      buttonEl.style.width = `${w.toFixed(1)}px`;
      buttonEl.style.height = `${h.toFixed(1)}px`;
      buttonEl.style.margin = `${(-h / 2).toFixed(1)}px 0 0 ${(-w / 2).toFixed(1)}px`;
      scene?.layout(view);
    };

    const setButton = (on: boolean) => {
      if (on === buttonOn) return;
      buttonOn = on;
      buttonEl.inert = !on;
      if (on) delete buttonEl.dataset.off;
      else buttonEl.dataset.off = "";
    };

    const releaseEyes = () => {
      if (stageRefs.gaze === eyes) stageRefs.gaze = null;
    };

    /** One frame: read the page, step her, draw, then lay the shadow and the button. */
    const frame = (dt: number) => {
      if (!scene) return;
      if (stale) measure();
      const rect = box.getBoundingClientRect();
      const p = pointer.ref.current;
      const drone = stageRefs.drone;
      const droneIn =
        drone && drone.y - rect.top > -drone.size && drone.y - rect.top < rect.height + drone.size;
      // The drone is at her side while it is near its place beside her and still there (it rides
      // with the page, so its speed is taken against the stage). It has left when it is well away.
      if (drone && droneIn) {
        const x = drone.x - rect.left;
        const y = drone.y - rect.top;
        if (dt > 0 && droneWas.seen) {
          const speed = Math.hypot(x - droneWas.x, y - droneWas.y) / dt;
          droneWas.speed += (speed - droneWas.speed) * Math.min(1, 10 * dt);
        }
        droneWas.x = x;
        droneWas.y = y;
        droneWas.seen = true;
        const away = Math.hypot(x - side.x, y - side.y);
        if (!droneHere && away < 0.6 * side.w && droneWas.speed < 90) droneHere = true;
        else if (droneHere && away > 1.5 * side.w) droneHere = false;
      } else {
        droneWas.seen = false;
        droneHere = false;
      }
      const here = droneHere;
      // A press on the drone while it is beside her.
      if (drone && here && dronePresses >= 0 && drone.presses > dronePresses) perf.dronePressed();
      dronePresses = drone && here ? drone.presses : -1;

      const pose = perf.step({
        dt,
        pointer:
          p.active && p.type === "mouse"
            ? { x: p.clientX - rect.left, y: p.clientY - rect.top }
            : null,
        drone: drone && droneIn ? { x: drone.x - rect.left, y: drone.y - rect.top, here } : null,
        marks: marks ?? START,
        tall: view.tall,
        markX: view.markX,
        width: view.width,
      });
      marks = scene.draw(pose, dt);
      frames += 1;
      if (hold === "held" && perf.state().stood) release(true);

      // The drone looks at her face while she has asked for its eyes.
      if (perf.wantsEyes()) {
        eyes.x = rect.left + marks.head.x;
        eyes.y = rect.top + marks.head.y;
        stageRefs.gaze ??= eyes;
      } else {
        releaseEyes();
      }

      // The shadow: under her, longer when she lies down, smaller and paler when she is in the air.
      const lying = Math.sin(Math.min(Math.max(pose.pitch, 0), Math.PI / 2));
      const air = Math.max(0, 1 - pose.y / 0.4);
      const wide = marks.scale * (0.31 + 0.42 * lying) * (0.55 + 0.45 * air);
      shadowEl.style.transform = `translate3d(${marks.ground.x.toFixed(1)}px, ${marks.ground.y.toFixed(1)}px, 0) scale(${(wide / 100).toFixed(3)}, ${((wide * 0.2) / 100).toFixed(3)})`;
      shadowEl.style.opacity = (0.12 * air * (pose.x > -40 ? 1 : 0)).toFixed(3);

      // The button follows her once she is on her feet and living.
      const live = perf.state().mode === "live";
      setButton(live);
      if (live) {
        const y = marks.ground.y - view.tall * 0.49 - pose.y * marks.scale;
        buttonEl.style.transform = `translate3d(${marks.chest.x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = frozen ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (frozen) return;
      frame(dt);
    };

    const shouldRun = () => !disposed && scene !== null && onScreen && !document.hidden;

    const sync = () => {
      const run = shouldRun();
      if (run && !raf) {
        // After a pause the hair starts from rest, not from where a stale step left it.
        scene?.settle();
        last = performance.now();
        if (begun && leftAt > 0 && last - leftAt > AWAY * 1000) perf.comeBack();
        leftAt = 0;
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        leftAt = performance.now();
        releaseEyes();
        fx.clear();
      }
      if (run && !begun) {
        if (hold === "armed" && wellOn) {
          // Come upon from above and standing in the stretch before its rest: the hold begins
          // here. Come upon from below (the page is past its rest): she plays with nothing held.
          readRest();
          const y = window.scrollY;
          if (y > rest + 2) hold = "done";
          else if (y >= trigger) engage(y);
        }
        if (hold === "held" || (hold === "done" && wellOn)) start();
      }
    };

    /** Where the page rests on the stage, and where the hold begins. One read, no writes. */
    const readRest = () => {
      const rect = box.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const vh = window.innerHeight;
      // The whole stage in view with a little room under it. A stage taller than the screen is
      // put in the middle of it.
      const room = vh - rect.height - REST_FOOT;
      rest = Math.max(0, top - (room > 0 ? room : (vh - rect.height) / 2));
      // The hold begins when most of the stage is on the screen.
      trigger = Math.min(rest - 40, top - vh + WELL_ON * rect.height);
    };

    const start = () => {
      begun = true;
      if (stale) measure();
      perf.begin(view);
      showWait(false);
      if (hold === "held") safety = window.setTimeout(() => release(false), HOLD_LIMIT_MS);
    };

    const showWait = (on: boolean) => {
      waitEl.dataset.show = on ? "true" : "false";
    };

    const hideCue = () => {
      if (!cueShown) return;
      cueShown = false;
      window.clearTimeout(cueTimer);
      cueEl.dataset.show = "false";
    };

    /** The page is brought to rest on the stage and held there. */
    const engage = (y: number) => {
      if (hold !== "armed") return;
      hold = "held";
      unhold = holdDown({ line: () => rest, getLenis, onLetGo: () => release(false) });
      if (y > rest + 1) jumpTo(getLenis, rest);
      else if (!touching) glide();
      // The model is asked for long before this. If it has not come, the wait is shown as it is;
      // with no connection there is nothing to wait for, and the page is let go.
      if (scene) return;
      if (navigator.onLine) showWait(true);
      else release(false);
    };

    /** The last stretch to the rest, eased. A finger on the screen moves the page itself. */
    const glide = () => {
      const lenis = getLenis();
      if (window.scrollY >= rest - 1) return;
      if (lenis) {
        lenis.scrollTo(rest, { duration: GLIDE, easing: (t) => 1 - (1 - t) ** 3, force: true });
      } else {
        window.scrollTo({ top: rest, behavior: "smooth" });
      }
    };

    /** The page moves again. With `done`, she has stood up: the cue says so, once. */
    const release = (done: boolean) => {
      if (hold !== "held") {
        hold = "done";
        return;
      }
      hold = "done";
      unhold?.();
      unhold = null;
      window.clearTimeout(safety);
      showWait(false);
      // Whatever was asked of the smooth scroller while the page was held is forgotten.
      getLenis()?.scrollTo(window.scrollY, { immediate: true, force: true });
      if (!done) return;
      cueShown = true;
      cueAt = window.scrollY;
      cueEl.dataset.show = "true";
      cueTimer = window.setTimeout(hideCue, CUE_MS);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (cueShown && Math.abs(y - cueAt) > 12) hideCue();
      if (hold !== "armed") return;
      if (begun) {
        hold = "done";
        return;
      }
      if (dy <= 0 || document.hidden) return;
      readRest();
      // Going down, by a scroll and not a jump, from above the rest into the stretch before it
      // (or, in one long step, a little past it).
      const span = JUMP * window.innerHeight;
      if (dy < span && y >= trigger && y - dy <= rest + 2 && y <= rest + span) engage(y);
    };
    const onTouchStart = () => {
      touching = true;
    };
    const onTouchEnd = () => {
      touching = false;
      if (hold === "held") glide();
    };
    const onOffline = () => {
      // Held for a model that cannot arrive now: the page is let go.
      if (hold === "held" && !scene) release(false);
    };
    const onHidden = () => {
      // A tab that is put away must not come back to a page that does not scroll.
      if (document.hidden && hold === "held") release(false);
    };

    /** Build the scene on a canvas made here (a lost context cannot be used again). */
    const build = () => {
      if (disposed) return;
      asked = true;
      const made = document.createElement("canvas");
      made.setAttribute("aria-hidden", "true");
      canvasHost.replaceChildren(made);
      canvas = made;
      const rebuild = () => {
        if (disposed || canvas !== made) return;
        scene?.dispose();
        scene = null;
        sync();
        if (rebuilds >= REBUILDS) {
          made.remove();
          part.dataset.tetra = "none";
          release(false);
          return;
        }
        rebuilds += 1;
        build();
      };
      void (async () => {
        // The script is asked for until it arrives, as every file of the site is.
        const loaded = await untilItArrives(async () =>
          disposed ? null : import("./tetra-scene"),
        );
        if (disposed || !loaded || canvas !== made) return;
        try {
          const next = await loaded.createTetraScene(made, {
            onLost: () => {
              lostTimer = window.setTimeout(rebuild, LOST_WAIT_MS);
            },
            onRestored: () => {
              window.clearTimeout(lostTimer);
            },
          });
          if (disposed || canvas !== made) {
            next.dispose();
            return;
          }
          scene = next;
          stale = true;
          part.dataset.tetra = "ready";
          sync();
        } catch {
          // A model that is gone or is not hers: the stage is taken away and nothing is held.
          made.remove();
          part.dataset.tetra = "none";
          release(false);
        }
      })();
    };

    // Her phase near the screen: ask for the model and the scene, so she is there when she is
    // due. The stage on the screen: run. Well on it: the entrance.
    const nearby = new IntersectionObserver(
      (entries) => {
        near = entries.some((entry) => entry.isIntersecting);
        if (!near || asked) return;
        // The model's bytes are counted here, for the wait a visitor may see. The scene takes the
        // same download from the store.
        void loadMedia(TETRA_MODEL, {
          type: "model/gltf-binary",
          expectedBytes: TETRA_MODEL_BYTES,
          onFraction: (fraction) => {
            waitFill.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction)).toFixed(3)})`;
          },
        });
        build();
      },
      { rootMargin: NEAR },
    );
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScreen = entry.isIntersecting;
          wellOn = entry.intersectionRatio >= WELL_ON;
        }
        sync();
      },
      { threshold: [0, WELL_ON] },
    );
    // The block of her phase (the videos and the music come before her in it), or the stage.
    nearby.observe(part.parentElement?.closest<HTMLElement>("[data-phase]") ?? box);
    nearby.observe(box);
    seen.observe(box);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onHidden);

    const resized = new ResizeObserver(() => {
      stale = true;
    });
    resized.observe(box);
    document.addEventListener("visibilitychange", sync);

    const probe: TetraProbe = {
      state: () => ({
        ready: scene !== null,
        running: raf !== 0,
        frames,
        ...perf.state(),
        hold,
        rest,
        marks,
        drone: stageRefs.drone ? { ...stageRefs.drone } : null,
        droneHere: dronePresses >= 0,
      }),
      freeze: (on) => {
        frozen = on;
        fx.hold(on);
      },
      advance: (seconds) => {
        fx.advance(seconds);
        frame(seconds);
      },
      replay: () => {
        if (stale) measure();
        fx.clear();
        scene?.settle();
        begun = true;
        perf.replay(view);
      },
      skip: () => {
        begun = true;
        release(false);
        perf.skip();
      },
      press: () => perf.press(),
      hover: (over) => perf.hover(over),
      play: (kind) => perf.play(kind),
    };
    window.__aboutTetra = probe;

    setButton(false);
    buttonEl.inert = true;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(lostTimer);
      nearby.disconnect();
      seen.disconnect();
      resized.disconnect();
      document.removeEventListener("visibilitychange", sync);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      unhold?.();
      window.clearTimeout(safety);
      window.clearTimeout(cueTimer);
      releaseEyes();
      fx.clear();
      scene?.dispose();
      scene = null;
      canvas?.remove();
      actor.current = null;
      if (window.__aboutTetra === probe) delete window.__aboutTetra;
    };
  }, [pointer.ref, getLenis]);

  return (
    <div ref={root} className={styles.tetra} data-phase-part="tetra" data-phase={2}>
      <header className={styles.head} data-in="false">
        <p className={kit.eyebrow}>
          <b>Tetra</b>
          <span>With Angela</span>
          <span className={kit.eyebrowRule} aria-hidden="true" />
          <span>Cyber Cherubin</span>
        </p>
        <p className={`serif ${styles.line}`}>
          <span className={kit.mask}>
            <span className={kit.line}>Tetra.</span>
          </span>
          <span className={kit.mask}>
            <span className={kit.line} style={i(1)}>
              <em>Angela&rsquo;s little companion.</em>
            </span>
          </span>
        </p>
      </header>

      <div ref={stage} className={styles.stage} data-tetra-stage="">
        <div className={styles.floor} aria-hidden="true" />
        <div ref={mark} className={styles.mark} aria-hidden="true" />
        <div ref={shadow} className={styles.shadow} aria-hidden="true" />
        <div ref={host} className={styles.canvas} aria-hidden="true" />
        <div ref={marksHost} className={styles.marks} aria-hidden="true" />
        <div
          ref={anchor}
          className={`${kit.anchor} ${styles.anchor}`}
          aria-hidden="true"
          data-drone-anchor="tetra"
          data-drone-face="happy"
          data-drone-turn={-28}
        />
        <button
          ref={button}
          type="button"
          className={styles.button}
          aria-label="Tetra. Press to say hello."
          data-cursor="HELLO"
          data-off=""
          onClick={() => actor.current?.press()}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") actor.current?.hover(true);
          }}
          onPointerLeave={() => actor.current?.hover(false)}
        />
        <p ref={wait} className={styles.wait} data-show="false" role="status">
          <span>Tetra is on her way</span>
          <span className={styles.waitTrack} aria-hidden="true">
            <span ref={waitBar} className={styles.waitFill} />
          </span>
        </p>
        <p ref={cue} className={styles.cue} data-show="false" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </p>
      </div>

      <p className={styles.foot} data-in="false">
        <span>
          <b>Say hello.</b> Tetra answers a press.
        </span>
        <span className={`serif ${styles.gift}`}>Tetra is a gift from Ruby to Angela.</span>
      </p>
    </div>
  );
}

/** Before her first frame the marks are asked for nowhere; this stands in. */
const START: TetraMarks = {
  head: { x: 0, y: 0 },
  crown: { x: 0, y: 0 },
  chest: { x: 0, y: 0 },
  ground: { x: 0, y: 0 },
  handR: { x: 0, y: 0 },
  handL: { x: 0, y: 0 },
  scale: 1,
};

/** The comic marks grow with her, within reason. */
function clampSize(v: number): number {
  return Math.min(1.25, Math.max(0.7, v));
}
