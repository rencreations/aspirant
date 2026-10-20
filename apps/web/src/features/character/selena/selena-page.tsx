"use client";

import type { Route } from "next";
import { usePathname } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";
import { useHotkey } from "@/lib/hooks";
import { getCharacter } from "@/content/characters";
import { startMusic, type Track } from "@/lib/now-playing";
import { expectReady } from "@/lib/page-ready";
import { onPerfLevel, startGovernor } from "@/lib/perf";
import { runPreload } from "@/lib/preload";
import { routeItems } from "@/lib/route-preloads";

import type { PageName, SceneName, ShortName, StageState } from "./director";
import { warmGlyphs } from "./glyph-warm";
import { Hotspots, SPOTS } from "./hotspots";
import { loadCore, MENU_ICON, selenaItems, TRAILER } from "./media";
import { SELENA_PAGES } from "./timeline.generated";
import { MenuButton } from "./menu-button";
import styles from "./selena.module.css";
import { ScreenCover, type CoverApi } from "./screen-cover";
import { AboutDrawers } from "./about/about-drawers";
import { SkillsDrawers } from "./skills/skills-drawers";
import { pageFromPath } from "./routes";
import { SelenaStage, type StageApi } from "./stage";
import { useSelenaUrl } from "./use-selena-url";

/** The three buttons, in order, and the page each one opens. */
const MENU: ReadonlyArray<{ id: string; label: string; scene: PageName; icon: string }> = [
  { id: "about", label: "About", scene: "about", icon: MENU_ICON.about },
  { id: "skills", label: "Skills", scene: "skills", icon: MENU_ICON.skills },
  { id: "gallery", label: "Gallery", scene: "gallery", icon: MENU_ICON.gallery },
];

const TRACK: Track = {
  title: "Silverbolt Raiko",
  artist: "Mobile Legends: Bang Bang",
  cover: "/img/char/selena/splash-sm.webp",
  src: "/audio/music/silverbolt-raiko.m4a",
};

interface SelenaNext {
  label: string;
  href: Route;
  /** The next character's name. */
  name: string;
}

/** The music waits this long after the welcome begins. */
const MUSIC_DELAY_MS = 500;

/**
 * The waiting animation inside a pressed button. A bar fills for exactly as long as the wait for
 * her matching frame, so the press is answered at once and the wait is shown as it runs. When the
 * length is not known (a clip is still loading) a band sweeps instead.
 */
function Fill({ ms, k }: { ms: number | null; k: number }) {
  return (
    <span
      key={k}
      className={styles.fill}
      data-mode={ms === null ? "sweep" : "run"}
      style={
        ms === null ? undefined : ({ "--wait": `${Math.max(ms, 120)}ms` } as React.CSSProperties)
      }
      aria-hidden="true"
    />
  );
}
const isShort = (scene: SceneName | null) => scene?.startsWith("short") ?? false;

/**
 * Selena's page. One full-screen picture that does not scroll. The welcome animation plays once
 * the page is in view, then she idles in a seamless loop. The trailer sits in the empty top-left
 * of the picture, and three buttons in the empty top-right send her into pages of her own: each
 * has an entrance, a loop of its own and an exit back to the idle. Three faint circles on the
 * picture (the Silverbolt, the badge and the right arm) play a short animation each: the panel
 * steps aside while one plays and comes back when it ends. Music plays and loops while the page
 * is open.
 */
