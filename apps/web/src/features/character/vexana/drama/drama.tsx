"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { asset } from "@/lib/asset";
import { useInView, useReducedMotion } from "@/lib/hooks";

import { DRAMA_START, nodeById } from "./drama-graph";
import { dramaPoster } from "./drama-media";
import { canContinue, routeTags } from "./drama-state";
import styles from "./drama.module.css";
import { EndingScreen } from "./ending-screen";
import { GameScreen } from "./game-screen";
import { LevelSelect } from "./level-select";
import menuStyles from "./menus.module.css";
import { TitleMenu } from "./title-menu";
import { useDramaSave } from "./use-drama-save";

type Screen = "title" | "play" | "ending";

const subscribeNever = (): (() => void) => () => undefined;

/** The browser can take an element full screen (not so on an iPhone). False until the page is up. */
function useFullscreenSupport(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => document.fullscreenEnabled,
    () => false,
  );
}

const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
    <path
      d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="square"
    />
  </svg>
);

/**
 * 06, the interactive drama: a visual novel of six chapters with branches and three endings, made
 * from the episodes of "Become The Aspirants". One screen tall, so the title, the game and the line
 * under it are all in view. Nothing plays until the player presses Continue, Start New or Play
 * from here (the episodes then play with sound, and the page's music steps aside).
 */
export function Drama() {
  const root = useRef<HTMLElement>(null);
  const cab = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const visible = useInView(root, { threshold: 0.5 });
  const { save, ready, dispatch } = useDramaSave();
  const [screen, setScreen] = useState<Screen>("title");
  /** The level select is open, and what is under it. */
  const [levels, setLevels] = useState<Screen | null>(null);
  const [runId, setRunId] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = useFullscreenSupport();
  const [fullscreenExit, setFullscreenExit] = useState(0);
  const was = useRef(false);
  const byButton = useRef(false);

  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === cab.current;
      const before = was.current;
      was.current = on;
      setFullscreen(on);
      if (before && !on) {
        if (byButton.current) byButton.current = false;
        else setFullscreenExit((n) => n + 1);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = cab.current;
    if (!el) return;
    if (document.fullscreenElement) {
      byButton.current = true;
      document.exitFullscreen().catch(() => {
        byButton.current = false;
      });
    } else if (document.fullscreenEnabled) {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  const startNew = useCallback(() => {
    dispatch({ type: "new" });
    setRunId((n) => n + 1);
    setLevels(null);
    setScreen("play");
  }, [dispatch]);

  const resume = useCallback(() => {
    if (!canContinue(save)) return;
    dispatch({ type: "continue" });
    setRunId((n) => n + 1);
    setScreen("play");
  }, [dispatch, save]);

  const playFrom = useCallback(
    (id: string) => {
      const next = dispatch({ type: "playFrom", node: id });
      if (next.run?.node !== id) return;
      setRunId((n) => n + 1);
      setLevels(null);
      setScreen("play");
    },
    [dispatch],
  );

  const run = save.run;
  const here = run && !run.finished ? run.node : null;
  const resumeNode = run && canContinue(save) ? nodeById(run.node) : null;
  const ending = screen === "ending" && run ? nodeById(run.node) : null;
  const covered = levels !== null || screen === "ending";
  const showTitle = screen === "title";

  return (
    <section
      ref={root}
      id="drama"
      className={styles.drama}
      data-theme="storm"
      aria-labelledby="drama-title"
    >
      <header className={styles.top}>
        <div className={styles.title}>
          <p className={styles.eyebrow}>
            <b>06</b>
            <i />
          </p>
          <h2 id="drama-title" className={styles.heading}>
            Interactive Drama
          </h2>
        </div>
      </header>

      <div className={styles.stage}>
        <div ref={cab} className={styles.cab} data-ready={ready} data-reduced={reduced}>
          {showTitle ? (
            <>
              {/* Plain <img>: static export, art already sized. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.poster}
                src={asset(dramaPoster(nodeById(DRAMA_START).file))}
                alt=""
                draggable={false}
              />
              <span className={styles.vignette} aria-hidden="true" />
              {levels === null ? (
                <TitleMenu
                  canContinue={ready && canContinue(save)}
                  resume={
                    resumeNode ? `Chapter ${String(resumeNode.chapter)}, ${resumeNode.title}` : null
                  }
                  onContinue={resume}
                  onNew={startNew}
                  onLevels={() => {
                    setLevels("title");
                  }}
                />
              ) : null}
              {canFullscreen && levels === null ? (
                <div className={styles.screenTools}>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-label={fullscreen ? "Leave full screen" : "Full screen"}
                    onClick={toggleFullscreen}
                  >
                    <FullscreenIcon />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <GameScreen
              key={runId}
              save={save}
              dispatch={dispatch}
              covered={covered}
              visible={visible}
              fullscreen={fullscreen}
              onFullscreen={toggleFullscreen}
              fullscreenExit={fullscreenExit}
              onQuit={() => {
                setLevels(null);
                setScreen("title");
              }}
              onLevels={() => {
                setLevels("play");
              }}
              onEnding={() => {
                setScreen("ending");
              }}
            />
          )}

          {ending && levels === null ? (
            <div className={menuStyles.overlay}>
              <EndingScreen
                title={ending.ending?.title ?? ending.title}
                kind={ending.ending?.kind}
                recap={run ? routeTags(run) : []}
                onAgain={startNew}
                onLevels={() => {
                  setLevels("ending");
                }}
                onTitle={() => {
                  setScreen("title");
                }}
              />
            </div>
          ) : null}

          {levels !== null ? (
            <LevelSelect
              save={save}
              here={here}
              onBack={() => {
                setLevels(null);
              }}
              onPlayFrom={playFrom}
            />
          ) : null}
        </div>
      </div>

      <footer className={styles.foot}>
        <p className={styles.how}>
          <span className={styles.keys}>
            Space or click: next line. Left and right: back and on. Esc: pause. F: full screen.
          </span>
          <span className={styles.touch}>
            Tap the picture for the next line. The pause button opens the menu.
          </span>
        </p>
      </footer>
    </section>
  );
}
