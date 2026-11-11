"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

import backStyles from "@/features/library/shell/room-chrome.module.css";
import { audio } from "@/lib/audio";

import type { OptionView, Phase, Role, Wait } from "./full-state";
import type { RoomButton } from "./room-math";
import styles from "./shell.module.css";
import type { Fullscreen } from "./use-fullscreen";

interface Props {
  name: string;
  phase: Phase;
  /** Every button and whether it can be pressed now (`optionViews`). */
  views: readonly OptionView[];
  /** What the one button left shows while its clip is on the way. */
  wait: Wait | null;
  /** How much of the pressed clip is in memory, 0 to 1. */
  progress: number;
  /** The engine's wait for the frame the clip starts on, measured when it began, or null. */
  timing: { ms: number; at: number } | null;
  /** A tall screen (a phone upright): the options open from one Actions button at the foot. */
  tall: boolean;
  /** A short screen (a phone on its side): full screen is offered there too. */
  low: boolean;
  whole: boolean;
  fullscreen: Fullscreen;
  onBack: (e: MouseEvent<HTMLAnchorElement>) => void;
  onPress: (button: RoomButton) => void;
  onWhole: () => void;
  onWarm: (button: RoomButton) => void;
}

const GLYPH: Record<Role | "back", ReactNode> = {
  welcome: <path d="M8 5.5v13l11-6.5z" />,
  pose: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  action: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  back: <path d="M9 5 4 10l5 5M4 10h9.5a5.5 5.5 0 0 1 0 11H10" />,
};

const Glyph = ({ name }: { name: Role | "back" }) => (
  <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true" data-glyph={name}>
    {GLYPH[name]}
  </svg>
);

function noteOf(view: OptionView, wait: Wait | null, progress: number): string {
  if (!view.shown || view.back || wait === null) return "";
  return wait === "loading" ? `Loading ${Math.round(progress * 100)}%` : "Starting";
}

/**
 * The hairline under the pressed button: the bytes of its clip while it loads, then the stage's
 * own wait for the frame the clip starts on (the length the engine measured, nothing made up).
 */
function Bar({
  wait,
  progress,
  timing,
}: {
  wait: Wait | null;
  progress: number;
  timing: { ms: number; at: number } | null;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || wait !== "starting" || !timing) return;
    const anim = el.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      duration: Math.max(1, timing.ms),
      delay: -(performance.now() - timing.at),
      easing: "linear",
      fill: "both",
    });
    return () => {
      anim.cancel();
    };
  }, [wait, timing]);
  return (
    <span className={styles.optionBar} aria-hidden="true">
      {wait === "loading" ? <i style={{ transform: `scaleX(${progress})` }} /> : null}
      {wait === "starting" && timing ? <i ref={ref} /> : null}
    </span>
  );
}

/**
 * The full screen view's own controls: the way back to the carousel, and the character's
 * animations as buttons. The buttons follow the stage (`fullPhase`): only what can be pressed
 * shows, so there is never a doubt which button works. On a wide screen they stand down the right;
 * on a tall one an Actions button at the foot opens them in a sheet, and two buttons beside the way
 * back take the view full screen and show the whole frame. Nothing says it is a video: no bar, no
 * time, no player.
 */
