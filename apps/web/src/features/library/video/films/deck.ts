import { audio } from "@/lib/audio";
import { useSiteStore } from "@/lib/stores";

import { activeText, captionTrack, loadCues } from "./captions";
import { bufferedAhead, mod } from "./film-math";
import {
  FIRST_SECONDS,
  filmStatus,
  filmVideo,
  keepFilms,
  retryFilm,
  warmFilm,
  watchFilm,
  type FilmSource,
  type FilmStatus,
} from "./film-pool";

/** One film as the deck knows it. */
export interface DeckFilm {
  source: FilmSource;
  /** Address of the English captions, when the film has them. */
  captions?: string;
}

/** What the page shows about the film on screen. */
export interface DeckView {
  index: number;
  /** `loading`: not playing yet, or waiting for data. `failed`: the poster and a retry. */
  state: "loading" | "playing" | "paused" | "failed";
  /** 0 to 1, seconds buffered over the seconds wanted, while loading. */
  progress: number;
  /** The film is heard. */
  audible: boolean;
  /** The site sound is on but the browser would not start the film with sound before a press. */
  blocked: boolean;
}

interface DeckHooks {
  /** The element that shows film `index` goes here. */
  host(index: number): HTMLElement | null;
  /** The slide of film `index` (it gets `data-frame` once the film has a picture to show). */
  slide(index: number): HTMLElement | null;
  view(view: DeckView): void;
  /** The words of the caption on screen ("" for none). */
  caption(text: string): void;
  /** The film on screen has ended. */
  ended(): void;
  /** The first film on screen has a picture, or has failed. */
  firstFrame(): void;
}

/** The next film starts to buffer once the one on screen has this many seconds in hand. */
const AHEAD_BEFORE_NEXT = 8;
/** A film that ran out of data in the middle goes on once it has this many seconds again. */
const RESUME_SECONDS = 4;

/**
 * Which film plays, which films hold a buffer, and the sound. The strip tells it which film is on
 * screen (`activate`) and when it has come to rest (`settle`).
 *
 * - The film on screen plays by itself, from where it was left, and the others are paused. It
 *   starts, and goes on after running out of data, only once it has a few seconds in hand (the
 *   bar shows the real fraction meanwhile), so a slow line gives a wait, never a stutter.
 * - Its neighbours are kept: the next one (in the direction of travel) is buffered once the one on
 *   screen has `AHEAD_BEFORE_NEXT` seconds in hand, so a slow line feeds the film being watched
 *   first. Every other film is released, which drops its buffer.
 * - Sound: the film is heard when the site sound is on and the visitor has pressed something on
 *   the site (a browser plays sound only after a press). Otherwise it plays muted and the sound
 *   button says so; a press on it turns the site sound on and the film is heard.
 */
export class FilmDeck {
  private films: readonly DeckFilm[];
  private hooks: DeckHooks;
  private current = -1;
  private el: HTMLVideoElement | null = null;
  private stopWatch: (() => void) | null = null;
  private stopEvents: (() => void) | null = null;
  private resumeAt = new Map<string, number>();
  /** The film on screen should play (it arrived, or the visitor pressed play). */
  private want = true;
  private blocked = false;
  private status: FilmStatus = { state: "idle", progress: 0 };
  private dir: 1 | -1 = 1;
  private nextWarmed = -1;
  private cc = true;
  private firstSent = false;
  private stopStore: () => void;
  private destroyed = false;

