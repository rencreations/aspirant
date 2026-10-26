"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  SAVE_KEY,
  dramaReducer,
  emptySave,
  parseSave,
  serializeSave,
  type DramaAction,
  type DramaSave,
} from "./drama-state";

/**
 * Where the save lives when the browser will not keep it (private mode, blocked storage): the page's
 * memory. The game still works, it just does not remember across a reload.
 */
let memory: string | null = null;

function read(): string | null {
  try {
    return window.localStorage.getItem(SAVE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(raw: string): void {
  memory = raw;
  try {
    window.localStorage.setItem(SAVE_KEY, raw);
  } catch {
    /* storage unavailable: the copy in memory is what there is */
  }
}

/** The save as it was last read, so the same text gives the same object (React compares them). */
let cache: { raw: string | null; save: DramaSave } | null = null;

function snapshot(): DramaSave {
  const raw = read();
  if (cache?.raw !== raw) cache = { raw, save: parseSave(raw) };
  return cache.save;
}

const SERVER_SAVE = emptySave();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab played: its save is the one now.
  const onStorage = (e: StorageEvent) => {
    if (e.key === SAVE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const subscribeNever = (): (() => void) => () => undefined;

/**
 * The save of the game. The server renders the page before any save can be read, so the first render
 * of a visitor has an empty one; `ready` turns true once the page is up and the real save is in.
 * `dispatch` applies an action, keeps the result in the storage and returns it, so a caller can act
 * on what it became.
 */
export function useDramaSave(): {
  save: DramaSave;
  ready: boolean;
  dispatch: (action: DramaAction) => DramaSave;
} {
  const save = useSyncExternalStore(subscribe, snapshot, () => SERVER_SAVE);
  const ready = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const dispatch = useCallback((action: DramaAction) => {
    const current = snapshot();
    const next = dramaReducer(current, action);
    if (next !== current) {
      const raw = serializeSave(next);
      write(raw);
      cache = { raw, save: next };
      for (const l of listeners) l();
    }
    return next;
  }, []);

  return { save, ready, dispatch };
}
