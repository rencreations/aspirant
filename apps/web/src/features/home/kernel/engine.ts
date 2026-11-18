/**
 * The engine of the home page: the one place where the clock, the scroll, the pointer, the stage,
 * the ground, the sections and the probes are put together. It is a lazy chunk (the loading list
 * waits for it) and everything it makes is torn down by `dispose`, so a second mount never finds a
 * first one alive. The thin shell that starts it is `features/home/home-stage.tsx`.
 */
import { audio } from "@/lib/audio";
import { selectIsOpen, useHomeFlow } from "@/lib/home-flow";
import { expectReady } from "@/lib/page-ready";
import { useNavLock } from "@/lib/nav-lock";

import type { BootRuntime } from "../boot/runtime";
import { ActorRegistry } from "./actors";
import { LABS } from "./lab";
import { Background, groundAt, type GroundLayers } from "./background";
import { Clock, ORDER } from "./clock";
import { CursorProxy } from "./cursor";
import { holdScroll } from "./hold";
import { isRunning, layoutSections } from "./layout";
import { PointerHub } from "./pointer";
import { installProbes, type HomeSnapshot } from "./probes";
import { SectionRunner } from "./run";
import { SceneScroll, screensOf } from "./scroll";
import { createStage } from "./stage";
import type { FrameInfo, HomeSection, ScrollApi, SectionCtx, Viewport } from "./types";

export interface EngineOptions {
  /** The root of the home page: the slots are found inside it. */
  root: HTMLElement;
  /** The fixed box (100lvh) the canvas goes in. Its height is the unit of the scroll. */
  host: HTMLElement;
  grounds: GroundLayers;
  sections: readonly HomeSection[];
  /** Move the page (pixels). The shell binds it to the smooth scroller. */
  scrollTo(y: number, options?: { immediate?: boolean }): void;
  /** The stage could not be made or was lost for good: the page lays itself out plain. */
  onFailed(): void;
  /** The first frame has been drawn (two frames after the engine started). */
  onFirstFrame(): void;
}

export interface Engine {
  dispose(): void;
}

let current: Engine | null = null;

