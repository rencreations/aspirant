"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

import { useMusicDuck } from "../stream/use-duck";
import { Choices } from "./choices";
import { DRAMA_START, nodeById } from "./drama-graph";
import { markIndexAt, nextStep, previousMark } from "./drama-marks";
import { routeTags, type DramaAction, type DramaSave } from "./drama-state";
import { DRAMA_FILES, type DramaFileName } from "./drama.generated";
import styles from "./game.module.css";
import menuStyles from "./menus.module.css";
import { PauseMenu, type PausePanel } from "./pause-menu";
import { prefetchEpisodes, releaseEpisodes, useVideoDeck } from "./use-video-deck";

interface GameScreenProps {
  save: DramaSave;
  dispatch: (action: DramaAction) => DramaSave;
  /** A screen covers the game (the level select, the ending): the film is held and the keys are not the game's. */
  covered: boolean;
  /** The section is on screen. */
  visible: boolean;
  fullscreen: boolean;
  onFullscreen: () => void;
  /** Counts up when the browser left full screen by itself (Esc): the game pauses. */
  fullscreenExit: number;
  onQuit: () => void;
  onLevels: () => void;
  onEnding: () => void;
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

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
    <path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="3" />
  </svg>
);

/**
 * The game. Two stacked films (the episode playing and the one that comes next), a thin strip of
 * ticks for the dialogue, the two answers at the end of a chapter, and the pause menu. The film
 * plays on by itself; Space, a click or the right arrow jump to the next line (the marks of the
 * film), the left arrow goes back one, and the answers come up when the last line is gone.
 */
