"use client";

import { useEffect, useMemo, useRef } from "react";

import { audio } from "@/lib/audio";

import { useLibraryData } from "../data";
import { Chips, ControlBar, type ChipOption } from "../shell/controls";
import { LibraryShell } from "../shell/library-shell";
import { useQueryState } from "../use-query-state";
import { filterTracks, KIND_LABELS, KIND_ORDER, totalLength } from "./logic";
import styles from "./music.module.css";
import { PlayerBar } from "./player-bar";
import {
  closePlayer,
  seekTo,
  stepTrack,
  toggleQueue,
  togglePlayback,
  usePlayer,
  changeVolume,
} from "./player-store";
import { Shelf } from "./shelf";
import { TrackRow } from "./track-row";
import type { MusicFile, MusicItem } from "./types";

/** Keys that are for typing: the player's shortcuts leave them alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * The music room: the songs, the themes and the long listens as records on a shelf, with a
 * track list under it (credits, chapters, related films) and one player that stays at the foot
 * of the screen. Space plays and pauses, the arrows seek, N and P change track, Q opens the queue.
 */
export default function MusicPage() {
  const { data } = useLibraryData<MusicItem>("music");
  const file = data as MusicFile | null;
  const [q, setQ] = useQueryState("q");
  const [kind, setKind] = useQueryState("kind");
  const [target] = useQueryState("i");
  const hasTrack = usePlayer((s) => s.track !== null);

  const items = useMemo(() => file?.items ?? [], [file]);
  const shown = useMemo(() => filterTracks(items, { q, kind, who: "" }), [items, q, kind]);

  const kindOptions: ChipOption[] = useMemo(
    () =>
      KIND_ORDER.map((k) => ({
        value: k,
        label: KIND_LABELS[k],
        count: items.filter((i) => i.kind === k).length,
      })).filter((o) => o.count > 0),
    [items],
  );
  // The player belongs to this room: it stops when the visitor leaves.
  useEffect(
    () => () => {
      closePlayer();
    },
    [],
  );

  // A link to a track (`?i=`) scrolls to its row once the data has drawn.
  const arrived = useRef(false);
  useEffect(() => {
    if (!file || arrived.current || !target) return;
    arrived.current = true;
    const go = () => {
      document.getElementById(target)?.scrollIntoView({ behavior: "instant", block: "center" });
    };
    requestAnimationFrame(go);
    const again = window.setTimeout(go, 350);
    return () => {
      window.clearTimeout(again);
    };
  }, [file, target]);

  // Keyboard: Space plays and pauses, the arrows seek, N and P change track, Q opens the queue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const state = usePlayer.getState();
      if (!state.track) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onControl = el ? ["BUTTON", "A", "SUMMARY"].includes(el.tagName) : false;
      switch (e.key) {
        case " ":
          if (onControl) return;
          e.preventDefault();
          togglePlayback();
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          if (el?.tagName === "INPUT") return;
          const media = audio.getMusicElement();
          if (!media) return;
          e.preventDefault();
          seekTo(media.currentTime + (e.key === "ArrowRight" ? 5 : -5));
          break;
        }
        case "n":
        case "N":
          stepTrack(1);
          break;
        case "p":
        case "P":
          stepTrack(-1);
          break;
        case "q":
        case "Q":
          toggleQueue();
          break;
        case "+":
        case "=":
          changeVolume(state.volume + 0.05);
          break;
        case "-":
          changeVolume(state.volume - 0.05);
          break;
        case "Escape":
          if (state.queueOpen) toggleQueue(false);
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const summary = !file
    ? "Loading the music"
    : `${shown.length} of ${items.length} ${items.length === 1 ? "track" : "tracks"}`;

  const controls = (
    <ControlBar
      query={q}
      onQuery={setQ}
      placeholder="Search a title, a name or a word"
      summary={summary}
    />
  );

  return (
    <>
      <LibraryShell
        slug="music"
        count={file ? file.items.length : null}
        stat={file ? `${totalLength(file.totals.seconds)} of music` : undefined}
        controls={controls}
      >
        <div className={`${styles.page} shell`}>
          {file ? (
            <Chips label="Kind" options={kindOptions} value={kind} onChange={setKind} />
          ) : null}
          {file ? (
            shown.length > 0 ? (
              <>
                <section aria-labelledby="music-shelf">
                  <h2 id="music-shelf" className={`${styles.sectionHead} hud-label`}>
                    The shelf
                  </h2>
                  <Shelf items={shown} />
                </section>
                <section aria-labelledby="music-list">
                  <h2 id="music-list" className={`${styles.sectionHead} hud-label`}>
                    The tracklist
                  </h2>
                  <ol className={styles.list}>
                    {shown.map((item, i) => (
                      <TrackRow
                        key={item.id}
                        item={item}
                        index={i}
                        list={shown}
                        target={target === item.id}
                      />
                    ))}
                  </ol>
                </section>
              </>
            ) : (
              <p className={styles.empty} role="status">
                No track matches. Try a title, a name from the credits or a character.
              </p>
            )
          ) : (
            <p className={styles.empty}>Loading the music...</p>
          )}
        </div>
        <PlayerBar />
      </LibraryShell>
      {hasTrack ? (
        <div className={styles.barSpacer} data-theme="daybreak" aria-hidden="true" />
      ) : null}
    </>
  );
}