function slot(root: HTMLElement, kind: "below" | "text", id: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-home-${kind}="${id}"]`);
}

function setOn(el: HTMLElement | null, on: boolean): void {
  if (!el) return;
  const value = on ? "1" : "0";
  if (el.dataset.on !== value) el.dataset.on = value;
}

/** Start the engine. Returns null when the stage cannot be made (the caller falls back to plain). */
export function startEngine(options: EngineOptions): Engine | null {
  current?.dispose();
  current = null;

  const { root, host, grounds, sections } = options;
  let failed = false;
  const stage = createStage(host, {
    onLost: () => undefined,
    onRestored: () => undefined,
    onFailed: () => {
      failed = true;
      options.onFailed();
    },
  });
  if (!stage) return null;

  const layout = layoutSections(sections);
  const clock = new Clock();
  const actors = new ActorRegistry();
  const cursor = new CursorProxy(host);
  const pointer = new PointerHub(cursor);
  const background = new Background(grounds);
  const scene = new SceneScroll();

  let unit = Math.max(1, host.getBoundingClientRect().height);
  let frozen = false;
  let frozenS = 0;
  let heldTime = 0;
  let forceJump = true;
  let firstFrames = 0;
  let firstDone = false;
  // The sections near the top have been asked to build (held back on a document load until the
  // drone is on the stage), so "nothing is mounting" means they are built, not that none started.
  let primed = false;
  let active: HomeSection["id"] | null = null;
  let disposed = false;

  const viewport = (): Viewport => ({ w: stage.width, h: stage.height, dpr: stage.dpr });

  // The opening of a document load of the home (the drone that waits with the visitor, then the
  // intro): its scene is a lazy chunk, built once and run in place of the sections while the page
  // is not open. The page is not called ready before it has drawn (`features/home/boot/`).
  let boot: BootRuntime | null = null;
  let bootWanted = false;
  let bootFailed = false;
  {
    const flow = useHomeFlow.getState();
    if (flow.arrival === "document" && flow.phase !== "open") {
      bootWanted = true;
      void import("../boot/runtime").then(
        (m) => {
          if (disposed || selectIsOpen(useHomeFlow.getState())) {
            bootWanted = false;
            return;
          }
          boot = m.createBootRuntime({ stage, actors, pointer, cursor, viewport, audio, host });
        },
        (error: unknown) => {
          console.warn(
            "[home] the opening's scene could not load; the page opens without it.",
            error,
          );
          bootFailed = true;
        },
      );
    }
  }

  const scrollApi: ScrollApi = {
    raw: () => scene.raw,
    shown: () => scene.shown,
    to: (screens, opts) => {
      options.scrollTo(screens * unit, { immediate: opts?.immediate ?? false });
    },
    hold: (limitMs) => holdScroll(limitMs),
  };

  const ctxFor = (p: { id: HomeSection["id"] }): SectionCtx => {
    const below = slot(root, "below", p.id);
    const text = slot(root, "text", p.id);
    if (!below || !text) throw new Error(`section ${p.id} has no DOM slot`);
    return {
      id: p.id,
      stage,
      actors,
      dom: { root, below, text },
      viewport,
      pointer,
      cursor,
      scroll: scrollApi,
      audio,
      expectReady,
    };
  };

  // The slots are looked up once: the frame loop only toggles them.
  const slots = layout.placed.map((p) => ({
    p,
    below: slot(root, "below", p.id),
    text: p.def.dom === "fixed" ? slot(root, "text", p.id) : null,
  }));

  const runner = new SectionRunner({
    layout,
    actors,
    ctxFor,
    onActive: (p) => {
      active = p.id;
      cursor.setTheme(p.def.nav.theme);
      if (useNavLock.getState().theme !== p.def.nav.theme) {
        useNavLock.setState({ theme: p.def.nav.theme });
      }
    },
    onError: (id, error) => {
      console.error(`[home] section ${id} failed`, error);
    },
  });

  const onResize = () => {
    stage.resize();
    unit = Math.max(1, host.getBoundingClientRect().height);
  };
  window.addEventListener("resize", onResize);
  const observer = new ResizeObserver(onResize);
  observer.observe(host);

  pointer.attach();

  let frameInfo: FrameInfo = {
    time: 0,
    dt: 0,
    S: 0,
    raw: 0,
    velocity: 0,
    viewport: viewport(),
    frame: 0,
  };
  let jumped = true;

  const removers = [
    clock.add((f) => {
      // The scroll: the real position, then the scene's smoothed one.
      const raw = frozen ? frozenS : screensOf(window.scrollY, unit);
      const dt = frozen ? 0 : f.dt;
      // Frozen time stands still too, so idle motion does not drift in a frame sheet.
      if (!frozen) heldTime = f.time;
      jumped = scene.step(raw, dt) || forceJump;
      forceJump = false;
      frameInfo = {
        time: heldTime,
        dt,
        S: scene.shown,
        raw: scene.raw,
        velocity: scene.velocity,
        viewport: viewport(),
        frame: f.frame,
      };
    }, ORDER.scroll),
    clock.add((f) => {
      pointer.resolve(f.dt);
    }, ORDER.pointer),
    clock.add(() => {
      const open = selectIsOpen(useHomeFlow.getState());
      if (open) {
        if (boot || bootWanted) {
          // The opening is over (it ended, or the page opened early): the sections take over.
          boot?.dispose();
          boot = null;
          bootWanted = false;
        }
        runner.step(frameInfo, jumped);
        primed = true;
      } else {
        actors.hideAll();
        boot?.update(frameInfo);
        actors.apply();
        // On a document load the drone's files have the connection to themselves until the drone
        // is drawn: the sections near the top start to build (and ask for their files) after it.
        if (!bootWanted || (boot ? boot.canPrime() : bootFailed)) {
          runner.prime(frameInfo.S);
          primed = true;
        }
        // The page is not the visitor's yet: when it opens, replay the passed sections once.
        forceJump = true;
      }
      for (const s of slots) {
        const on = open && isRunning(s.p, frameInfo.S);
        setOn(s.below, on);
        setOn(s.text, on);
      }
    }, ORDER.sections),
    clock.add(() => {
      actors.update(frameInfo);
      actors.apply();
      background.apply(groundAt(layout, frameInfo.S));
    }, ORDER.background),
    clock.add(() => {
      stage.draw(frameInfo);
      // The page is ready when it has drawn twice and the sections near the top are built.
      const bootReady = !bootWanted || (boot ? boot.ready() : bootFailed);
      if (!firstDone && ++firstFrames >= 2 && primed && runner.mounting() === 0 && bootReady) {
        firstDone = true;
        options.onFirstFrame();
      }
    }, ORDER.draw),
  ];

  const stopProbes = installProbes({
    seek: (screens) => {
      const y = screens * unit;
      options.scrollTo(y, { immediate: true });
      window.scrollTo(0, y);
      scene.snap(screens);
      frozenS = screens;
      forceJump = true;
    },
    freeze: (on) => {
      frozen = on;
      frozenS = scene.shown;
    },
    state: (): HomeSnapshot => ({
      S: scene.shown,
      raw: scene.raw,
      total: layout.total,
      unit,
      open: selectIsOpen(useHomeFlow.getState()),
      frozen,
      size: viewport(),
      stage: { lost: stage.lost, failed: failed || stage.failed, passes: stage.passNames() },
      active,
      sections: runner.report(frameInfo.S),
      actors: actors.list().map((a) => ({ name: a.name, visible: a.visible })),
      hit: pointer.state.hit,
    }),
    skipIntro: () => {
      useHomeFlow.getState().abort();
    },
    actor: (name) => {
      const a = actors.get(name);
      return a ? { name: a.name, visible: a.visible } : null;
    },
    lab: async (name) => {
      const ensure = LABS[name];
      if (!ensure)
        throw new Error(`no lab actor "${name}" (known: ${Object.keys(LABS).join(", ")})`);
      const actor = await ensure({ stage, actors, pointer, cursor, viewport, audio });
      actors.pin(actor.name, true);
      return actor;
    },
    unpin: (name) => actors.pin(name, false),
    sections: () =>
      runner
        .report()
        .map((r) => ({ id: r.id, start: r.start, screens: r.screens, mount: r.mount })),
  });

  clock.start();

  const engine: Engine = {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clock.stop();
      for (const remove of removers) remove();
      boot?.dispose();
      boot = null;
      stopProbes();
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      pointer.detach();
      runner.dispose();
      actors.dispose();
      cursor.dispose();
      stage.dispose();
      if (current === engine) current = null;
    },
  };
  current = engine;
  return engine;
}
