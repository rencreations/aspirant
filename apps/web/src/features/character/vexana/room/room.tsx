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
import { roomBack } from "./room-back";
import { ACTIONS } from "./spots";
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
 * the page. Reaching it plays the welcome (with Skip) and then she idles in a seamless loop. A column
 * of buttons on the left: Back (to the section before the room), Action 1, 2 and 3 (a short each:
 * her face, her left hand and the Guardian), and Change pose, which sends her into the zoom pose,
 * which she keeps until Back. Everything but the site's bar steps away while a short or the pose
 * plays.
 *
 * Bottom left, a line says the page has ended, with a meter under it (`scroll-math.ts`): the meter
 * fills as the visitor scrolls on, and when it is full a bar a fifth of the screen high names the
 * next character and fills while the visitor keeps scrolling, and then goes on to her page.
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
  // A button the visitor just pressed, from the click until the engine has taken the choice. The
  // engine's first work (loading the short, speeding up the idle loop) can hold the page for a
  // moment, so the choice is shown first, on the next painted frame: the other buttons step away
  // at once, as the stylesheet intends.
  const [pressed, setPressed] = useState<SceneName | null>(null);

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
      const action = ACTIONS.find((a) => a.short === s.scene);
      setAnnounce(s.loading ? "Loading" : `${action?.label ?? "Her pose"} is getting ready`);
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
  // looking at her, and a stray wheel must not run the meters. It only holds while the room is on
  // the screen: a visitor who goes Back during the welcome must get the page's scroll back (the
  // stage rests off screen, so the welcome would never end and the lock would never let go).
  const locked = visible && mode !== "boot" && mode !== "idle";
  useEffect(() => {
    if (!locked) return;
    pause();
    return () => {
      resume();
    };
  }, [locked, pause, resume]);

  // The stage rests while the screen is off the display (a 4K video is a lot to decode for nothing).
  // A change of the performance level while the room is on show only loads the other size in the
  // background (the next video uses it): the idle loop is swapped to it later, while the room is
  // off the display, so nothing is ever drawn over the picture for it.
  const resting = useRef(false);
  const visibleNow = useRef(false);
  const retierPending = useRef(false);
  const modeNow = useRef<StageState["mode"]>("boot");
  const applyRetier = useCallback(() => {
    if (!retierPending.current || visibleNow.current || modeNow.current !== "idle") return;
    retierPending.current = false;
    void stage.current?.retier().then(() => {
      if (!visibleNow.current) stage.current?.setHidden(true);
    });
  }, []);
  useEffect(() => {
    visibleNow.current = visible;
    if (!mountStage) return;
    if (!visible && !resting.current) {
      resting.current = true;
      stage.current?.setHidden(true);
      applyRetier();
    } else if (visible && resting.current) {
      resting.current = false;
      stage.current?.setHidden(false);
    }
  }, [visible, mountStage, applyRetier]);

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
  // and used from the next video on; the idle loop gets it while the room is off the display.
  const judged = useRef(false);
  const shownNow = useRef(false);
  useEffect(() => {
    shownNow.current = visible;
  }, [visible]);
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
      // And only while the room is on the display: the rest of the long page has its own cost, and
      // a drop caused there is remembered by every page of the site.
      paused: () => !judged.current || fastNow.current || document.hidden || !shownNow.current,
    });
    const off = onPerfLevel(() => {
      void runPreload(roomItems());
      void roomMedia.loadCore(false).then(() => {
        retierPending.current = true;
        applyRetier();
      });
    });
    return () => {
      stop();
      off();
    };
  }, [mountStage, applyRetier]);

  // What the panel shows, as on Selena's and Obsidia's pages.
  const showMain = state.ui;
  const chosen = (mode === "queued" ? scene : state.next) ?? pressed;
  const busy = chosen !== null;
  const chosenShort = chosen !== null && isShort(chosen) ? (chosen as ShortName) : null;
  const poseChosen = chosen === "gallery";
  const waitMs = chosen !== null && state.wait && !state.loading ? state.wait.ms : null;
  const waitKey = state.wait?.at ?? 0;
  const backWait = mode === "leaving" && state.wait ? state.wait.ms : null;
  const waiting = chosen !== null || mode === "leaving";
  // In the zoom pose the top button takes her back to the main panel; anywhere else it takes the
  // visitor back to the section before the room.
  const inPose = mode === "page" || mode === "leaving";
  const topShown = inPose || (!busy && (mode === "boot" || mode === "welcome" || mode === "idle"));
  const waitLabel =
    chosen === null && mode === "leaving"
      ? "Heading back"
      : chosenShort
        ? "Getting ready"
        : "Changing her pose";

  const go = useCallback(() => {
    if (router.isTransitioning()) return;
    router.push(next.href, { label: next.name });
  }, [next.href, next.name, router]);

  // Ask the engine for a scene. The choice is shown first (see `pressed`), the engine is asked on
  // the frame after that is painted, and from then on its own state tells what is chosen.
  const press = useCallback((scene: SceneName) => {
    setPressed(scene);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stage.current?.request(scene);
        setPressed(null);
      });
    });
  }, []);

  // The way back out of the room: the page's smooth scroll is the default of `roomBack`.
  const { scrollTo } = useLenis();
  useEffect(() => {
    roomBack.scrollTo = (top) => {
      scrollTo(top, { duration: 1.6 });
    };
  }, [scrollTo]);
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

        <div className={styles.column} data-busy={busy} data-in-pose={inPose}>
          <div
            className={styles.item}
            data-slot="top"
            data-show={topShown}
            data-away={barOpen && !inPose}
            data-cursor="BACK"
          >
            <MenuButton
              label={inPose ? "Back to main panel" : "Back"}
              icon={ICON.back}
              badge={inPose ? "ESC" : "UP"}
              loadingWord="Heading back"
              state={inPose && state.leaving ? (backWait === null ? "loading" : "queued") : "idle"}
              waitMs={backWait}
              waitKey={waitKey}
              disabled={inPose ? state.leaving || mode !== "page" : false}
              onPointerEnter={() => {
                audio.blip("hover");
              }}
              onFocus={() => undefined}
              onClick={() => {
                audio.blip("click");
                if (inPose) stage.current?.leave();
                else roomBack.go();
              }}
            />
          </div>

          {ACTIONS.map((a, i) => {
            const mine = chosenShort === a.short;
            return (
              <div
                key={a.id}
                className={styles.item}
                data-slot="action"
                data-show={showMain && !inPose}
                data-away={(busy && !mine) || barOpen}
                data-cursor="PLAY"
                style={{ "--i": i } as CSSProperties}
              >
                <MenuButton
                  label={a.label}
                  icon={a.icon}
                  index={i + 1}
                  loadingWord="Getting ready"
                  state={mine ? (state.loading ? "loading" : "queued") : "idle"}
                  waitMs={waitMs}
                  waitKey={waitKey}
                  disabled={busy && !mine}
                  ariaLabel={a.action}
                  onPointerEnter={() => {
                    stage.current?.warm(a.short);
                    audio.blip("hover");
                  }}
                  onFocus={() => {
                    stage.current?.warm(a.short);
                  }}
                  onClick={() => {
                    audio.blip("click");
                    if (pressed !== null) return;
                    if (mine) stage.current?.cancel();
                    else press(a.short);
                  }}
                />
              </div>
            );
          })}

          <div
            className={styles.item}
            data-slot="pose"
            data-show={showMain && !inPose}
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
                audio.blip("click");
                if (pressed !== null) return;
                if (poseChosen) stage.current?.cancel();
                else press("gallery");
              }}
            />
          </div>
        </div>

        <div
          className={styles.end}
          data-visible={showMain && reached && !barOpen}
          inert={!(showMain && reached && !barOpen)}
        >
          <p className={styles.endText}>
            You have reached the end. Scroll more for the next character.
          </p>
          <span className={styles.endMeter} aria-hidden="true">
            <span className={styles.endFill} />
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
