"use client";

import type { Route } from "next";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useHotkey, useReducedMotion } from "@/lib/hooks";
import { onPerfLevel, startGovernor } from "@/lib/perf";
import { runPreload } from "@/lib/preload";

import type { StageState } from "../../stage/director";
import { Hotspots } from "../../stage/hotspots";
import { MenuButton } from "../../stage/menu-button";
import type { SkipOptions } from "../../stage/phase";
import { ScreenCover, type CoverApi } from "../../stage/screen-cover";
import { CharacterStage, type StageApi } from "../../stage/stage";
import type { SceneName, ShortName } from "../../stage/timeline";
import { WaitFx } from "../../stage/wait-fx";
import { roomItems, roomMedia } from "./media";
import { NextBar } from "./next-bar";
import styles from "./room.module.css";
import { loadRoomMedia } from "./room-load";
import { HINTS, HOTSPOT_PATHS, HOTSPOT_STEP, SPOTS } from "./spots";
import { VEXANA_STAGE_TIMELINE } from "./timeline.generated";
import { useRoomScroll } from "./use-room-scroll";

/** What the room needs to say about the next character (the scroll on to her page). */
export interface NextCharacter {
  slug: string;
  name: string;
  aspirantName: string;
  tagline: string;
  order: number;
  href: Route;
  /** Public path of her splash art, for the preview. */
  image: string;
  /** Her accent colour, readable on the page. */
  accent: string;
}

/** The stickers on the two buttons (`scripts/vexana/room-assets.py`). */
const ICON = {
  pose: "/img/vexana/room/btn-pose.webp",
  back: "/img/vexana/room/btn-back.webp",
} as const;

/** The colours of the wipe that covers the screen when she skips or changes pose. */
const COVER = { edge: "#e040a0", a: "#2a1560", b: "#1c1038", c: "#0b0716" } as const;

/** How long the black screen of the first welcome takes to fade, in ms (see room.module.css). */
const BLACK_FADE_MS = 1100;

/** The first welcome plays once for the visit: a visitor who scrolls back finds her idling. */
let welcomePlayed = false;

const isShort = (scene: SceneName | null) => scene?.startsWith("short") ?? false;

/**
 * How the picture is sped up while it waits for a frame. Her idle loop is short (under three
 * seconds), so a wait is short too. The bigger the picture, the less it can be sped up.
 */
function skipFor(): SkipOptions {
  const tier = roomMedia.tier();
  return { maxRate: tier === "2160" ? 2 : tier === "1440" ? 2.25 : 2.5, minFrames: 50 };
}

/**
 * The room: the last section of Vexana's page, and the same idea as Selena's and Obsidia's pages.
 * Its screen is held (a sticky screen in a tall track) while the visitor scrolls the last stretch of
 * the page. Reaching it plays the welcome (with Skip) and then she idles in a seamless loop. Three
 * faint circles on the picture (her hand, the Guardian, a spot beside her face) play a short each,
 * and the Change pose button sends her into the zoom pose, which she keeps until Back. Everything
 * but the site's bar steps away while a short or the pose plays.
 *
 * The scroll through the track runs two meters (`scroll-math.ts`): a strength meter at the side, and
 * when it is full a bar a fifth of the screen high that names the next character and fills while
 * the visitor keeps scrolling, and then goes on to her page.
 */