export function FullUi({
  name,
  phase,
  views,
  wait,
  progress,
  timing,
  tall,
  low,
  whole,
  fullscreen,
  onBack,
  onPress,
  onWhole,
  onWarm,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  /** The sheet was closed from inside: the focus goes back to the button at the foot. */
  const refocus = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLButtonElement>(null);
  /** The keyboard is in the list: when the focused button hides, the focus stays in the list. */
  const keep = useRef(false);

  // The first reveal is a transition too: the buttons start hidden and show a frame later.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setRevealed(true);
    });
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  const shownViews = views.filter((v) => v.shown);
  const idle = phase.phase === "idle" && shownViews.length > 0;
  const sheet = tall && open && idle;

  // The sheet holds the options at rest only, and only on a tall screen: a change of either
  // closes it, so it never opens again by itself.
  const sheetKey = `${tall}:${idle}`;
  const [seenKey, setSeenKey] = useState(sheetKey);
  if (seenKey !== sheetKey) {
    setSeenKey(sheetKey);
    setOpen(false);
  }

  useEffect(() => {
    const out = (e: Event) => {
      if (!listRef.current?.contains(e.target as Node)) keep.current = false;
    };
    document.addEventListener("focusin", out);
    document.addEventListener("pointerdown", out);
    return () => {
      document.removeEventListener("focusin", out);
      document.removeEventListener("pointerdown", out);
    };
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!keep.current || !list || tall) return;
    const a = document.activeElement;
    if (a && a !== document.body && list.contains(a) && !a.closest("[inert]")) return;
    const next = list.querySelector<HTMLButtonElement>('[data-shown="true"] button');
    (next ?? list).focus({ preventScroll: true });
  }, [phase.phase, phase.scene, revealed, tall]);

  // Once the sheet has closed, the button at the foot shows again and takes the focus back.
  useEffect(() => {
    if (sheet || !refocus.current) return;
    refocus.current = false;
    dockRef.current?.focus({ preventScroll: true });
  }, [sheet]);

  // Escape closes the sheet; focus goes back to the button that opened it.
  useEffect(() => {
    if (!sheet) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>('[data-shown="true"] button');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      refocus.current = true;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [sheet]);

  const press = (b: RoomButton) => {
    audio.blip("click");
    if (sheet) {
      setOpen(false);
      refocus.current = true;
    }
    onPress(b);
  };

  // The one button at the foot of a tall screen: Actions at rest, then the pressed one's state.
  const lone = phase.phase === "idle" ? null : (shownViews[0] ?? null);
  const dockShown = revealed && !sheet && (idle || lone !== null);
  const dockLabel = lone ? (lone.back ? "Back to idle" : lone.button.clip.label) : "Actions";
  const dockNote = lone ? noteOf(lone, wait, progress) : "";
  const dockGlyph: Role | "back" | null = lone ? (lone.back ? "back" : lone.button.role) : null;

  return (
    <div className={styles.fullUi} data-phase={phase.phase}>
      <div className={styles.topRow}>
        <Link
          href={"/collection/animation"}
          className={`${backStyles.back} ${styles.backTop}`}
          data-tone="light"
          onClick={onBack}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            aria-hidden="true"
            className={backStyles.arrow}
          >
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span>Animation</span>
        </Link>
        {fullscreen.supported && (tall || low || fullscreen.on) ? (
          <button
            type="button"
            className={styles.tool}
            aria-pressed={fullscreen.on}
            aria-label={fullscreen.on ? "Leave full screen" : "Full screen"}
            data-tool="fullscreen"
            onClick={() => {
              audio.blip("click");
              fullscreen.toggle();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {fullscreen.on ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </svg>
          </button>
        ) : null}
        {tall ? (
          <button
            type="button"
            className={styles.tool}
            aria-pressed={whole}
            data-tool="whole"
            onClick={() => {
              audio.blip("click");
              onWhole();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {whole ? (
                <path d="M3 8h18v8H3zM8 4h8M8 20h8" />
              ) : (
                <path d="M7 3h10v18H7zM3 9v6M21 9v6" />
              )}
            </svg>
            <span className={styles.toolText}>Whole frame</span>
          </button>
        ) : null}
      </div>

      {tall ? (
        <i
          className={styles.scrim}
          data-open={sheet}
          aria-hidden="true"
          onClick={() => {
            setOpen(false);
          }}
        />
      ) : null}

      <div
        className={styles.options}
        data-sheet={tall ? "" : undefined}
        data-state={tall ? (sheet ? "open" : "closed") : undefined}
        role={tall ? "dialog" : undefined}
        aria-label={tall ? `${name}, actions` : undefined}
        inert={tall && !sheet ? true : undefined}
      >
        <div className={styles.optionsHead}>
          <p className={styles.optionsName}>
            <span className="display">{name}</span>
          </p>
          {tall ? (
            <button
              type="button"
              className={styles.sheetClose}
              onClick={() => {
                setOpen(false);
                refocus.current = true;
              }}
            >
              Close
            </button>
          ) : null}
        </div>
        <div
          ref={listRef}
          className={styles.optionsList}
          role="group"
          aria-label="Animations"
          tabIndex={-1}
          onFocusCapture={() => {
            keep.current = true;
          }}
        >
          {views.map((v, i) => {
            const b = v.button;
            const shown = revealed && v.shown && (!tall || phase.phase === "idle");
            const note = noteOf(v, wait, progress);
            const waiting = v.shown && wait !== null;
            return (
              <div
                key={b.clip.id}
                className={styles.slot}
                data-shown={shown}
                style={{ "--i": shown ? i : 0 } as CSSProperties}
                inert={shown ? undefined : true}
              >
                <button
                  type="button"
                  className={styles.option}
                  data-kind={v.back ? "back" : b.role}
                  data-wait={waiting ? wait : undefined}
                  aria-pressed={waiting}
                  aria-keyshortcuts={b.key ? String(b.key) : undefined}
                  onPointerEnter={() => {
                    onWarm(b);
                    if (shown && !waiting) audio.blip("hover");
                  }}
                  onFocus={() => {
                    onWarm(b);
                  }}
                  onClick={() => {
                    press(b);
                  }}
                >
                  <Glyph name={v.back ? "back" : b.role} />
                  <span key={v.back ? "back" : "label"} className={styles.optionLabel}>
                    {v.back ? "Back to idle" : b.clip.label}
                  </span>
                  <span className={styles.optionNote}>{note}</span>
                  <Bar wait={waiting ? wait : null} progress={progress} timing={timing} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {tall ? (
        <div className={styles.dock} data-shown={dockShown} inert={dockShown ? undefined : true}>
          <button
            ref={dockRef}
            type="button"
            className={`${styles.option} ${styles.dockButton}`}
            data-kind={dockGlyph ?? "actions"}
            data-wait={lone && !lone.back && wait !== null ? wait : undefined}
            aria-haspopup={lone ? undefined : "dialog"}
            aria-expanded={lone ? undefined : sheet}
            aria-pressed={lone && !lone.back && wait !== null ? true : undefined}
            onClick={() => {
              if (lone) {
                press(lone.button);
                return;
              }
              audio.blip("click");
              setOpen(true);
            }}
          >
            {dockGlyph ? (
              <Glyph name={dockGlyph} />
            ) : (
              <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 15l6-6 6 6" />
              </svg>
            )}
            <span key={dockLabel} className={styles.optionLabel}>
              {dockLabel}
            </span>
            <span className={styles.optionNote}>{dockNote}</span>
            <Bar wait={lone && !lone.back ? wait : null} progress={progress} timing={timing} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
