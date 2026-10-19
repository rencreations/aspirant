"use client";

import type { Route } from "next";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLenis } from "@/components/smooth-scroll";
import { useTransitionRouter } from "@/components/transition/transition-provider";
import { VideoCard } from "@/components/video-player/video-card";
import { audio } from "@/lib/audio";
import { useHotkey } from "@/lib/hooks";
import { startMusic, type Track } from "@/lib/now-playing";

import { SHORT_NAMES, type PageName, type SceneName, type StageState } from "./director";
import styles from "./selena.module.css";
import { ScreenCover, type CoverApi } from "./screen-cover";
import { AboutDrawers } from "./about/about-drawers";
import { SkillsDrawers } from "./skills/skills-drawers";
import { SelenaStage, type StageApi } from "./stage";
import { SELENA_PAGES, SELENA_SHORTS } from "./timeline.generated";

/** The four buttons, in order, and the page each one opens. */
const MENU: ReadonlyArray<{ id: string; label: string; scene: PageName }> = [
  { id: "about", label: "About", scene: "about" },
  { id: "skills", label: "Skills", scene: "skills" },
  { id: "gallery", label: "Gallery", scene: "gallery" },
  { id: "others", label: "Others", scene: "others" },
];

const TRAILER = {
  poster: "/video/selena/trailer-poster.webp",
  title: "Selena, trailer",
  duration: 69,
  sources: [
    { label: "1080p", height: 1080, src: "/video/selena/trailer-1080.mp4" },
    { label: "720p", height: 720, src: "/video/selena/trailer-720.mp4" },
    { label: "480p", height: 480, src: "/video/selena/trailer-480.mp4" },
  ],
} as const;

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

const pad = (n: number) => String(n).padStart(2, "0");
const isShort = (scene: SceneName | null) => scene?.startsWith("short") ?? false;

/**
 * Selena's page. One full-screen picture that does not scroll. The welcome animation plays once
 * the page is in view, then she idles in a seamless loop. The trailer sits in the empty top-left
 * of the picture, with the Random Animation button under it, and four buttons in the empty
 * top-right send her into pages of her own: each has an entrance, a loop of its own and an exit
 * back to the idle. Random Animation plays the three short animations in turn: the panel steps aside while one
 * plays and comes back when it ends. Music plays and loops while the page is open.
 */