export function Room({ next }: { next: NextCharacter }) {
  const router = useTransitionRouter();
  const reduced = useReducedMotion();
  const { pause, resume } = useLenis();
  const track = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const stage = useRef<StageApi>(null);
  const cover = useRef<CoverApi>(null);
  const [state, setState] = useState<StageState>({
    mode: "boot",
    scene: null,
    loading: false,
    ui: false,
    next: null,
    leaving: false,
    fast: false,
    wait: null,
  });
  const [announce, setAnnounce] = useState("");

  // The screen is on show (any part of it), and it is fully reached (most of it).
  const [near, setNear] = useState(false);
  const [reached, setReached] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = screen.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNear(true);
      setReached(true);
      setVisible(true);
      return;
    }
    const wide = new IntersectionObserver(
      (entries) => {
        const e = entries.at(-1);
        if (e?.isIntersecting) setNear(true);
      },
      { rootMargin: "100% 0px 100% 0px" },
    );
    const exact = new IntersectionObserver(
      (entries) => {
        const e = entries.at(-1);
        if (!e) return;
        setVisible(e.isIntersecting);
        if (e.intersectionRatio >= 0.6) setReached(true);
      },
      { threshold: [0, 0.6] },
    );
    wide.observe(el);
    exact.observe(el);
    return () => {
      wide.disconnect();
      exact.disconnect();
    };
  }, []);

  // The welcome and the idle loop of this visit's size, loaded for real (the way in waits for the
  // same load, so most visitors find it done). The stage starts when they are in memory.
  const [coreReady, setCoreReady] = useState(false);
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    if (!near || coreReady) return;
    let alive = true;
    void loadRoomMedia((done, total) => {
      if (alive) setLoaded(total > 0 ? Math.min(1, done / total) : 1);
    }).then(() => {
      if (alive) setCoreReady(true);
    });
    return () => {
      alive = false;
    };
  }, [near, coreReady]);

  const mountStage = reached && coreReady;
  const welcome = !welcomePlayed;

  const onState = useCallback((s: StageState) => {
    setState(s);
    if (s.mode === "welcome") welcomePlayed = true;
    if (s.mode === "queued" && s.scene) {
      const spot = SPOTS.find((p) => p.short === s.scene);
      setAnnounce(s.loading ? "Loading" : `${spot?.label ?? "Her pose"} is getting ready`);
    } else if (s.leaving && s.mode !== "idle") {
      setAnnounce("Going back");
    } else if (s.mode === "page") {
      setAnnounce("Her pose has changed");
    } else if (s.mode === "idle") {
      setAnnounce("");
    }
  }, []);

  const mode = state.mode;
  const scene = state.scene;

  // The page does not scroll while she welcomes, plays a short or holds the pose: the visitor is
  // looking at her, and a stray wheel must not run the meters.
  const locked = mode !== "boot" && mode !== "idle";
  useEffect(() => {
    if (!locked) return;
    pause();
    return () => {
      resume();
    };
  }, [locked, pause, resume]);

  // The stage rests while the screen is off the display (a 4K video is a lot to decode for nothing).
  const resting = useRef(false);
  useEffect(() => {
    if (!mountStage) return;
    if (!visible && !resting.current) {
      resting.current = true;
      stage.current?.setHidden(true);
    } else if (visible && resting.current) {
      resting.current = false;
      stage.current?.setHidden(false);
    }
  }, [visible, mountStage]);

  // The black screen of the first welcome. It fades a beat after the welcome video is playing.
  const blackExpected = welcome && !reduced;
  const [black, setBlack] = useState<"on" | "fade" | "off">("on");
  useEffect(() => {
    if (!blackExpected || black !== "on" || mode === "boot") return;
    const timer = window.setTimeout(
      () => {
        setBlack("fade");
      },
      mode === "welcome" ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [blackExpected, black, mode]);
  useEffect(() => {
    if (black !== "fade") return;
    const timer = window.setTimeout(() => {
      setBlack("off");
    }, BLACK_FADE_MS + 150);
    return () => {
      window.clearTimeout(timer);
    };
  }, [black]);
  // Whatever happens, the room is not left black.
  useEffect(() => {
    if (!mountStage) return;
    const timer = window.setTimeout(() => {
      setBlack((b) => (b === "on" ? "fade" : b));
    }, 14_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mountStage]);

  // The performance level steps down when the frame rate stays low while the room plays (not in
  // the welcome, which is it getting started). The smaller size is then loaded in the background
  // and used from the next video on; while she idles it is swapped under the cover wipe.
  const judged = useRef(false);
  const modeNow = useRef<StageState["mode"]>("boot");
  const fastNow = useRef(false);
  useEffect(() => {
    judged.current = mode !== "boot" && mode !== "welcome";
    modeNow.current = mode;
    fastNow.current = state.fast;
  }, [mode, state.fast]);
  useEffect(() => {
    if (!mountStage) return;
    const stop = startGovernor({
      video: () => stage.current?.videoQuality() ?? null,
      // Not while the picture runs faster to get to its frame, and not off screen.
      paused: () => !judged.current || fastNow.current || document.hidden,
    });
    const off = onPerfLevel(() => {
      void runPreload(roomItems());
      void roomMedia.loadCore(false).then(() => {
        if (modeNow.current === "idle") void cover.current?.run(() => stage.current?.retier());
      });
    });
    return () => {
      stop();
      off();
    };
  }, [mountStage]);

  // What the panel shows, as on Selena's and Obsidia's pages.
  const showMain = state.ui;
  const chosen = mode === "queued" ? scene : state.next;
  const busy = chosen !== null;
  const chosenShort = chosen !== null && isShort(chosen) ? (chosen as ShortName) : null;
  const poseChosen = chosen === "gallery";
  const waitMs = chosen !== null && state.wait && !state.loading ? state.wait.ms : null;
  const waitKey = state.wait?.at ?? 0;
  const backWait = mode === "leaving" && state.wait ? state.wait.ms : null;
  const waiting = chosen !== null || mode === "leaving";
  const showBack = mode === "page" || mode === "leaving";
  const waitLabel =
    chosen === null && mode === "leaving"
      ? "Heading back"
      : chosenShort
        ? "Getting ready"
        : "Changing her pose";

  // The hint under the points: one line at a time, until the visitor has touched something.
  const [hint, setHint] = useState(0);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched || !showMain || reduced) return;
    const timer = window.setInterval(() => {
      setHint((n) => (n + 1) % HINTS.length);
    }, 3800);
    return () => {
      window.clearInterval(timer);
    };
  }, [touched, showMain, reduced]);

  const go = useCallback(() => {
    if (router.isTransitioning()) return;
    router.push(next.href, { label: next.name });
  }, [next.href, next.name, router]);
  const barOpen = useRoomScroll(track, screen, { reduced, go });

  useHotkey(
    "n",
    () => {
      const free = mode === "idle" && !busy;
      if (free && visible && !document.querySelector("[role='dialog']")) go();
    },
    true,
  );

  // Esc backs out one step: out of the queue, out of the pose. A short plays to its end.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !visible) return;
      if (document.querySelector("[role='dialog'], [role='tooltip']")) return;
      if (mode === "page") stage.current?.leave();
      else if (mode === "queued" || state.next) stage.current?.cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [mode, state.next, visible]);

  const skip = useCallback(() => {
    void cover.current?.run(() => stage.current?.jumpToIdle());
  }, []);
  const idleClock = useCallback(() => stage.current?.idleClock() ?? null, []);

  return (
    <section
      id="room"
      ref={track}
      className={styles.track}
      aria-labelledby="room-title"
      data-vexana-room=""
    >
      <div
        ref={screen}
        className={styles.hero}
        data-theme="storm"
        data-mode={mode}
        style={{ "--still": `url("${asset("/video/vexana-stage/still.webp")}")` } as CSSProperties}
      >
        <h2 id="room-title" className="sr-only">
          Vexana, in her room
        </h2>

        {mountStage ? (
          <CharacterStage
            ref={stage}
            timeline={VEXANA_STAGE_TIMELINE}
            media={roomMedia}
            skip={skipFor}
            onState={onState}
            welcome={welcome}
            onBegin={noop}
          />
        ) : (
          <div className={styles.still} aria-hidden="true" />
        )}

        {reached && !coreReady ? (
          <div className={styles.loading} role="status" aria-live="polite">
            <span className={styles.loadingLabel}>Loading her room</span>
            <span className={styles.loadingRail} aria-hidden="true">
              <span className={styles.loadingFill} style={{ transform: `scaleX(${loaded})` }} />
            </span>
            <span className={styles.loadingValue}>{Math.round(loaded * 100)}%</span>
          </div>
        ) : null}

        {waiting ? (
          <WaitFx
            key={chosen === null && mode === "leaving" ? "back" : waitKey}
            railKey={waitKey}
            label={waitLabel}
            ms={chosen === null && mode === "leaving" ? backWait : waitMs}
          />
        ) : null}

        {blackExpected && black !== "off" ? (
          <div className={styles.blackout} data-state={black} aria-hidden="true" />
        ) : null}

        <div className={styles.ui} data-visible={showMain} data-busy={busy}>
          <Hotspots
            spots={SPOTS}
            paths={HOTSPOT_PATHS}
            step={HOTSPOT_STEP}
            fps={VEXANA_STAGE_TIMELINE.fps}
            idleClock={idleClock}
            visible={showMain}
            chosen={chosenShort}
            loading={state.loading}
            waitMs={waitMs}
            waitKey={waitKey}
            away={busy && chosenShort === null}
            onPick={(short) => {
              setTouched(true);
              audio.blip("click");
              stage.current?.request(short);
            }}
            onCancel={() => {
              audio.blip("click");
              stage.current?.cancel();
            }}
            onWarm={(short) => {
              stage.current?.warm(short);
            }}
            onHover={() => {
              audio.blip("hover");
            }}
          />

          <div
            className={styles.pose}
            data-away={(busy && !poseChosen) || barOpen}
            data-cursor="POSE"
          >
            <MenuButton
              label="Change pose"
              icon={ICON.pose}
              badge="POSE"
              loadingWord="Changing"
              state={poseChosen ? (state.loading ? "loading" : "queued") : "idle"}
              waitMs={waitMs}
              waitKey={waitKey}
              disabled={busy && !poseChosen}
              onPointerEnter={() => {
                stage.current?.warm("gallery");
                audio.blip("hover");
              }}
              onFocus={() => {
                stage.current?.warm("gallery");
              }}
              onClick={() => {
                setTouched(true);
                audio.blip("click");
                if (poseChosen) stage.current?.cancel();
                else stage.current?.request("gallery");
              }}
            />
          </div>

          <p className={styles.hint} data-gone={touched || busy || barOpen} aria-hidden="true">
            <span key={hint}>{HINTS[hint]}</span>
          </p>
        </div>

        <div className={styles.scroll} data-visible={showMain && reached} aria-hidden="true">
          <span className={styles.scrollLabel}>Scroll</span>
          <span className={styles.scrollTrack}>
            <span className={styles.scrollFill} />
          </span>
        </div>

        <NextBar next={next} open={barOpen && showMain} reduced={reduced} onGo={go} />

        {mode === "welcome" ? (
          <div className={styles.bar}>
            <button type="button" className={styles.skip} onClick={skip}>
              <span>Skip</span>
              <i aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {showBack ? (
          <div className={styles.back} data-cursor="BACK">
            <MenuButton
              label="Back"
              icon={ICON.back}
              badge="ESC"
              loadingWord="Heading back"
              state={state.leaving ? (backWait === null ? "loading" : "queued") : "idle"}
              waitMs={backWait}
              waitKey={waitKey}
              disabled={state.leaving || mode !== "page"}
              onPointerEnter={() => {
                audio.blip("hover");
              }}
              onFocus={() => undefined}
              onClick={() => {
                audio.blip("click");
                stage.current?.leave();
              }}
            />
          </div>
        ) : null}

        <ScreenCover ref={cover} colors={COVER} />

        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </div>
    </section>
  );
}

function noop() {
  // The page's music is Vexana's theme, which is already playing: nothing starts with the stage.
}
