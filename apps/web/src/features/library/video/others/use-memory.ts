"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * What the room remembers between visits, in this browser only: the video the visitor was looking
 * at when they stopped scrolling (an id, never a pixel offset, so it still lands right when the
 * wall is built in slices or the page height changed) and the videos they have opened.
 */
const KEY = "aspirants:video-others";
const MAX_SEEN = 200;

interface Memory {
  /** The id of the video that was under the finder when the visitor stopped. */
  at: string;
  /** Ids of the videos that were opened, newest last. */
  seen: string[];
}

const EMPTY: Memory = { at: "", seen: [] };

function readMemory(): Memory {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<Memory>;
    return {
      at: typeof v.at === "string" ? v.at : "",
      seen: Array.isArray(v.seen) ? v.seen.filter((s): s is string => typeof s === "string") : [],
    };
  } catch {
    return EMPTY;
  }
}

function writeMemory(memory: Memory): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Not saved: the room works the same, it just forgets.
  }
}

export interface RoomMemory {
  /** The memory as it was when the page opened (it does not change while the visitor scrolls). */
  saved: Memory;
  seen: ReadonlySet<string>;
  /** Mark a video as opened. */
  markSeen: (id: string) => void;
  /** Remember the place (an id). Cheap: call it as often as needed, it writes after a pause. */
  rememberAt: (id: string) => void;
  /** Forget the place (the visitor chose to start again). */
  forgetAt: () => void;
}

export function useRoomMemory(): RoomMemory {
  // Read once, when the page mounts. Nothing drawn from it shows before the data has arrived, so the
  // server's markup and the first client render agree.
  const [saved, setSaved] = useState<Memory>(readMemory);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(readMemory().seen));

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      const m = readMemory();
      writeMemory({ ...m, seen: Array.from(next).slice(-MAX_SEEN) });
      return next;
    });
  }, []);

  const rememberAt = useCallback((id: string) => {
    const m = readMemory();
    if (m.at !== id) writeMemory({ ...m, at: id });
  }, []);

  const forgetAt = useCallback(() => {
    const m = readMemory();
    writeMemory({ ...m, at: "" });
    setSaved((s) => ({ ...s, at: "" }));
  }, []);

  return useMemo(
    () => ({ saved, seen, markSeen, rememberAt, forgetAt }),
    [saved, seen, markSeen, rememberAt, forgetAt],
  );
}
