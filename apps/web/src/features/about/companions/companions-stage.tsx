"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { usePointer } from "@/lib/hooks";
import { untilItArrives } from "@/lib/retry";

import kit from "../sections/kit.module.css";
import { stageRefs, type DroneReport, type ViewPoint } from "../stage-bus";

import type { CompanionsScene } from "./companions-scene";
import styles from "./companions-stage.module.css";
import { FACES, type FaceName } from "./face";
import { createFx } from "./fx";
import { createPerformance, SCENE_SECONDS, type Performance, type StageView } from "./performance";
import type { Cast } from "./pose";

const i = (n: number) => ({ "--i": n }) as CSSProperties;

/** The scene's script and the model are asked for when the stage is this near the screen. */
const NEAR = "120% 0px 120% 0px";
/** Farther than this from the screen, the scene and its WebGL context are given back. */
const FAR = "280% 0px 280% 0px";
/** The scene starts when this much of the stage is on the screen. */
const WELL_ON = 0.6;
/** It waits this long for our drone to come to its place, then starts without it. */
const DRONE_WAIT_MS = 1600;
/** Away for longer than this, in seconds, and they greet the visitor when the stage comes back. */
const AWAY = 3;
/** A lost context that has not come back after this long is replaced by a new scene. */
const LOST_WAIT_MS = 1500;
const REBUILDS = 3;

interface CompanionsState {
  ready: boolean;
  running: boolean;
  frames: number;
  builds: number;
  mode: string;
  clock: number;
  withDrone: boolean;
  moves: Array<string | null>;
  seconds: number;
  marks: number;
  cast: Array<{ x: number; y: number; radius: number }>;
  view: StageView;
  drone: DroneReport | null;
  droneHere: boolean;
}

interface CompanionsProbe {
  state: () => CompanionsState;
  /** Hold the clock. The stage is still drawn, at a standstill. */
  freeze: (on: boolean) => void;
  /** One frame, this many seconds on (while frozen). */
  advance: (seconds: number) => void;
  replay: () => void;
  skip: () => void;
  press: (who: number) => void;
  hover: (who: number, over: boolean) => void;
  /** Start one of their moves by name. */
  play: (kind: string, who?: number) => void;
  /** Hold one face on one of them, or let it go with null. */
  face: (who: number, name: string | null) => void;
  /** Whether the scene is played to our drone even when it is not there (the probes). */
  pretendDrone: (on: boolean) => void;
}

declare global {
  interface Window {
    __aboutCompanions?: CompanionsProbe;
  }
}

/**
 * Guinevere's two drones, alive on the page, in the fourth phase. They play one scene, once (the
 * bold one rolls in behind its own glove and calls the soft one out of hiding, they find our
 * drone, bump fists with it, copy its roll and throw a glove over its head, they leave and cannot
 * stay away), then they stay: they bob, blink, look at the pointer, at each other and at our
 * drone, and each answers a hover and a press in its own way. Our drone's place is the anchor
 * `companions`, in the air between them.
 *
 * This shell is not lazy. It lays the stage out, asks for the scene (three, the model) when the
 * stage comes near the screen, runs the clock only while the stage is on the screen and the tab
 * is seen, and gives the scene and its WebGL context back when the stage is far away: the story
 * lives here, so a scene built again goes on where the two were. The page's loading never waits
 * for them and the scroll is never held. Without WebGL, or with a model that is gone, the stage
 * is taken away and the words stay (a failure handled, not a version).
 */
