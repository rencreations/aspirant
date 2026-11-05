"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

import { audio } from "@/lib/audio";

import styles from "./deck.module.css";
import {
  formatSeconds,
  hintFor,
  sceneProgress,
  type NowPlaying,
  type RoomButton,
} from "./room-math";
import { Ruler } from "./ruler";
import type { Room } from "./use-room";
import { clipSeconds } from "./use-room";
import { fileBytes } from "./bundle";
import type { AnimChar } from "./types";

type Status = "idle" | "here" | "loading" | "queued" | "wanted" | "playing" | "blocked";

interface Props {
  room: Room;
  char: AnimChar;
  buttons: readonly RoomButton[];
  now: NowPlaying;
  baseHint: string;
}

const GLYPH: Record<string, ReactNode> = {
  welcome: <path d="M8 5.5v13l11-6.5z" />,
  idle: (
    <>
      <path d="M4 12a8 8 0 1 1 3 6.2" />
      <path d="M4 18v-6h6" />
    </>
  ),
  pose: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  short: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
};

/**
 * The deck under the stage: the ruler, what is playing (name, length, a line of text and a hint),
 * and the buttons. Each button calls the stage. A clip whose video has not arrived yet shows its
 * real progress, a queued clip shows a rail that fills for exactly as long as the wait.
 */
export function Deck({ room, char, buttons, now, baseHint }: Props) {
  const { state, phase, bundle, fractionOf } = room;
  const ready = phase === "ready";

  const statusOf = (b: RoomButton): Status => {
    const { kind, scene } = b.clip;
    if (!ready) return "blocked";
    if (kind === "welcome") return state.mode === "welcome" ? "playing" : "idle";
    if (kind === "idle")
      return state.mode === "idle" || state.mode === "returning" ? "here" : "idle";
    if (scene && state.scene === scene) {
      if (state.mode === "queued") return "queued";
      if (
        state.mode === "intro" ||
        state.mode === "page" ||
        state.mode === "leaving" ||
        state.mode === "outro" ||
        state.mode === "short"
      ) {
        return "playing";
      }
    }
    if (scene && room.wanted === scene) return "wanted";
    if (b.files.some((f) => !room.isLoaded(f))) return "loading";
    if (state.mode === "queued" || state.next !== null) return "blocked";
    if (!state.ui && state.mode !== "boot" && state.mode !== "welcome") return "blocked";
    return "idle";
  };

  const press = (b: RoomButton) => {
    audio.blip("click");
    if (b.clip.kind === "welcome") room.welcome();
    else if (b.clip.kind === "idle") room.idle();
    else if (b.clip.scene) room.play(b.clip.scene);
  };

  const pressedClip = now.button?.clip ?? null;
  const total = pressedClip ? clipSeconds(pressedClip, bundle) : null;
  const queued =
    state.mode === "queued" ? buttons.find((b) => b.clip.scene === state.scene) : undefined;
  const hint = hintFor({
    phase,
    state,
    label: queued?.clip.label ?? now.label,
    waitSeconds: state.wait ? state.wait.ms / 1000 : null,
    base: baseHint,
  });

  const groups = useMemo(
    () =>
      [
        {
          id: "scene",
          label: "Scenes",
          items: buttons.filter((b) => b.clip.kind === "welcome" || b.clip.kind === "idle"),
        },
        {
          id: "pose",
          label: buttons.filter((b) => b.clip.kind === "pose").length > 1 ? "Poses" : "Pose",
          items: buttons.filter((b) => b.clip.kind === "pose"),
        },
        { id: "short", label: "Clips", items: buttons.filter((b) => b.clip.kind === "short") },
      ].filter((g) => g.items.length > 0),
    [buttons],
  );

  const sizeOf = (file: string) => (bundle ? fileBytes(bundle, file) : 1);

  return (
    <div className={styles.deck}>
      <Ruler
        clipKey={ready ? now.key : null}
        durMs={now.durMs}
        loop={now.loop}
        offsetMs={() => {
          const clock = room.idleClock();
          return now.key === "idle" && clock ? clock.time * 1000 : 0;
        }}
      />

      <div className={styles.row}>
        <div className={styles.info}>
          <p className={`${styles.kicker} hud-label`}>
            {phase === "preparing"
              ? "Preparing"
              : phase === "loading"
                ? "Loading"
                : now.key === null
                  ? "Starting"
                  : "Now playing"}
          </p>
          <h2 className={`${styles.title} display`}>{phase === "ready" ? now.label : char.name}</h2>
          <p className={`${styles.meta} hud-label`}>
            {now.part ? <span>{now.part}</span> : null}
            {total !== null || now.button ? <span>Length {formatSeconds(total)}</span> : null}
          </p>
          <p className={styles.line}>{pressedClip?.line ?? ""}</p>
          <p className={styles.hint} role="status" aria-live="polite">
            {hint}
          </p>
        </div>

        <div className={styles.groups}>
          {groups.map((g) => (
            <div key={g.id} className={styles.group} role="group" aria-label={g.label}>
              <p className={`${styles.groupLabel} hud-label`}>{g.label}</p>
              <div className={styles.buttons}>
                {g.items.map((b, i) => {
                  const status = statusOf(b);
                  const progress = sceneProgress(
                    b.files,
                    (f) => (room.isLoaded(f) ? 1 : fractionOf(f)),
                    sizeOf,
                  );
                  const dur = clipSeconds(b.clip, bundle);
                  const sub =
                    status === "loading"
                      ? `Loading ${Math.round(progress * 100)}%`
                      : status === "queued"
                        ? "Getting ready"
                        : status === "wanted"
                          ? "After the welcome"
                          : status === "playing"
                            ? b.clip.kind === "pose"
                              ? "Go back"
                              : "Playing"
                            : status === "here"
                              ? "You are here"
                              : dur === null
                                ? "Not ready"
                                : formatSeconds(dur);
                  return (
                    <button
                      key={b.clip.id}
                      type="button"
                      className={styles.btn}
                      data-kind={b.clip.kind}
                      data-status={status}
                      aria-pressed={
                        status === "playing" || status === "here" || status === "queued"
                      }
                      aria-keyshortcuts={b.key === null ? "Space" : String(b.key)}
                      disabled={status === "loading" || status === "blocked"}
                      style={{ "--i": i } as CSSProperties}
                      onPointerEnter={() => {
                        if (b.clip.scene && status === "idle") room.warmScene(b.clip.scene);
                        if (status === "idle") audio.blip("hover");
                      }}
                      onFocus={() => {
                        if (b.clip.scene && status === "idle") room.warmScene(b.clip.scene);
                      }}
                      onClick={() => {
                        press(b);
                      }}
                    >
                      <span className={styles.key} aria-hidden="true">
                        {b.key ?? "Space"}
                      </span>
                      <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true">
                        {GLYPH[b.clip.kind]}
                      </svg>
                      <span className={`${styles.label} display`}>{b.clip.label}</span>
                      <span className={`${styles.sub} hud-label`}>{sub}</span>
                      <span className={styles.bar} aria-hidden="true">
                        {status === "loading" ? (
                          <i style={{ transform: `scaleX(${progress})` }} />
                        ) : status === "queued" && state.wait ? (
                          <i
                            key={state.wait.at}
                            className={styles.run}
                            style={
                              { "--wait": `${Math.max(state.wait.ms, 300)}ms` } as CSSProperties
                            }
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className={styles.caption}>
        <span className="hud-label">In the game</span> {char.caption}
      </p>
    </div>
  );
}