export function GameScreen({
  save,
  dispatch,
  covered,
  visible,
  fullscreen,
  onFullscreen,
  fullscreenExit,
  onQuit,
  onLevels,
  onEnding,
}: GameScreenProps) {
  const run = save.run;
  const node = nodeById(run?.node ?? DRAMA_START);
  const info = DRAMA_FILES[node.file as DramaFileName];
  const muted = useSiteStore((s) => s.muted);
  const duck = useMusicDuck();
  const frame = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<PausePanel | null>(null);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [time, setTime] = useState(run?.at ?? 0);
  const [hidden, setHidden] = useState(false);
  const mark = useRef(-1);

  // What the handlers below need, as it is now.
  const live = useRef({ node, info, run, panel, choicesOpen, selected });
  useEffect(() => {
    live.current = { node, info, run, panel, choicesOpen, selected };
  });

  const deck = useVideoDeck({
    muted,
    onTime: (t, file) => {
      const { node: n, info: inf } = live.current;
      if (file !== n.file) return;
      setTime((p) => (Math.abs(p - t) < 0.2 ? p : t));
      if (inf.choiceAt !== null) {
        if (t >= inf.choiceAt - 0.02) setChoicesOpen(true);
        else if (t < inf.choiceAt - 0.4) setChoicesOpen(false);
      }
      const i = markIndexAt(inf.marks, t);
      if (i !== mark.current) {
        mark.current = i;
        const at = inf.marks[i];
        if (i >= 0 && at !== undefined) dispatch({ type: "advance", at });
      }
    },
    onEnded: (file) => {
      const n = live.current.node;
      if (file !== n.file) return;
      if (n.choices.length === 0) {
        dispatch({ type: "finish" });
        onEnding();
      } else setChoicesOpen(true);
    },
    onPlaying: (playing) => {
      duck(playing && !useSiteStore.getState().muted);
    },
  });
  const { load, setHeld, seek, play, time: now } = deck;

  // A new episode: load it, from where the run is, and warm the two it can lead to. (A new run is a
  // new screen: the shell gives it a new key, so everything here starts again.)
  useEffect(() => {
    const { node: n, info: inf, run: r } = live.current;
    const at = r?.at ?? 0;
    mark.current = markIndexAt(inf.marks, at);
    load(n.file as DramaFileName, at);
    prefetchEpisodes(
      n.choices.map((c) => nodeById(c.to).file as DramaFileName),
      n.file as DramaFileName,
    );
  }, [node.id, load]);

  // Leaving the game frees what it loaded.
  useEffect(
    () => () => {
      releaseEpisodes();
    },
    [],
  );

  // The film is held while a menu is open, something covers the game, the tab is hidden, or the
  // section is off screen; it goes on when all of that is over.
  const hold = covered || !visible || hidden || panel !== null;
  useEffect(() => {
    setHeld(hold);
  }, [hold, setHeld]);

  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.visibilityState === "hidden");
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // The browser left full screen by itself (Esc): that is a pause.
  const [seenExit, setSeenExit] = useState(fullscreenExit);
  if (fullscreenExit !== seenExit) {
    setSeenExit(fullscreenExit);
    if (!covered && panel === null) setPanel("pause");
  }

  // The focus is on the game while it plays, so Space and the arrows are its own.
  useEffect(() => {
    if (panel === null && !covered) frame.current?.focus({ preventScroll: true });
  }, [panel, covered]);

  const skip = useCallback(() => {
    const { info: inf, panel: p, choicesOpen: open } = live.current;
    if (p !== null || open) return;
    const step = nextStep(inf, now());
    if (step.kind === "none") return;
    seek(step.at);
    setTime(step.at);
    if (step.kind === "choices") setChoicesOpen(true);
  }, [now, seek]);

  const back = useCallback(() => {
    const { info: inf, panel: p } = live.current;
    if (p !== null) return;
    const to = previousMark(inf.marks, now());
    seek(to);
    setTime(to);
    setChoicesOpen(false);
    // A film that had ended starts again from the line it was sent back to.
    play();
  }, [now, play, seek]);

  const choose = useCallback(
    (index: number) => {
      const { node: n, panel: p, choicesOpen: open } = live.current;
      if (!open || p !== null || !n.choices[index]) return;
      setChoicesOpen(false);
      setSelected(0);
      setTime(0);
      audio.blip("confirm");
      dispatch({ type: "choose", index });
    },
    [dispatch],
  );

  const active = (visible || fullscreen) && !covered;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const { panel: p, choicesOpen: open } = live.current;

      if (e.key === "Escape") {
        e.preventDefault();
        if (p === "pause") setPanel(null);
        else if (p !== null) setPanel("pause");
        else setPanel("pause");
        return;
      }
      // The menus have their own keys.
      if (p !== null) return;
      // A button that has the focus is pressed by Space and Enter, as always.
      const onControl = Boolean(target?.closest("button, a, [role='button']"));
      if (onControl && (e.key === " " || e.key === "Enter")) return;

      if (e.key === " ") {
        e.preventDefault();
        if (!open) skip();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (open) choose(live.current.selected);
        else skip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (open) setSelected(1);
        else skip();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (open) setSelected(0);
        else back();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (open) setSelected(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (open) setSelected(0);
      } else if (e.key === "1" || e.key === "2") {
        if (open) {
          e.preventDefault();
          choose(Number(e.key) - 1);
        }
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        onFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [active, back, choose, onFullscreen, skip]);

  // A click or a tap on the picture is the next line.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, a, [role='button']")) return;
    if (t.closest(`.${menuStyles.page}`)) return;
    skip();
  };

  const duration = info.duration;
  const said = info.lines.filter((l) => l.t <= time + 0.2);
  const showChoices = choicesOpen && panel === null && !covered;

  return (
    <div
      ref={frame}
      className={styles.game}
      tabIndex={-1}
      role="group"
      aria-label="Game screen"
      onClick={onClick}
    >
      <video
        {...deck.slot(0)}
        className={styles.video}
        data-front={deck.front === 0}
        playsInline
        preload="auto"
        tabIndex={-1}
        aria-hidden="true"
      />
      <video
        {...deck.slot(1)}
        className={styles.video}
        data-front={deck.front === 1}
        playsInline
        preload="auto"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className={styles.strip} aria-hidden="true">
        {info.marks.slice(1).map((m) => (
          <i key={m} style={{ left: `${String((m / duration) * 100)}%` }} />
        ))}
        {info.choiceAt !== null ? (
          <i data-choice style={{ left: `${String((info.choiceAt / duration) * 100)}%` }} />
        ) : null}
        <b style={{ transform: `scaleX(${String(Math.min(1, time / duration))})` }} />
      </div>

      {panel === null && !covered ? (
        <div className={styles.tools}>
          <button
            type="button"
            aria-label="Pause"
            onClick={() => {
              setPanel("pause");
            }}
          >
            <PauseIcon />
          </button>
          <button
            type="button"
            aria-label={fullscreen ? "Leave full screen" : "Full screen"}
            onClick={onFullscreen}
          >
            <FullscreenIcon />
          </button>
        </div>
      ) : null}

      {panel === null && !covered && !showChoices ? (
        <p className={styles.hint}>Tap the picture, or press Space, for the next line.</p>
      ) : null}

      {deck.status === "loading" ? (
        <div className={styles.wait} role="status" aria-label="Loading the next episode">
          <span className={styles.spinner} />
        </div>
      ) : null}
      {deck.status === "failed" ? (
        <div className={styles.wait} role="alert">
          <p>This episode did not start.</p>
          <button type="button" className={styles.retry} onClick={deck.retry}>
            Try again
          </button>
        </div>
      ) : null}

      {showChoices ? (
        <Choices node={node} selected={selected} onSelect={setSelected} onChoose={choose} />
      ) : null}

      {panel !== null && !covered ? (
        <div className={menuStyles.overlay} data-kind="pause">
          <PauseMenu
            panel={panel}
            onPanel={setPanel}
            onResume={() => {
              setPanel(null);
            }}
            onLevels={onLevels}
            onQuit={onQuit}
            route={run ? routeTags(run) : []}
            episode={node.title}
            said={said}
          />
        </div>
      ) : null}
    </div>
  );
}