export function CompanionsStage() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const marksHost = useRef<HTMLDivElement>(null);
  const spotA = useRef<HTMLDivElement>(null);
  const spotB = useRef<HTMLDivElement>(null);
  const shadowA = useRef<HTMLDivElement>(null);
  const shadowB = useRef<HTMLDivElement>(null);
  const buttonA = useRef<HTMLButtonElement>(null);
  const buttonB = useRef<HTMLButtonElement>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const actors = useRef<Performance | null>(null);
  const pointer = usePointer();

  useEffect(() => {
    const part = root.current;
    const box = stage.current;
    const canvasHost = host.current;
    const overlay = marksHost.current;
    const aEl = spotA.current;
    const bEl = spotB.current;
    const anchorEl = anchor.current;
    const shadows = [shadowA.current, shadowB.current];
    const buttons = [buttonA.current, buttonB.current];
    if (!part || !box || !canvasHost || !overlay || !aEl || !bEl || !anchorEl) return;
    const [shadow0, shadow1] = shadows;
    const [button0, button1] = buttons;
    if (!shadow0 || !shadow1 || !button0 || !button1) return;
    const shadowEls = [shadow0, shadow1] as const;
    const buttonEls = [button0, button1] as const;
    if (!hasWebGL()) {
      // No scene will ever be drawn: the stage and its hint are taken away, the words stay.
      part.dataset.companions = "none";
      return;
    }

    let disposed = false;
    let scene: CompanionsScene | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let asked = false;
    let gone = false;
    let rebuilds = 0;
    let builds = 0;
    let lostTimer = 0;

    let onScreen = false;
    let wellOn = false;
    let wellSince = 0;
    let begun = false;
    let leftAt = 0;
    let stale = true;
    let frozen = false;
    let pretend = false;
    let raf = 0;
    let last = 0;
    let frames = 0;
    let buttonsOn = false;
    let dronePresses = -1;
    const droneWas = { x: 0, y: 0, speed: 0, seen: false };
    let droneHere = false;
    let floorY = 0;
    let cast: Cast | null = null;

    let view: StageView = {
      width: 1,
      height: 1,
      radius: 40,
      a: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      d: { x: 0, y: 0 },
      droneSize: 100,
    };
    /** The point our drone is asked to look at, in the viewport. */
    const eyes: ViewPoint = { x: 0, y: 0 };

    const fx = createFx(overlay, styles.pop ?? "");
    const perf = createPerformance({
      cue: (kind, x, y, tone, size, turn) => fx.pop(kind, x, y, { tone, size, turn }),
      askDrone: (move) => {
        stageRefs.ask = move;
      },
    });
    actors.current = perf;

    /** Read the stage: its size, the two places, our drone's place and the ball. Reads only. */
    const measure = () => {
      stale = false;
      const rect = box.getBoundingClientRect();
      const middle = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
      };
      const place = anchorEl.getBoundingClientRect();
      view = {
        width: rect.width,
        height: rect.height,
        radius: Math.max(16, aEl.getBoundingClientRect().width / 2),
        a: middle(aEl),
        b: middle(bEl),
        d: middle(anchorEl),
        droneSize: Math.max(60, place.width),
      };
      floorY =
        rect.height *
        (1 - Number.parseFloat(getComputedStyle(part).getPropertyValue("--floor") || "9") / 100);
      // A button is as big as a ball with its ears. It is sized here and only moved after, so the
      // ring a key's focus draws round it keeps its shape.
      const size = view.radius * 2.9;
      for (const el of buttonEls) {
        el.style.width = `${size.toFixed(1)}px`;
        el.style.height = `${size.toFixed(1)}px`;
        el.style.margin = `${(-size / 2).toFixed(1)}px 0 0 ${(-size / 2).toFixed(1)}px`;
      }
      scene?.layout(view.width, view.height);
    };

    const setButtons = (on: boolean) => {
      if (on === buttonsOn) return;
      buttonsOn = on;
      for (const el of buttonEls) {
        el.inert = !on;
        if (on) delete el.dataset.off;
        else el.dataset.off = "";
      }
    };

    const releaseEyes = () => {
      if (stageRefs.gaze === eyes) stageRefs.gaze = null;
    };

    /** One frame: read the page, step the two, draw, then lay the shadows and the buttons. */
    const frame = (dt: number) => {
      if (!scene) return;
      if (stale) measure();
      const rect = box.getBoundingClientRect();
      const p = pointer.ref.current;
      const drone = stageRefs.drone;
      const droneIn =
        drone && drone.y - rect.top > -drone.size && drone.y - rect.top < rect.height + drone.size;
      // Our drone is with them while it is near its place here and still there (it rides with the
      // page, so its speed is taken against the stage). It has left when it is well away.
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
        const away = Math.hypot(x - view.d.x, y - view.d.y);
        if (!droneHere && away < 0.6 * view.droneSize && droneWas.speed < 90) droneHere = true;
        else if (droneHere && away > 1.5 * view.droneSize) droneHere = false;
      } else {
        droneWas.seen = false;
        droneHere = false;
      }
      const here = droneHere || pretend;
      // A press on our drone while it is with them.
      if (drone && droneHere && dronePresses >= 0 && drone.presses > dronePresses) {
        perf.dronePressed();
      }
      dronePresses = drone && droneHere ? drone.presses : -1;

      // The scene starts when the stage is well on the screen and our drone has come, or has not
      // come in a while.
      if (!begun && wellOn && (here || performance.now() - wellSince > DRONE_WAIT_MS)) {
        begun = true;
        perf.begin();
      }

      const stepped = perf.step({
        dt,
        pointer:
          p.active && p.type === "mouse"
            ? { x: p.clientX - rect.left, y: p.clientY - rect.top }
            : null,
        drone:
          drone && droneIn
            ? { x: drone.x - rect.left, y: drone.y - rect.top, here }
            : pretend
              ? { x: view.d.x, y: view.d.y, here: true }
              : null,
        view,
      });
      cast = stepped;
      scene.draw(stepped);
      frames += 1;

      // Our drone looks where the scene says.
      const look = perf.eyes();
      if (look && droneHere) {
        eyes.x = rect.left + look.x;
        eyes.y = rect.top + look.y;
        stageRefs.gaze ??= eyes;
      } else {
        releaseEyes();
      }

      // The shadows: on the ground under each, smaller and paler the higher it is.
      const open = perf.open();
      setButtons(open);
      for (let k = 0; k < 2; k += 1) {
        const pose = stepped[k];
        const shadowEl = shadowEls[k];
        const buttonEl = buttonEls[k];
        if (!pose || !shadowEl || !buttonEl) continue;
        const height = Math.max(0, floorY - pose.y) / Math.max(1, view.height);
        const near = Math.max(0.25, 1 - height * 0.9);
        const wide = (pose.radius * 2.2 * near) / 100;
        const inside = pose.x > -pose.radius && pose.x < view.width + pose.radius && pose.z > -300;
        shadowEl.style.transform = `translate3d(${pose.x.toFixed(1)}px, ${floorY.toFixed(1)}px, 0) scale(${wide.toFixed(3)}, ${(wide * 0.16).toFixed(3)})`;
        shadowEl.style.opacity = (inside ? 0.1 * near : 0).toFixed(3);
        if (open) {
          buttonEl.style.transform = `translate3d(${pose.x.toFixed(1)}px, ${(pose.y - pose.radius * 0.3).toFixed(1)}px, 0)`;
        }
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
    };

    /** Give the scene and its context back. The story stays here, in the performance. */
    const release = () => {
      window.clearTimeout(lostTimer);
      scene?.dispose();
      scene = null;
      canvas?.remove();
      canvas = null;
      asked = false;
      cast = null;
      sync();
      if (!gone) delete part.dataset.companions;
    };

    /** Build the scene on a canvas made here (a lost context cannot be used again). */
    const build = () => {
      if (disposed || gone) return;
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
          gone = true;
          part.dataset.companions = "none";
          return;
        }
        rebuilds += 1;
        build();
      };
      void (async () => {
        // The script is asked for until it arrives, as every file of the site is.
        const loaded = await untilItArrives(async () =>
          disposed ? null : import("./companions-scene"),
        );
        if (disposed || !loaded || canvas !== made) return;
        try {
          const next = await loaded.createCompanionsScene(made, {
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
          builds += 1;
          stale = true;
          part.dataset.companions = "ready";
          sync();
        } catch {
          // A model that is gone or is not theirs: the stage is taken away.
          made.remove();
          gone = true;
          part.dataset.companions = "none";
        }
      })();
    };

    // Near the screen: ask for the scene. On it: run. Well on it: the scene. Far: give it back.
    const nearby = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !asked) build();
      },
      { rootMargin: NEAR },
    );
    const far = new IntersectionObserver(
      (entries) => {
        if (entries.every((entry) => !entry.isIntersecting) && asked) release();
      },
      { rootMargin: FAR },
    );
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScreen = entry.isIntersecting;
          const well = entry.intersectionRatio >= WELL_ON;
          if (well && !wellOn) wellSince = performance.now();
          wellOn = well;
        }
        sync();
      },
      { threshold: [0, WELL_ON] },
    );
    nearby.observe(box);
    far.observe(box);
    seen.observe(box);

    const resized = new ResizeObserver(() => {
      stale = true;
    });
    resized.observe(box);
    document.addEventListener("visibilitychange", sync);

    const probe: CompanionsProbe = {
      state: () => ({
        ready: scene !== null,
        running: raf !== 0,
        frames,
        builds,
        ...perf.state(),
        seconds: SCENE_SECONDS,
        marks: fx.count(),
        cast: (cast ?? []).map((pose) => ({ x: pose.x, y: pose.y, radius: pose.radius })),
        view,
        drone: stageRefs.drone ? { ...stageRefs.drone } : null,
        droneHere,
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
        begun = true;
        perf.replay();
      },
      skip: () => {
        begun = true;
        perf.skip();
      },
      press: (who) => perf.press(who),
      hover: (who, over) => perf.hover(who, over),
      play: (kind, who = 0) => {
        begun = true;
        perf.play(kind, who);
      },
      face: (who, name) => {
        perf.hold(who, name !== null && name in FACES ? (name as FaceName) : null);
      },
      pretendDrone: (on) => {
        pretend = on;
      },
    };
    window.__aboutCompanions = probe;

    setButtons(false);
    for (const el of buttonEls) {
      el.inert = true;
      el.dataset.off = "";
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(lostTimer);
      nearby.disconnect();
      far.disconnect();
      seen.disconnect();
      resized.disconnect();
      document.removeEventListener("visibilitychange", sync);
      releaseEyes();
      fx.clear();
      scene?.dispose();
      scene = null;
      canvas?.remove();
      actors.current = null;
      if (window.__aboutCompanions === probe) delete window.__aboutCompanions;
    };
  }, [pointer.ref]);

  const button = (who: 0 | 1, label: string) => (
    <button
      ref={who === 0 ? buttonA : buttonB}
      type="button"
      className={styles.button}
      aria-label={label}
      data-cursor={who === 0 ? "SPAR" : "HELLO"}
      data-off=""
      onClick={() => actors.current?.press(who)}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") actors.current?.hover(who, true);
      }}
      onPointerLeave={() => actors.current?.hover(who, false)}
    />
  );

  return (
    <div ref={root} className={styles.companions} data-phase-part="companions" data-phase={4}>
      <header className={styles.head} data-in="false">
        <p className={kit.eyebrow}>
          <b>The drones</b>
          <span>With Guinevere</span>
          <span className={kit.eyebrowRule} aria-hidden="true" />
          <span>Daybreak Halo</span>
        </p>
        <p className={`serif ${styles.line}`}>
          <span className={kit.mask}>
            <span className={kit.line}>Guinevere&rsquo;s two drones.</span>
          </span>
          <span className={kit.mask}>
            <span className={kit.line} style={i(1)}>
              <em>And their four gloves.</em>
            </span>
          </span>
        </p>
      </header>

      <div ref={stage} className={styles.stage} data-companions-stage="">
        <div className={styles.floor} aria-hidden="true" />
        <div ref={spotA} className={styles.spot} data-spot="a" aria-hidden="true" />
        <div ref={spotB} className={styles.spot} data-spot="b" aria-hidden="true" />
        <div ref={shadowA} className={styles.shadow} aria-hidden="true" />
        <div ref={shadowB} className={styles.shadow} aria-hidden="true" />
        <div ref={host} className={styles.canvas} aria-hidden="true" />
        <div ref={marksHost} className={styles.marks} aria-hidden="true" />
        <div
          ref={anchor}
          className={`${kit.anchor} ${styles.anchor}`}
          aria-hidden="true"
          data-drone-anchor="companions"
          data-drone-face="happy"
        />
        {button(0, "One of Guinevere's drones, the bold one. Press it.")}
        {button(1, "The other of Guinevere's drones, the shy one. Press it.")}
      </div>

      <p className={styles.foot} data-in="false">
        <span>
          <b>Press one.</b> Then the other.
        </span>
        <span className={styles.credit}>
          The drones on this stage are a game model of Mobile Legends: Bang Bang.
        </span>
      </p>
    </div>
  );
}
