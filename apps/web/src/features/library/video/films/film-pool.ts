import { STALL_MS } from "@/lib/media-store";
import { PermanentFailure, isGone, untilItArrives } from "@/lib/retry";

import { bufferGoal, bufferedAhead } from "./film-math";

/**
 * The video elements of the Films room. A film is one `<video>` that lives here, not in React: the
 * loading list makes the first film's element and fills its buffer before the page opens, and the
 * page puts that same element on screen, so the seconds already buffered are the seconds that play
 * (nothing relies on the HTTP cache carrying them over to another element).
 *
 * A film is big (60 to 160 MB), so it is never loaded whole. The browser streams it, and
 * `warmFilm` waits until the first seconds from a given time are buffered, reporting the real
 * fraction (seconds buffered over the seconds wanted). The page keeps an element only for the film
 * on screen and its neighbours and releases the others (`keepFilms`), which drops their buffers.
 *
 * Like every download of the site it is never given up on because the connection is slow or bad
 * (`lib/retry.ts`): an error or a stall (no new second for `STALL_MS`) starts the film again after
 * a short wait, for as long as it takes. Only a file the server says is gone (HTTP 404 or 410), or
 * one that arrives and this browser cannot play, ends as `failed`: the page shows its poster and a
 * button to try again.
 */

/** Seconds a film must have in hand before it counts as ready: the loading bar waits for these. */
export const FIRST_SECONDS = 6;

export type FilmState = "idle" | "loading" | "ready" | "failed";

export interface FilmSource {
  id: string;
  /** The address of the file. */
  url: string;
  /** Seconds, from the data (the element knows it only once its header has arrived). */
  dur: number;
  /** Size of the file in bytes, to say how much of it the wait is about. */
  bytes: number;
}

export interface FilmStatus {
  state: FilmState;
  /** 0 to 1: seconds buffered over the seconds wanted. */
  progress: number;
}

interface Entry {
  source: FilmSource;
  el: HTMLVideoElement;
  status: FilmStatus;
  warm: Promise<void> | null;
  stop: AbortController | null;
  listeners: Set<(status: FilmStatus) => void>;
}

/** The film was let go while it was loading. Not a failure of the file. */
class Released extends PermanentFailure {
  constructor(id: string) {
    super(`released ${id}`);
    this.name = "Released";
  }
}

const entries = new Map<string, Entry>();

function notify(e: Entry): void {
  const status = { ...e.status };
  e.listeners.forEach((fn) => {
    fn(status);
  });
}

function set(e: Entry, next: Partial<FilmStatus>): void {
  const state = next.state ?? e.status.state;
  const progress = next.progress ?? e.status.progress;
  if (state === e.status.state && Math.abs(progress - e.status.progress) < 0.002) return;
  e.status = { state, progress };
  notify(e);
}

function entry(source: FilmSource): Entry {
  let e = entries.get(source.id);
  if (!e) {
    const el = document.createElement("video");
    el.preload = "auto";
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.disablePictureInPicture = true;
    el.setAttribute("disableremoteplayback", "");
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    el.dataset.filmVideo = source.id;
    e = {
      source,
      el,
      status: { state: "idle", progress: 0 },
      warm: null,
      stop: null,
      listeners: new Set(),
    };
    entries.set(source.id, e);
  }
  return e;
}

/** The element of a film (made on first ask). It has no file until `warmFilm` gives it one. */
export function filmVideo(source: FilmSource): HTMLVideoElement {
  return entry(source).el;
}

/** Has this film an element, and in what state is its buffer. */
export function filmStatus(id: string): FilmStatus | null {
  const e = entries.get(id);
  return e ? { ...e.status } : null;
}

/** Hear about a film's state and progress. Returns the way to stop. */
export function watchFilm(source: FilmSource, fn: (status: FilmStatus) => void): () => void {
  const e = entry(source);
  e.listeners.add(fn);
  fn({ ...e.status });
  return () => {
    e.listeners.delete(fn);
  };
}

/** Let the element drop its file and its buffer. */
function unload(el: HTMLVideoElement): void {
  el.pause();
  el.removeAttribute("src");
  el.load();
}