export function SelenaPage({ next }: { next: SelenaNext }) {
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
  const [initial] = useState(() => pageFromPath(pathname));
  // The stage waits for the size of video the device can play smoothly (a moment, usually done
  // long before), so every video it uses is of the same size.
  const [tierReady, setTierReady] = useState(false);
  // The drawers of About and Skills are built while she idles, off screen, a moment after the
  // welcome. React builds them in small slices, so the idle picture never stalls, and a press
  // finds them ready instead of building them in the frames of its own animation.
  const [drawersBuilt, setDrawersBuilt] = useState(0);
  useEffect(() => {
    let alive = true;
    // The curtain waits for the stage, which waits for the videos it starts with.
    const mark = expectReady("selena-core");
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
    if (tierReady) expectReady("selena-core")();
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

  // The music starts with the welcome and loops until the page is left. In the welcome it comes
  // in half a second after the picture, so the animation is seen first. If the welcome is skipped
  // it starts at once.
  const musicTimer = useRef(0);
  useEffect(() => {
    if (musicStop.current || (state.mode !== "welcome" && state.mode !== "idle")) return;
    window.clearTimeout(musicTimer.current);
    const start = () => {
      musicStop.current ??= startMusic(TRACK);
    };
    if (state.mode === "welcome") musicTimer.current = window.setTimeout(start, MUSIC_DELAY_MS);
    else start();
  }, [state.mode]);
  useEffect(
    () => () => {
      window.clearTimeout(musicTimer.current);
      musicStop.current?.();
      musicStop.current = null;
    },
    [],
  );

  const mode = state.mode;
  const scene = state.scene;

  // The nav picks its colours from what is under it. Once the page is up (after the boot screen
  // the first sample is stale) ask it to look again.
  useSelenaUrl({ state, stage, initial });

  // The drawer of the page that is opening is drawn (off screen) in the middle of the entrance,
  // not when it slides in. See DrawerShell `warm`.
  const [warmed, setWarmed] = useState<PageName | null>(null);
  useEffect(() => {
    if (state.mode === "intro" && state.scene && state.scene in SELENA_PAGES) {
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
      void runPreload(selenaItems());
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

  // The characters the drawers show that the fonts lack (the Japanese titles of her voice lines)
  // are laid out a few at a time while she idles, so opening a drawer does not pay for it.
  useEffect(() => {
    if (state.mode !== "idle") return;
    let stop = () => undefined as void;
    const timer = window.setTimeout(() => {
      const lines = getCharacter("selena").voice;
      stop = warmGlyphs(lines.flatMap((l) => [l.jpTitle, l.en]));
    }, 600);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [state.mode]);

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

  useEffect(() => {
    if (state.mode !== "idle" || drawersBuilt >= 2) return;
    // About first, Skills a moment later, so no single frame carries both.
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

  const booted = mode !== "boot";
  useEffect(() => {
    if (booted) window.dispatchEvent(new Event("resize"));
  }, [booted]);
  const pageOpen =
    mode === "intro" ||
    mode === "page" ||
    mode === "leaving" ||
    mode === "outro" ||
    (mode === "returning" && scene !== null && !isShort(scene));
  // The main panel shows while she idles, and comes back as soon as she is back in her idle
  // pose after an exit or a short, before the hand-over has finished.
  const showMain = state.ui;
  // A choice reacts at once: the rest of the panel steps away and the chosen button runs a bar
  // for exactly as long as the wait. Choosing while she is still finishing keeps the choice.
  const chosen = mode === "queued" ? scene : state.next;
  const busy = chosen !== null;
  const chosenShort = chosen !== null && isShort(chosen) ? (chosen as ShortName) : null;
  const waitMs = mode === "queued" && state.wait && !state.loading ? state.wait.ms : null;
  const waitKey = state.wait?.at ?? 0;
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
      <section className={styles.hero} aria-labelledby="selena-title" data-mode={mode}>
        <h1 id="selena-title" className="sr-only">
          Selena
        </h1>
        {tierReady ? (
          <SelenaStage ref={stage} onState={onState} welcome={initial === null} />
        ) : null}

        <div className={styles.ui} data-visible={showMain} data-busy={busy}>
          <Hotspots
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

          <div className={styles.trailer}>
            <div className={styles.cardWrap} data-away={busy}>
              <VideoCard
                video={{
                  sources: TRAILER.sources.map(({ label, height, src }) => ({
                    label,
                    height,
                    src,
                  })),
                  poster: TRAILER.poster,
                  title: TRAILER.title,
                }}
                duration={TRAILER.duration}
                tag="Trailer"
                className={styles.trailerCard}
              />
            </div>
          </div>

          <nav className={styles.menu} aria-label="Selena" inert={!showMain}>
            <ul>
              {MENU.map((item, i) => {
                const mine = chosen === item.scene;
                const status = mine ? (state.loading ? "loading" : "queued") : "idle";
                return (
                  <li key={item.id} data-mine={mine} style={{ ["--i" as string]: i }}>
                    <MenuButton
                      label={item.label}
                      icon={item.icon}
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
            <i aria-hidden="true" />
          </button>
        </div>

        {mode === "welcome" ? (
          <div className={styles.bar}>
            <button type="button" className={styles.corner} onClick={skip}>
              <span>Skip</span>
              <i aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {pageOpen && !showMain ? (
          <div className={styles.bar}>
            <button
              type="button"
              className={styles.corner}
              data-busy={state.leaving}
              disabled={state.leaving || (mode !== "page" && mode !== "intro")}
              onClick={() => {
                audio.blip("click");
                stage.current?.leave();
              }}
            >
              <i className={styles.back} aria-hidden="true" />
              <span>Back</span>
              {state.leaving ? (
                <Fill ms={mode === "leaving" && state.wait ? state.wait.ms : null} k={waitKey} />
              ) : null}
            </button>
          </div>
        ) : null}

        {/* Built ahead of time (see `drawersBuilt`), or as soon as a page is chosen. */}
        <AboutDrawers
          present={drawersBuilt >= 1 || (pageOpen && scene === "about") || chosen === "about"}
          shown={mode === "page" && scene === "about"}
          warm={warmed === "about"}
        />
        <SkillsDrawers
          present={drawersBuilt >= 2 || (pageOpen && scene === "skills") || chosen === "skills"}
          shown={mode === "page" && scene === "skills"}
          warm={warmed === "skills"}
        />

        <ScreenCover ref={cover} />

        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </section>
    </div>
  );
}
