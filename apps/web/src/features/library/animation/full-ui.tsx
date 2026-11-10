"use client";

import Link from "next/link";
import { useMemo, type CSSProperties, type MouseEvent, type ReactNode } from "react";

import type { StageState } from "@/features/character/stage/director";
import backStyles from "@/features/library/shell/room-chrome.module.css";
import { audio } from "@/lib/audio";

import type { StageBundle } from "./bundle";
import { optionButtons, sceneProgress, type RoomButton } from "./room-math";
import styles from "./shell.module.css";
import type { AnimChar, AnimClip } from "./types";
import type { Clips } from "./use-core";

type Status = "idle" | "loading" | "queued" | "wanted" | "playing" | "blocked";

interface Props {
  char: AnimChar | null;
  clips: readonly AnimClip[];
  bundle: StageBundle | null;
  state: StageState;
  wanted: string | null;
  files: Clips;
  onBack: (e: MouseEvent<HTMLAnchorElement>) => void;
  onPress: (button: RoomButton) => void;
  onWarm: (button: RoomButton) => void;
}

const GLYPH: Record<string, ReactNode> = {
  welcome: <path d="M8 5.5v13l11-6.5z" />,
  pose: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  short: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
};

/** The status of a button from the stage's state. No times: a live character has none. */
function statusOf(
  b: RoomButton,
  state: StageState,
  wanted: string | null,
  loaded: (file: string) => boolean,
): Status {
  const { kind, scene } = b.clip;
  if (kind === "welcome") return state.mode === "welcome" ? "playing" : "idle";
  if (scene && state.scene === scene) {
    if (state.mode === "queued") return "queued";
    if (["intro", "page", "leaving", "outro", "short"].includes(state.mode)) return "playing";
  }
  if (scene && wanted === scene) return "wanted";
  if (b.files.some((f) => !loaded(f))) return "loading";
  if (state.mode === "queued" || state.next !== null) return "blocked";
  if (!state.ui && state.mode !== "boot" && state.mode !== "welcome") return "blocked";
  return "idle";
}

/**
 * The full screen view's own controls: a way back to the carousel, and the character's animations
 * as buttons down the right. Nothing says it is a video: no bar, no time, no player. A clip that
 * has not arrived yet shows its real load on its button.
 */
export function FullUi({
  char,
  clips,
  bundle,
  state,
  wanted,
  files,
  onBack,
  onPress,
  onWarm,
}: Props) {
  const buttons = useMemo(() => optionButtons(clips, bundle?.timeline ?? null), [clips, bundle]);
  const sizeOf = (file: string) => (bundle ? (bundle.bytes[bundle.media.tier()]?.[file] ?? 1) : 1);

  return (
    <div className={styles.fullUi}>
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

      <div className={styles.options}>
        <p className={styles.optionsName}>
          <span className="display">{char?.name ?? ""}</span>
        </p>
        <div className={styles.optionsList} role="group" aria-label="Animations">
          {buttons.map((b, i) => {
            const status = statusOf(b, state, wanted, files.isLoaded);
            const progress = sceneProgress(b.files, files.fractionOf, sizeOf);
            return (
              <button
                key={b.clip.id}
                type="button"
                className={styles.option}
                data-kind={b.clip.kind}
                data-status={status}
                aria-pressed={status === "playing" || status === "queued" || status === "wanted"}
                aria-keyshortcuts={String(i + 1)}
                disabled={status === "loading" || status === "blocked"}
                style={{ "--i": i } as CSSProperties}
                onPointerEnter={() => {
                  onWarm(b);
                  if (status === "idle") audio.blip("hover");
                }}
                onFocus={() => {
                  onWarm(b);
                }}
                onClick={() => {
                  audio.blip("click");
                  onPress(b);
                }}
              >
                <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
                  {GLYPH[b.clip.kind]}
                </svg>
                <span className={styles.optionLabel}>{b.clip.label}</span>
                <span className={styles.optionNote}>
                  {status === "loading"
                    ? `Loading ${Math.round(progress * 100)}%`
                    : status === "wanted"
                      ? "Next"
                      : ""}
                </span>
                <span className={styles.optionBar} aria-hidden="true">
                  {status === "loading" ? <i style={{ transform: `scaleX(${progress})` }} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
