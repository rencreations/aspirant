"use client";

import type { Route } from "next";
import { usePathname } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { audio } from "@/lib/audio";
import { useHotkey, useReducedMotion } from "@/lib/hooks";
import { startMusic, type Track } from "@/lib/now-playing";
import { expectReady } from "@/lib/page-ready";
import { onPerfLevel, startGovernor } from "@/lib/perf";
import { runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

import type { StageState } from "../stage/director";
import { Hotspots } from "../stage/hotspots";
import { ScreenCover, type CoverApi, type CoverColors } from "../stage/screen-cover";
import { CharacterStage, type StageApi } from "../stage/stage";
import { PAGE_NAMES, type PageName, type SceneName, type ShortName } from "../stage/timeline";
import { useStageUrl } from "../stage/use-stage-url";
import { WaitFx } from "../stage/wait-fx";
import { AboutDrawer } from "./about/about-drawer";
import { GalleryDrawer } from "./gallery/gallery-drawer";
import { SkillsDrawer } from "./skills/skills-drawer";
import { loadCore, OBSIDIA_MUSIC, obsidiaItems, obsidiaMedia } from "./media";
import styles from "./obsidia.module.css";
import { PlateButton, type Glyph } from "./plate-button";
import { obsidiaPageFromPath, OBSIDIA_ROUTES } from "./routes";
import { HOTSPOT_PATHS, HOTSPOT_STEP, SPOTS } from "./spots";
import { OBSIDIA_TIMELINE } from "./timeline.generated";

/** The three buttons, in order, and the page each one opens. */
const MENU: ReadonlyArray<{ id: string; label: string; scene: PageName; glyph: Glyph }> = [
  { id: "about", label: "About", scene: "about", glyph: "about" },
  { id: "skills", label: "Skills", scene: "skills", glyph: "skills" },
  { id: "gallery", label: "Gallery", scene: "gallery", glyph: "gallery" },
];

const TRACK: Track = {
  title: "Obsidia theme",
  artist: "The Aspirants",
  cover: "/img/char/obsidia/splash-sm.webp",
  src: OBSIDIA_MUSIC,
};

/** The wipe between her pictures: rose gold leads, a dark crimson plate follows. */
const COVER: CoverColors = { edge: "#e2b04a", a: "#5c0b22", b: "#2a0612", c: "#0b0507" };

interface ObsidiaNext {
  label: string;
  href: Route;
  /** The next character's name. */
  name: string;
}

/** How long the black screen of the first welcome takes to fade, in ms (see obsidia.module.css). */
const BLACK_FADE_MS = 1700;

const isShort = (scene: SceneName | null) => scene?.startsWith("short") ?? false;

/**
 * Obsidia's page. One full-screen picture that does not scroll. The welcome animation plays once
 * the page is in view, then she idles in a seamless loop. Three buttons in the empty top-left of
 * the picture send her into pages of her own: each has an entrance, a loop of its own and an exit
 * back to the idle. Three faint circles on the picture (her weapon, her face and her boot) play a
 * short animation each: the panel steps aside while one plays and comes back when it ends. Music
 * plays and loops while the page is open.
 */
export function ObsidiaPage({ next }: { next: ObsidiaNext }) {
  const router = useTransitionRouter();
  const { pause, resume } = useLenis();
  const stage = useRef<StageApi>(null);
  const cover = useRef<CoverApi>(null);
  const [state, setState] = useState<StageState>({
    mode: "boot",
    scene: null,
    loading: false,
    ui: false,
    next: null,
    leaving: false,
    wait: null,
  });
  const [announce, setAnnounce] = useState("");
  const musicStop = useRef<(() => void) | null>(null);
  // The page the address named when the visitor arrived. Her own address plays the welcome; a
  // page's address skips it and plays that page's entrance.
  const pathname = usePathname();
  const [initial] = useState(() => obsidiaPageFromPath(pathname));
  // The stage waits for the size of video the device can play smoothly (a moment, usually done
  // long before), so every video it uses is of the same size.
  const [tierReady, setTierReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // The curtain waits for the stage, which waits for the videos it starts with.
    const mark = expectReady("obsidia-core");
    // Never longer than 15 seconds: after that the stage starts on what it has.
    const cap = new Promise<void>((resolve) => window.setTimeout(resolve, 15_000));
    void Promise.race([loadCore(initial === null), cap]).then(() => {
      if (alive) setTierReady(true);
    });
    return () => {
      alive = false;
      mark();
    };
    // Once per visit: the address at that moment decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The stage has mounted (its own effect has registered what it waits for) and the page is ready.
  useEffect(() => {
    if (tierReady) expectReady("obsidia-core")();
  }, [tierReady]);

  const onState = useCallback((s: StageState) => {
    setState(s);
    if (s.mode === "queued" && s.scene) {
      const item = MENU.find((m) => m.scene === s.scene);
      const spot = SPOTS.find((p) => p.short === s.scene);
      const name = item?.label ?? spot?.label ?? "Animation";
      setAnnounce(s.loading ? "Loading" : `${name} is getting ready`);
    } else if (s.leaving && s.mode !== "idle") {
      setAnnounce("Going back");
    } else if (s.mode === "page" && s.scene) {
      setAnnounce(`${MENU.find((m) => m.scene === s.scene)?.label ?? "Page"} is open`);
    } else if (s.mode === "idle") {
      setAnnounce("");
    }
  }, []);

  // The page is one panel: nothing scrolls.
  useEffect(() => {
    pause();
    const html = document.documentElement;
    const before = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = before.html;
      document.body.style.overflow = before.body;
      resume();
    };
  }, [pause, resume]);

  // The music starts when the stage begins and loops until the page is left. In the first
  // welcome it plays a moment on a black screen, then the video starts under the black, and the
  // black fades away to show a picture that is already moving.
  const begin = useCallback(() => {
    musicStop.current ??= startMusic(TRACK);
  }, []);
  useEffect(
    () => () => {
      musicStop.current?.();
      musicStop.current = null;
    },
    [],
  );

  // The black screen of the first welcome. It is there from the first frame and starts to fade a
  // beat after the welcome video is playing (or at once if the welcome does not play at all).
  const reducedMotion = useReducedMotion();
  const blackExpected = initial === null && !reducedMotion;
  const [black, setBlack] = useState<"on" | "fade" | "off">("on");
  useEffect(() => {
    if (!blackExpected || black !== "on") return;
    if (state.mode === "boot") return;
    const timer = window.setTimeout(
      () => {
        setBlack("fade");
      },
      state.mode === "welcome" ? 350 : 0,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [blackExpected, black, state.mode]);
  useEffect(() => {
    if (black !== "fade") return;
    const timer = window.setTimeout(() => {
      setBlack("off");
    }, BLACK_FADE_MS + 200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [black]);
  // Whatever happens, the page is not left black.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBlack((b) => (b === "on" ? "fade" : b));
    }, 14_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const mode = state.mode;
  const scene = state.scene;

  // The drawers are built while she idles, off screen, a moment after the welcome. React builds
  // them in small slices, so the idle picture never stalls, and a press finds them ready instead
  // of building them in the frames of its own animation.
  const [drawersBuilt, setDrawersBuilt] = useState(0);
  useEffect(() => {
    if (state.mode !== "idle" || drawersBuilt >= 3) return;
    // About first, then Skills, then Gallery, a moment apart, so no single frame carries two.
    const timer = window.setTimeout(
      () => {
        startTransition(() => {
          setDrawersBuilt((n) => n + 1);
        });
      },
      drawersBuilt === 0 ? 1500 : 1200,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.mode, drawersBuilt]);

  // The drawer of the page that is opening is drawn (off screen) in the middle of the entrance,
  // not when it slides in. See ObsidiaDrawer `warm`.
  const [warmed, setWarmed] = useState<PageName | null>(null);
  useEffect(() => {
    if (
      state.mode === "intro" &&
      state.scene &&
      (PAGE_NAMES as readonly string[]).includes(state.scene)
    ) {
      const page = state.scene as PageName;
      const timer = window.setTimeout(() => {
        setWarmed(page);
      }, 1200);
      return () => {
        window.clearTimeout(timer);
      };
    }
    if (state.mode === "idle") {
      const timer = window.setTimeout(() => {
        setWarmed(null);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    return undefined;
  }, [state.mode, state.scene]);

  // Her address follows the page that is open, and the other way round.
  useStageUrl({ state, stage, initial, routes: OBSIDIA_ROUTES });

  // The performance level (lib/perf.ts) steps down when the frame rate stays low while the page
  // plays: in idle, in the presses and the entrances, on a page. Not during the boot and the
  // welcome, which are the page getting started. When the level steps down, the videos of the
  // smaller size are loaded in the background and used from the next video on.
  const judged = useRef(false);
  const modeNow = useRef<StageState["mode"]>("boot");
  useEffect(() => {
    judged.current = state.mode !== "boot" && state.mode !== "welcome";
    modeNow.current = state.mode;
  }, [state.mode]);
  useEffect(() => {
    if (!tierReady) return;
    const stop = startGovernor({
      video: () => stage.current?.videoQuality() ?? null,
      paused: () => !judged.current,
    });
    const off = onPerfLevel(() => {
      void runPreload(obsidiaItems());
      // While she idles the idle loop is on screen, so it is swapped for the smaller size under
      // the cover wipe, once the smaller size has arrived. In any other state the next return to
      // the idle loop does it.
      void loadCore(false).then(() => {
        if (modeNow.current === "idle") void cover.current?.run(() => stage.current?.retier());
      });
    });
    return () => {
      stop();
      off();
    };
  }, [tierReady]);

  // The loading screen has loaded all of the rest. Coming back by the browser's Back button, or
  // after the page was left, skips that screen: top it up from the saved copies. It waits until
  // she idles, so it never competes with the welcome, and what is loaded already costs nothing.
  const toppedUp = useRef(false);
  useEffect(() => {
    if (state.mode !== "idle" || toppedUp.current) return;
    const timer = window.setTimeout(() => {
      toppedUp.current = true;
      void runPreload(routeItems(pathname));
    }, 2500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.mode, pathname]);

  const booted = mode !== "boot";
  useEffect(() => {
    if (booted) window.dispatchEvent(new Event("resize"));
  }, [booted]);
  // The main panel shows while she idles, and comes back as soon as she is back in her idle
  // pose after an exit or a short, before the hand-over has finished.
  const showMain = state.ui;
  // A choice reacts at once: the rest of the panel steps away and the chosen button runs a bar
  // for exactly as long as the wait. Choosing while she is still finishing keeps the choice.
  const chosen = mode === "queued" ? scene : state.next;
  const busy = chosen !== null;
  const chosenShort = chosen !== null && isShort(chosen) ? (chosen as ShortName) : null;
  // The wait is known while she waits for her frame, and also when a page was chosen during the
  // hand-over to the idle loop (it is worked out from the hand-over).
  const waitMs = chosen !== null && state.wait && !state.loading ? state.wait.ms : null;
  const waitKey = state.wait?.at ?? 0;
  // How long the way back takes to put her in her idle pose, when it is known: the wait for her
  // frame, then the exit up to the moment she is posed.
  const backWait = (mode === "leaving" || mode === "outro") && state.wait ? state.wait.ms : null;
  // Something to look at while she waits for the frame she hands over on: a page opening, a short
  // getting ready, or the way back. The way back is over as soon as she is in her idle pose (the
  // panel is back then), not when the exit has finished playing.
  const waiting = chosen !== null || (state.leaving && !state.ui);
  // Back is there while the page is open and while it waits for the exit to start. It goes when
  // the exit starts, and the "Heading back" screen carries on alone until she is posed.
  const showBack = mode === "page" || mode === "leaving";
  const pageOpen = showBack || mode === "intro" || mode === "outro";
  const waitLabel =
    chosen === null && state.leaving
      ? "Heading back"
      : chosenShort
        ? "Getting ready"
        : `Opening ${MENU.find((m) => m.scene === chosen)?.label ?? "the page"}`;
  const nextRoute = useCallback(() => {
    router.push(next.href, { label: next.label });
  }, [next.href, next.label, router]);

  const skip = useCallback(() => {
    void cover.current?.run(() => stage.current?.jumpToIdle());
  }, []);

  // Leave a short early (Esc): the screen is covered while the picture goes back to the idle loop.
  const leaveShort = useCallback(() => {
    void cover.current?.run(() => stage.current?.jumpToIdle());
  }, []);

  const idleClock = useCallback(() => stage.current?.idleClock() ?? null, []);

  useHotkey(
    "n",
    () => {
      const free = !pageOpen && !busy && mode !== "short";
      if (free && !document.querySelector("[role='dialog']")) nextRoute();
    },
    true,
  );

  // Esc backs out one step: out of the queue, out of a page, out of a short. It runs in the
  // capture phase, before a tooltip or the video player closes itself, so a card that Esc just
  // closed does not also close the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role='dialog'], [role='tooltip']")) return;
      if (mode === "short") leaveShort();
      else if (mode === "page") stage.current?.leave();
      else if (mode === "queued" || state.next) stage.current?.cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [mode, leaveShort, state.next]);

  return (
    <div className={styles.page} data-theme="storm">
      <section className={styles.hero} aria-labelledby="obsidia-title" data-mode={mode}>
        <h1 id="obsidia-title" className="sr-only">
          Obsidia
        </h1>
        {tierReady ? (
          <CharacterStage
            ref={stage}
            timeline={OBSIDIA_TIMELINE}
            media={obsidiaMedia}
            onState={onState}
            welcome={initial === null}
            onBegin={begin}
          />
        ) : null}

        {waiting ? (
          <WaitFx
            key={chosen === null && state.leaving ? "back" : waitKey}
            railKey={waitKey}
            label={waitLabel}
            ms={chosen === null && state.leaving ? backWait : waitMs}
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
            fps={OBSIDIA_TIMELINE.fps}
            idleClock={idleClock}
            visible={showMain}
            chosen={chosenShort}
            loading={state.loading}
            waitMs={waitMs}
            waitKey={waitKey}
            away={busy && chosenShort === null}
            onPick={(short) => {
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

          <nav className={styles.menu} aria-label="Obsidia" inert={!showMain}>
            <ul>
              {MENU.map((item, i) => {
                const mine = chosen === item.scene;
                const status = mine ? (state.loading ? "loading" : "queued") : "idle";
                return (
                  <li key={item.id} data-mine={mine} style={{ ["--i" as string]: i }}>
                    <PlateButton
                      label={item.label}
                      glyph={item.glyph}
                      index={i + 1}
                      state={status}
                      waitMs={waitMs}
                      waitKey={waitKey}
                      disabled={busy && !mine}
                      onPointerEnter={() => {
                        stage.current?.warm(item.scene);
                        audio.blip("hover");
                      }}
                      onFocus={() => {
                        stage.current?.warm(item.scene);
                      }}
                      onClick={() => {
                        audio.blip("click");
                        if (mine) stage.current?.cancel();
                        else stage.current?.request(item.scene);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            className={styles.next}
            data-away={busy}
            aria-label={`Continue to ${next.name}`}
            tabIndex={showMain ? 0 : -1}
            onClick={nextRoute}
          >
            <span className={styles.nextTop}>Next</span>
            <span className={styles.nextName}>{next.name}</span>
          </button>
        </div>

        {mode === "welcome" ? (
          <div className={styles.bar}>
            <button type="button" className={styles.skip} onClick={skip}>
              <span>Skip</span>
              <i aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {showBack ? (
          <div className={styles.back}>
            <PlateButton
              label="Back"
              glyph="back"
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

        {/* Built ahead of time (see `drawersBuilt`), or as soon as a page is chosen. */}
        <AboutDrawer
          present={drawersBuilt >= 1 || (pageOpen && scene === "about") || chosen === "about"}
          shown={mode === "page" && scene === "about"}
          warm={warmed === "about"}
        />

        <SkillsDrawer
          present={drawersBuilt >= 2 || (pageOpen && scene === "skills") || chosen === "skills"}
          shown={mode === "page" && scene === "skills"}
          warm={warmed === "skills"}
        />

        <GalleryDrawer
          present={drawersBuilt >= 3 || (pageOpen && scene === "gallery") || chosen === "gallery"}
          shown={mode === "page" && scene === "gallery"}
          warm={warmed === "gallery"}
        />

        <ScreenCover ref={cover} colors={COVER} />

        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </section>
    </div>
  );
}