/** Why a try failed: gone for good, unplayable here, or worth another try. */
async function failure(e: Entry): Promise<Error> {
  const code = e.el.error?.code ?? 0;
  let status = 0;
  try {
    const r = await fetch(e.source.url, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
    status = r.status;
    void r.body?.cancel().catch(() => undefined);
  } catch {
    // No answer: the connection is down. `untilItArrives` waits for it.
  }
  if (isGone(status)) return new PermanentFailure(`HTTP ${status} for ${e.source.url}`, status);
  // It is there and this browser says it cannot play it: trying again will not change that.
  if (code === 4 && (status === 200 || status === 206)) {
    return new PermanentFailure(`This browser cannot play ${e.source.url}`, status);
  }
  return new Error(`Media error ${code} for ${e.source.url}`);
}

/** One try: give the element its file and wait for the seconds wanted from `from`. */
function attempt(e: Entry, from: number, seconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Released(e.source.id));
  const el = e.el;
  // A start inside the film goes in the address as a media fragment, so the browser fetches from
  // there instead of buffering the opening first.
  if (!el.getAttribute("src")) {
    el.src = from > 0.05 ? `${e.source.url}#t=${from.toFixed(2)}` : e.source.url;
  }
  return new Promise<void>((resolve, reject) => {
    let sought = from <= 0.05;
    let best = -1;
    let grew = performance.now();
    let ended = false;
    const events = [
      "loadedmetadata",
      "loadeddata",
      "progress",
      "canplay",
      "canplaythrough",
      "seeked",
      "timeupdate",
    ] as const;
    const check = () => {
      if (ended) return;
      if (!sought && el.readyState >= HTMLMediaElement.HAVE_METADATA) {
        sought = true;
        if (Math.abs(el.currentTime - from) > 0.3) el.currentTime = from;
      }
      const at = sought ? el.currentTime : from;
      const goal = bufferGoal(seconds, at, el.duration || e.source.dur);
      const ahead = bufferedAhead(el.buffered, at);
      if (ahead > best + 0.01) {
        best = ahead;
        grew = performance.now();
      }
      set(e, { state: "loading", progress: goal > 0 ? Math.min(1, ahead / goal) : 1 });
      const enough = ahead >= goal - 0.05 && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
      // The browser has stopped fetching and says so (`suspend`): its buffer is full for now, or it
      // is one that loads a film only once it plays (Safari on a phone does). Waiting longer would
      // bring nothing, so that counts as ready too.
      const idle =
        suspended &&
        el.networkState === HTMLMediaElement.NETWORK_IDLE &&
        el.readyState >= HTMLMediaElement.HAVE_METADATA;
      if (sought && !el.seeking && (enough || idle)) finish();
    };
    let suspended = false;
    const onSuspend = () => {
      suspended = true;
      check();
    };
    const onFetch = () => {
      suspended = false;
    };
    const onError = () => {
      if (ended) return;
      void failure(e).then((error) => {
        finish(error);
      });
    };
    const onAbort = () => {
      finish(new Released(e.source.id));
    };
    // A dead connection can hold the socket open for minutes without a byte: start again.
    const watchdog = window.setInterval(() => {
      if (performance.now() - grew > STALL_MS) finish(new Error(`Stalled: ${e.source.url}`));
    }, 1000);
    function finish(error?: Error) {
      if (ended) return;
      ended = true;
      window.clearInterval(watchdog);
      for (const name of events) el.removeEventListener(name, check);
      el.removeEventListener("suspend", onSuspend);
      el.removeEventListener("loadstart", onFetch);
      el.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      if (!error) {
        resolve();
        return;
      }
      // The next try starts clean (a stalled or broken stream is not reused).
      if (!(error instanceof Released)) unload(el);
      reject(error);
    }
    for (const name of events) el.addEventListener(name, check);
    el.addEventListener("suspend", onSuspend);
    el.addEventListener("loadstart", onFetch);
    el.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort);
    if (el.error) onError();
    else check();
  });
}

/**
 * Buffer the first `seconds` of a film from `from` (default: where it stands). Repeated calls share
 * one try. `onProgress` gets the fraction and an estimate of the bytes that stands for.
 */
export function warmFilm(
  source: FilmSource,
  options: {
    from?: number;
    seconds?: number;
    onProgress?: (fraction: number, bytes: { received: number; total: number }) => void;
  } = {},
): Promise<void> {
  const e = entry(source);
  const seconds = options.seconds ?? FIRST_SECONDS;
  const report = options.onProgress;
  let listener: ((s: FilmStatus) => void) | null = null;
  if (report) {
    const total = Math.round((source.bytes * seconds) / Math.max(1, source.dur));
    listener = (s) => {
      const f = s.state === "ready" ? 1 : s.progress;
      report(f, { received: Math.round(total * f), total });
    };
    e.listeners.add(listener);
    listener(e.status);
  }
  if (!e.warm) {
    const stop = new AbortController();
    const from = options.from ?? e.el.currentTime;
    e.stop = stop;
    set(e, { state: "loading", progress: e.status.state === "ready" ? 1 : e.status.progress });
    e.warm = untilItArrives(() => attempt(e, from, seconds, stop.signal)).then(
      () => {
        set(e, { state: "ready", progress: 1 });
      },
      (error: unknown) => {
        if (error instanceof Released) return;
        set(e, { state: "failed" });
        throw error;
      },
    );
    const mine = e.warm;
    void mine
      .finally(() => {
        if (e.warm === mine) {
          e.warm = null;
          e.stop = null;
        }
      })
      .catch(() => undefined);
  }
  const done = e.warm;
  return done.finally(() => {
    if (listener) e.listeners.delete(listener);
  });
}

/** Start a film that failed again, from where it stood. */
export function retryFilm(source: FilmSource, from?: number): Promise<void> {
  const e = entry(source);
  const at = from ?? e.el.currentTime;
  e.stop?.abort();
  e.warm = null;
  unload(e.el);
  set(e, { state: "loading", progress: 0 });
  return warmFilm(source, { from: at });
}

/** Let a film go: its element drops the file and its buffer and leaves the page. */
function releaseFilm(id: string): void {
  const e = entries.get(id);
  if (!e) return;
  e.stop?.abort();
  unload(e.el);
  e.el.remove();
  entries.delete(id);
  e.status = { state: "idle", progress: 0 };
  notify(e);
  e.listeners.clear();
}

/** Keep the films named, release every other. */
export function keepFilms(ids: ReadonlySet<string>): void {
  for (const id of Array.from(entries.keys())) if (!ids.has(id)) releaseFilm(id);
}

/** What every film holds now: its state, its time and its buffered seconds (for probes). */
export function poolSnapshot(): Record<string, { state: FilmState; t: number; buffered: string }> {
  const out: Record<string, { state: FilmState; t: number; buffered: string }> = {};
  for (const [id, e] of entries) {
    const b = e.el.buffered;
    const parts: string[] = [];
    for (let i = 0; i < b.length; i += 1)
      parts.push(`${b.start(i).toFixed(1)}-${b.end(i).toFixed(1)}`);
    out[id] = {
      state: e.status.state,
      t: Number(e.el.currentTime.toFixed(2)),
      buffered: parts.join(","),
    };
  }
  return out;
}
