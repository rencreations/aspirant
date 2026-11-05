"use client";

import { useMemo } from "react";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";
import { ROOM_ORDER } from "./characters";
import { Deck } from "./deck";
import { Gate } from "./gate";
import { Picker } from "./picker";
import { accentOf, buildButtons, formatSeconds, nowPlaying } from "./room-math";
import styles from "./page.module.css";
import type { AnimationFile, AnimClip } from "./types";
import { useRoom } from "./use-room";
import { useRoomKeys } from "./use-room-keys";

const NO_CLIPS: AnimClip[] = [];

/**
 * The Animation room: the in-game showcase animation of the ten Aspirants on one stage. A picker of
 * ten tabs, a film gate with the stage, and a deck of buttons that call the stage, so each clip
 * plays and dissolves back to the idle loop.
 */
export default function AnimationPage() {
  const { data } = useLibraryData<AnimClip>("animation");
  const file = data as AnimationFile | null;
  const clips = file?.items ?? NO_CLIPS;
  const { room, stage } = useRoom({ clips });

  const chars = file?.characters;
  const char = chars?.find((c) => c.slug === room.shown) ?? null;
  const shownClips = useMemo(
    () => clips.filter((c) => c.chars[0] === room.shown),
    [clips, room.shown],
  );
  const buttons = useMemo(
    () => buildButtons(shownClips, room.bundle?.timeline ?? null),
    [shownClips, room.bundle],
  );
  useRoomKeys(room, ROOM_ORDER, buttons);

  const now = useMemo(
    () => nowPlaying(room.state, room.bundle?.timeline ?? null, buttons),
    [room.state, room.bundle, buttons],
  );

  const accent = char ? accentOf(char.palette) : "#10a5d8";
  const nowLine =
    room.phase === "ready" && now.key !== null
      ? `${now.label}${now.part ? `, ${now.part}` : ""}${
          now.durMs ? `, ${formatSeconds(now.durMs / 1000)}` : ""
        }`
      : null;
  const queued =
    room.state.mode === "queued"
      ? buttons.find((b) => b.clip.scene === room.state.scene)
      : undefined;
  const waiting =
    room.phase === "ready" && queued
      ? {
          label: `Next: ${queued.clip.label}`,
          ms: room.state.loading || !room.state.wait ? null : room.state.wait.ms,
          at: room.state.wait?.at ?? 0,
        }
      : null;

  const index = Math.max(0, ROOM_ORDER.indexOf(room.shown ?? ROOM_ORDER[0]!));

  return (
    <LibraryShell
      slug="animation"
      count={file ? file.items.length : null}
      stat={file ? `${file.characters.length} characters` : undefined}
      controls={
        chars ? (
          <Picker
            characters={chars}
            selected={room.selected}
            onPick={room.pick}
            onWarm={room.warmTab}
          />
        ) : undefined
      }
    >
      <div className={`${styles.body} shell`}>
        {file && char ? (
          <Gate
            room={room}
            stage={stage}
            char={char}
            accent={accent}
            now={nowLine}
            waiting={waiting}
            index={index}
          >
            <Deck room={room} char={char} buttons={buttons} now={now} baseHint={file.hint} />
          </Gate>
        ) : (
          <div className={styles.empty} aria-busy="true" />
        )}
        <p className={`${styles.keys} hud-label`}>
          Keys: 1 to 9 press the buttons, Space plays the welcome, left and right change the
          character, Esc goes back to idle.
        </p>
      </div>
    </LibraryShell>
  );
}