  constructor(films: readonly DeckFilm[], hooks: DeckHooks) {
    this.films = films;
    this.hooks = hooks;
    this.stopStore = useSiteStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) this.applySound();
    });
  }

  /** The film whose slide covers most of the screen changed. `fast`: the strip is flying past. */
  activate(index: number, fast: boolean): void {
    if (index === this.current) return;
    const old = this.el;
    if (old) {
      this.remember(this.current, old);
      old.pause();
    }
    this.unhook();
    this.current = index;
    this.want = true;
    this.hooks.caption("");
    const film = this.films[index];
    if (!film) return;
    // A film the strip only flies past is not loaded: its poster shows until the strip stops.
    if (fast && !filmStatus(film.source.id)) {
      this.el = null;
      this.emit({ state: "idle", progress: 0 });
      return;
    }
    this.mount(index);
  }

  /** The strip has come to rest on `index`, moving in `dir`. */
  settle(index: number, dir: 1 | -1 | 0): void {
    if (dir) this.dir = dir;
    if (index !== this.current) this.activate(index, false);
    else if (!this.el) this.mount(index);
    this.nextWarmed = -1;
    this.keepNeighbours();
    this.maybeWarmNext();
  }

  /** Start film `index` at `seconds` (a deep link with `&t=`). */
  startAt(index: number, seconds: number): void {
    const film = this.films[index];
    if (film && seconds > 0) this.resumeAt.set(film.source.id, seconds);
  }

  /** The visitor chose film `index` in the contents: start its buffer now, before the strip moves. */
  prepare(index: number): void {
    const film = this.films[index];
    if (!film || index === this.current) return;
    void warmFilm(film.source, { from: this.resumeAt.get(film.source.id) ?? 0 }).catch(
      () => undefined,
    );
  }

  /** The film on screen, for the controls. */
  video(): HTMLVideoElement | null {
    return this.el;
  }

  togglePlay(): void {
    const el = this.el;
    if (!el) return;
    if (!this.want || el.ended) {
      this.play();
    } else {
      this.want = false;
      el.pause();
    }
    this.emit();
  }

  seek(seconds: number): void {
    const el = this.el;
    if (!el) return;
    const dur = Number.isFinite(el.duration) ? el.duration : this.films[this.current]?.source.dur;
    el.currentTime = Math.max(0, Math.min(seconds, Math.max(0, (dur ?? seconds) - 0.05)));
  }

  /** The sound button. Called inside the press, so the browser lets the film be heard. */
  setSound(on: boolean): void {
    if (on) {
      audio.unlock();
      this.blocked = false;
      if (useSiteStore.getState().muted) useSiteStore.getState().setMuted(false);
      const el = this.el;
      if (el) {
        el.muted = false;
        if (el.paused && this.want) this.play();
      }
    } else {
      useSiteStore.getState().setMuted(true);
    }
    this.emit();
  }

  setCaptions(on: boolean): void {
    this.cc = on;
    this.hooks.caption("");
    if (on) this.hookCaptions();
  }

  /** Try a film that failed again. */
  retry(): void {
    const film = this.films[this.current];
    if (!film) return;
    void retryFilm(film.source, this.resumeAt.get(film.source.id) ?? 0).catch(() => undefined);
    this.unhook();
    this.mount(this.current);
  }

  destroy(): void {
    this.destroyed = true;
    this.unhook();
    this.stopStore();
    this.el?.pause();
    this.el = null;
  }

  // -------------------------------------------------------------------------------------------

  private soundAllowed(): boolean {
    if (useSiteStore.getState().muted) return false;
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    return activation ? activation.hasBeenActive : audio.unlocked;
  }

  private applySound(): void {
    const el = this.el;
    if (!el) return;
    if (useSiteStore.getState().muted) {
      el.muted = true;
    } else if (this.soundAllowed()) {
      el.muted = false;
      this.blocked = false;
    }
    this.emit();
  }

  private remember(index: number, el: HTMLVideoElement): void {
    const film = this.films[index];
    if (!film) return;
    if (el.ended || el.currentTime > film.source.dur - 1) this.resumeAt.delete(film.source.id);
    else if (el.currentTime > 0.5) this.resumeAt.set(film.source.id, el.currentTime);
  }

  /** Put the film's element in its slide, start its buffer if it has none, and play it. */
  private mount(index: number): void {
    const film = this.films[index];
    const host = this.hooks.host(index);
    if (!film || !host) return;
    const el = filmVideo(film.source);
    this.el = el;
    if (el.parentElement !== host) host.appendChild(el);
    const from = this.resumeAt.get(film.source.id) ?? 0;
    if (!filmStatus(film.source.id) || filmStatus(film.source.id)?.state === "idle") {
      void warmFilm(film.source, { from }).catch(() => undefined);
    } else if (
      from > 0 &&
      el.readyState >= HTMLMediaElement.HAVE_METADATA &&
      Math.abs(el.currentTime - from) > 1
    ) {
      el.currentTime = from;
    }
    this.hookEvents(index, el);
    this.stopWatch = watchFilm(film.source, (s) => {
      this.status = s;
      if (s.state === "failed") this.firstPicture();
      if (s.state === "ready" && this.want && el.paused && el === this.el) this.start();
      this.emit();
    });
    if (this.cc) this.hookCaptions();
    this.markFrame(index, el);
    if (this.want) this.play();
  }

  /** Play the film on screen: at once when it has its seconds in hand, else once it has them. */
  private play(): void {
    const el = this.el;
    const film = this.films[this.current];
    if (!el || !film || this.destroyed) return;
    this.want = true;
    if (el.ended) el.currentTime = 0;
    const status = filmStatus(film.source.id);
    if (status?.state === "ready") {
      this.start();
      return;
    }
    if (status?.state !== "loading") {
      void warmFilm(film.source, { from: el.currentTime }).catch(() => undefined);
    }
    this.emit();
  }

  /** It ran out of data: hold still until a few seconds are in again, then go on. */
  private refill(): void {
    const el = this.el;
    const film = this.films[this.current];
    if (!el || !film || !this.want || el.paused || el.ended) return;
    el.pause();
    void warmFilm(film.source, { from: el.currentTime, seconds: RESUME_SECONDS }).catch(
      () => undefined,
    );
    this.emit();
  }

  private start(): void {
    const el = this.el;
    if (!el || this.destroyed) return;
    const sound = this.soundAllowed();
    el.muted = !sound;
    // The site sound is on, but nothing has been pressed yet: the button says a press gives sound.
    this.blocked = !sound && !useSiteStore.getState().muted;
    const started = el.play();
    started.catch((error: unknown) => {
      if (el !== this.el) return;
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" && !el.muted) {
        // The browser wants a press before it plays sound: play muted and say so.
        el.muted = true;
        this.blocked = true;
        this.emit();
        void el.play().catch(() => undefined);
      }
    });
  }

  private hookEvents(index: number, el: HTMLVideoElement): void {
    const update = () => {
      this.markFrame(index, el);
      this.emit();
    };
    const onEnded = () => {
      const film = this.films[index];
      if (film) this.resumeAt.delete(film.source.id);
      this.hooks.ended();
    };
    const onProgress = () => {
      this.maybeWarmNext();
    };
    const onWaiting = () => {
      this.refill();
    };
    const names = [
      "play",
      "playing",
      "pause",
      "waiting",
      "canplay",
      "loadeddata",
      "seeked",
      "volumechange",
    ];
    for (const n of names) el.addEventListener(n, update);
    el.addEventListener("ended", onEnded);
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("progress", onProgress);
    el.addEventListener("timeupdate", onProgress);
    this.stopEvents = () => {
      for (const n of names) el.removeEventListener(n, update);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("timeupdate", onProgress);
    };
  }

  private unhook(): void {
    this.stopEvents?.();
    this.stopEvents = null;
    this.stopWatch?.();
    this.stopWatch = null;
    this.stopCaptions?.();
    this.stopCaptions = null;
  }

  private stopCaptions: (() => void) | null = null;

  private hookCaptions(): void {
    this.stopCaptions?.();
    this.stopCaptions = null;
    const film = this.films[this.current];
    const el = this.el;
    if (!film?.captions || !el) return;
    let live = true;
    let track: TextTrack | null = null;
    const show = () => {
      if (live && track && this.cc) this.hooks.caption(activeText(track));
    };
    void loadCues(film.captions)
      .then((cues) => {
        if (!live || el !== this.el) return;
        track = captionTrack(el, cues);
        if (!track) return;
        track.mode = "hidden";
        track.addEventListener("cuechange", show);
        show();
      })
      .catch(() => undefined);
    this.stopCaptions = () => {
      live = false;
      track?.removeEventListener("cuechange", show);
    };
  }

  /** Say on the slide that the film has a picture, so its poster can give way. */
  private markFrame(index: number, el: HTMLVideoElement): void {
    const slide = this.hooks.slide(index);
    const has = el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !el.error;
    if (slide) {
      if (has) slide.dataset.frame = "true";
      else delete slide.dataset.frame;
    }
    if (has) this.firstPicture();
  }

  private firstPicture(): void {
    if (this.firstSent) return;
    this.firstSent = true;
    this.hooks.firstFrame();
  }

  /** Keep the film on screen and its two neighbours, release the rest. */
  private keepNeighbours(): void {
    const n = this.films.length;
    const keep = new Set<string>();
    const add = (i: number, onlyIfHeld: boolean) => {
      const film = this.films[mod(i, n)];
      if (!film) return;
      if (onlyIfHeld && !filmStatus(film.source.id)) return;
      keep.add(film.source.id);
    };
    add(this.current, false);
    add(this.current + this.dir, false);
    add(this.current - this.dir, true);
    for (const film of this.films) {
      if (keep.has(film.source.id)) continue;
      const status = filmStatus(film.source.id);
      if (!status) continue;
      const el = filmVideo(film.source);
      if (el.currentTime > 0.5 && !el.ended) this.resumeAt.set(film.source.id, el.currentTime);
      const slide = this.hooks.slide(this.films.indexOf(film));
      if (slide) delete slide.dataset.frame;
    }
    keepFilms(keep);
  }

  /** Buffer the next film once the one on screen has enough in hand (or is fully loaded). */
  private maybeWarmNext(): void {
    const el = this.el;
    if (!el || this.current < 0) return;
    const next = mod(this.current + this.dir, this.films.length);
    if (this.nextWarmed === next) return;
    const film = this.films[next];
    if (!film) return;
    const ahead = bufferedAhead(el.buffered, el.currentTime);
    const left = (Number.isFinite(el.duration) ? el.duration : film.source.dur) - el.currentTime;
    if (ahead < Math.min(AHEAD_BEFORE_NEXT, Math.max(0, left - 0.5))) return;
    this.nextWarmed = next;
    const from = this.resumeAt.get(film.source.id) ?? 0;
    void warmFilm(film.source, { from, seconds: FIRST_SECONDS }).catch(() => undefined);
  }

  private emit(status?: FilmStatus): void {
    if (status) this.status = status;
    const el = this.el;
    let state: DeckView["state"];
    if (this.status.state === "failed") state = "failed";
    else if (!el) state = "loading";
    else if (!this.want) state = "paused";
    else if (el.paused || el.seeking || el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
      state = "loading";
    } else state = "playing";
    let progress = this.status.state === "loading" ? this.status.progress : 1;
    if (el && state === "loading" && this.status.state !== "loading") {
      progress = Math.min(1, bufferedAhead(el.buffered, el.currentTime) / RESUME_SECONDS);
    }
    this.hooks.view({
      index: this.current,
      state,
      progress,
      audible: !!el && !el.muted,
      blocked: this.blocked && !useSiteStore.getState().muted,
    });
  }
}
