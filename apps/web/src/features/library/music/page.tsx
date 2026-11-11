"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useGLReady } from "@/components/gl/use-gl-ready";
import { ThemeZone } from "@/components/theme-zone";
import { audio } from "@/lib/audio";

import { useLibraryData } from "../data";
import { BackToCollection, useTransparentNav } from "../shell/room-chrome";
// The room is its own lazy chunk (`library-room.tsx`), with three.js and the scene in it.
import DiscScene from "./disc-scene";
import { indexOfId } from "./logic";
import styles from "./music.module.css";
import { readPlace, writePlace } from "./place";
import { PlayerBar } from "./player-bar";
import {
  changeVolume,
  closePlayer,
  seekTo,
  stepTrack,
  toggleQueue,
  togglePlayback,
  usePlayer,
} from "./player-store";
import { TrackList } from "./track-list";
import type { MusicItem } from "./types";

/** Keys that are for typing: the player's shortcuts leave them alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * The track a link names (`?i=`), read once. Without one, the track the visitor was on in this tab
 * (a film opened from Watch comes back to `/collection/music` with no `?i=`).
 */
function linkedId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("i") ?? readPlace();
}

/**
 * The music room (`/collection/music`): every track is a disc in a field that turns without end,
 * the disc in front is the one the words describe, and a press plays it through the room's player.
 * The plain list is always in the page (crawlers, no WebGL); while the scene runs it is out of
 * sight and out of reach. The top bar has no background and the one way out is the Collection
 * button.
 *
 * Keys: the arrows turn the field, Enter plays the disc in front, Space plays and pauses, N and P
 * change track, Q opens the queue, + and - change the volume.
 */
export default function MusicPage() {
  useTransparentNav("daybreak");
  const { data, failed } = useLibraryData<MusicItem>("music");
  const { supported } = useGLReady();
  const [sceneFailed, setSceneFailed] = useState(false);
  const items = useMemo(() => data?.items ?? null, [data]);
  const live = supported === true && !sceneFailed && !!items && items.length > 0;
  const state = supported === null || (!items && !failed) ? "pending" : live ? "live" : "plain";
  const [start] = useState(() => linkedId());
  const startIndex = useMemo(() => (items ? indexOfId(items, start) : 0), [items, start]);
  const moved = useRef(false);
  const hasTrack = usePlayer((s) => s.track !== null);

  // The player belongs to this room: it stops when the visitor leaves.
  useEffect(
    () => () => {
      closePlayer();
    },
    [],
  );

  // The address names the disc in front once the visitor has turned the field (or came by a link).
  const onSettle = useCallback(
    (index: number) => {
      const item = items?.[index];
      if (!item) return;
      writePlace(item.id);
      if (!moved.current && index === startIndex && !start) return;
      moved.current = true;
      const url = new URL(window.location.href);
      if (url.searchParams.get("i") === item.id) return;
      url.searchParams.set("i", item.id);
      window.history.replaceState(window.history.state, "", url);
    },
    [items, startIndex, start],
  );

  // A link to a track in the plain list scrolls to its row.
  useEffect(() => {
    if (live || !items || !start) return;
    requestAnimationFrame(() => {
      document.getElementById(start)?.scrollIntoView({ behavior: "instant", block: "center" });
    });
  }, [live, items, start]);

  // The player's keys (the field's own keys are in the scene).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const s = usePlayer.getState();
      const el = e.target instanceof HTMLElement ? e.target : null;
      const onControl = el ? ["BUTTON", "A", "SUMMARY"].includes(el.tagName) : false;
      switch (e.key) {
        case " ":
          // With the scene, Space belongs to the field (it plays the disc in front).
          if (live || onControl || !s.track) return;
          e.preventDefault();
          togglePlayback();
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          if (live || !s.track) return;
          const media = audio.getMusicElement();
          if (!media) return;
          e.preventDefault();
          seekTo(media.currentTime + (e.key === "ArrowRight" ? 5 : -5));
          break;
        }
        case "n":
        case "N":
          if (s.track) stepTrack(1);
          break;
        case "p":
        case "P":
          if (s.track) stepTrack(-1);
          break;
        case "q":
        case "Q":
          if (s.track) toggleQueue();
          break;
        case "+":
        case "=":
          changeVolume(s.volume + 0.05);
          break;
        case "-":
          changeVolume(s.volume - 0.05);
          break;
        case "Escape":
          if (s.queueOpen) toggleQueue(false);
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [live]);

  return (
    <ThemeZone
      theme="daybreak"
      as="div"
      className={styles.root}
      data-music={state}
      data-player={hasTrack ? "true" : undefined}
    >
      <BackToCollection tone="dark" />
      <div className={styles.fallback} inert={live}>
        <TrackList items={items} failed={failed} heading={!live} />
      </div>
      {live && items ? (
        <DiscScene
          items={items}
          start={startIndex}
          onSettle={onSettle}
          onFail={() => {
            setSceneFailed(true);
          }}
        />
      ) : null}
      <PlayerBar />
    </ThemeZone>
  );
}