export function SelenaPage({ next }: { next: SelenaNext }) {
  const router = useTransitionRouter();
  const { pause, resume } = useLenis();
  const stage = useRef<StageApi>(null);
  const cover = useRef<CoverApi>(null);
  const [state, setState] = useState<StageState>({ mode: "boot", scene: null, loading: false });
  const [shortIndex, setShortIndex] = useState(0);
  const [announce, setAnnounce] = useState("");
  const musicStop = useRef<(() => void) | null>(null);

  const onState = useCallback((s: StageState) => {
    setState(s);
    if (s.mode === "queued" && s.scene) {
      const item = MENU.find((m) => m.scene === s.scene);
      setAnnounce(s.loading ? "Loading" : `${item?.label ?? "Animation"} is next`);
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

  // The music starts with the welcome and loops until the page is left.
  useEffect(() => {
    if (musicStop.current || (state.mode !== "welcome" && state.mode !== "idle")) return;
    musicStop.current = startMusic(TRACK);
  }, [state.mode]);
  useEffect(
    () => () => {
      musicStop.current?.();
      musicStop.current = null;
    },
    [],
  );

  const mode = state.mode;
  const scene = state.scene;

  // The nav picks its colours from what is under it. Once the page is up (after the boot screen
  // the first sample is stale) ask it to look again.
  // The music steps back while a clip with its own sound (a voice line) plays.
  useEffect(() => {
    let loud = false;
    if (scene && scene in SELENA_PAGES) {
      const page = SELENA_PAGES[scene as keyof typeof SELENA_PAGES];
      loud =
        (mode === "intro" && page.in.audio) ||
        ((mode === "outro" || mode === "leaving") && page.out.audio);
    } else if (scene && scene in SELENA_SHORTS) {
      loud = mode === "short" && SELENA_SHORTS[scene as keyof typeof SELENA_SHORTS].audio;
    }
    audio.setMusicVolume(loud ? 0.1 : 0.5);
  }, [mode, scene]);

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
  // The main panel stays while a scene waits for its frame and goes while a short plays.
  const showMain = mode === "idle" || mode === "queued";
  const randomQueued = mode === "queued" && isShort(scene);
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

  const playRandom = useCallback(() => {
    const name = SHORT_NAMES[shortIndex % SHORT_NAMES.length]!;
    setShortIndex((i) => (i + 1) % SHORT_NAMES.length);
    audio.blip("click");
    stage.current?.request(name);
  }, [shortIndex]);

  useHotkey(
    "n",
    () => {
      const free = !pageOpen && mode !== "queued" && mode !== "short";
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
      else if (mode === "queued") stage.current?.cancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
    };
  }, [mode, leaveShort]);

  return (
    <div className={styles.page} data-theme="storm">
      <section className={styles.hero} aria-labelledby="selena-title" data-mode={mode}>
        <h1 id="selena-title" className="sr-only">
          Selena
        </h1>
        <SelenaStage ref={stage} onState={onState} />

        <div className={styles.ui} data-visible={showMain}>
          <div className={styles.trailer}>
            <VideoCard
              video={{
                sources: TRAILER.sources,
                poster: TRAILER.poster,
                title: TRAILER.title,
              }}
              duration={TRAILER.duration}
              tag="Trailer"
              className={styles.trailerCard}
            />
            <button
              type="button"
              className={`${styles.button} ${styles.random}`}
              data-state={randomQueued ? (state.loading ? "loading" : "queued") : "idle"}
              aria-pressed={randomQueued}
              disabled={mode === "queued" && !randomQueued}
              onPointerEnter={() => {
                audio.blip("hover");
                stage.current?.warm(SHORT_NAMES[shortIndex % SHORT_NAMES.length]!);
              }}
              onClick={() => {
                if (randomQueued) stage.current?.cancel();
                else playRandom();
              }}
            >
              <span className={styles.shard} aria-hidden="true" />
              <span className={styles.index} aria-hidden="true">
                {pad((shortIndex % SHORT_NAMES.length) + 1)}
              </span>
              <span className={styles.text}>Random Animation</span>
              <span className={styles.bars} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className={styles.sheen} aria-hidden="true" />
            </button>
          </div>

          <nav className={styles.menu} aria-label="Selena" inert={!showMain}>
            <ul>
              {MENU.map((item, i) => {
                const mine = state.scene === item.scene && mode === "queued";
                const status = mine ? (state.loading ? "loading" : "queued") : "idle";
                return (
                  <li key={item.id} style={{ ["--i" as string]: i }}>
                    <button
                      type="button"
                      className={styles.button}
                      data-state={status}
                      data-dim={mode === "queued" && !mine}
                      aria-pressed={mine}
                      disabled={mode === "queued" && !mine}
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
                    >
                      <span className={styles.shard} aria-hidden="true" />
                      <span className={styles.index} aria-hidden="true">
                        {pad(i + 1)}
                      </span>
                      <span className={styles.text}>{item.label}</span>
                      <span className={styles.bars} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className={styles.sheen} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            className={styles.next}
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

        {pageOpen ? (
          <div className={styles.bar}>
            <button
              type="button"
              className={styles.corner}
              disabled={mode !== "page" && mode !== "intro"}
              onClick={() => {
                stage.current?.leave();
              }}
            >
              <i className={styles.back} aria-hidden="true" />
              <span>Back</span>
            </button>
          </div>
        ) : null}

        <AboutDrawers present={pageOpen && scene === "about"} shown={mode === "page"} />
        <SkillsDrawers present={pageOpen && scene === "skills"} shown={mode === "page"} />

        <ScreenCover ref={cover} />

        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
      </section>
    </div>
  );
}
