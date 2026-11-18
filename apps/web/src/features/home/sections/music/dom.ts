/**
 * The words of the music section after the server drew them: the phase of the scene (which line
 * shows), the title of the record that plays, the keys for the keyboard and the two buttons at the
 * foot. The runtime tells it what the scene is doing; it tells the runtime what the visitor pressed.
 * Attributes are written only when they change.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { MUSIC_UI } from "../../content";

import styles from "./music.module.css";

/**
 * What the words say. "away": nothing (the scene has not begun or has gone), "wait": the props are
 * coming in, "ready": a record can be picked, "picked": one was.
 */
export type Phase = "away" | "wait" | "ready" | "picked";

export interface MusicDomHandlers {
  /** A record was chosen by a key (a real press, so the sound may start). */
  track(index: number): void;
  /** "Another record". */
  another(): void;
  /** "Continue": let go of the page and go on. */
  keep(): void;
  /** The key that turns the crank for a moment. */
  crank(): void;
}

export class MusicDom {
  private readonly keys: HTMLElement | null;
  private readonly trackName: HTMLElement | null;
  private readonly label: HTMLElement | null;
  private readonly content: HTMLElement | null;
  private readonly another: HTMLElement | null;
  private readonly keep: HTMLElement | null;
  private phase: Phase = "away";
  private held = false;
  private again = false;
  private built = false;

  constructor(
    private readonly root: HTMLElement,
    content: HTMLElement | null,
    private readonly handlers: MusicDomHandlers,
  ) {
    this.keys = root.querySelector<HTMLElement>("[data-music-keys]");
    this.trackName = root.querySelector<HTMLElement>("[data-music-track]");
    this.label = root.querySelector<HTMLElement>("[data-music-label]");
    this.content = content;
    this.another = root.querySelector<HTMLElement>("[data-music-another]");
    this.keep = root.querySelector<HTMLElement>("[data-music-continue]");
    this.another?.addEventListener("click", this.onAnother);
    this.keep?.addEventListener("click", this.onKeep);
  }

  setPhase(phase: Phase): void {
    if (phase === this.phase) return;
    this.phase = phase;
    this.root.dataset.phase = phase;
  }

  setHeld(held: boolean): void {
    if (held === this.held) return;
    this.held = held;
    this.root.dataset.held = held ? "1" : "0";
  }

  setAgain(on: boolean): void {
    if (on === this.again) return;
    this.again = on;
    this.root.dataset.again = on ? "1" : "0";
  }

  /** "Now playing" once the song sounds, "Picked" while the record is on its way. */
  setSounding(sounding: boolean): void {
    const text = sounding ? MUSIC_UI.nowPlaying : MUSIC_UI.picked;
    if (this.label && this.label.textContent !== text) this.label.textContent = text;
  }

  setTitle(title: string): void {
    if (this.trackName && this.trackName.textContent !== title) this.trackName.textContent = title;
  }

  /** The words fade in with the scroll and out at the end. */
  setFade(opacity: number, lift: number): void {
    put(this.content, "opacity", String(Math.round(opacity * 200) / 200));
    put(this.content, "transform", `translate3d(0, ${Math.round(lift * 5) / 5}px, 0)`);
  }

  /** One key for every record, and one for the crank. Built once, when the records are known. */
  buildKeys(titles: readonly string[]): void {
    const keys = this.keys;
    if (!keys || this.built) return;
    this.built = true;
    titles.forEach((title, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = styles.key ?? "";
      button.textContent = `${MUSIC_UI.listen} ${i + 1}. ${title}`;
      button.dataset.musicKey = String(i);
      button.addEventListener("click", () => {
        this.handlers.track(i);
      });
      keys.append(button);
    });
    const crank = document.createElement("button");
    crank.type = "button";
    crank.className = styles.key ?? "";
    crank.textContent = MUSIC_UI.crank;
    crank.addEventListener("click", () => {
      this.handlers.crank();
    });
    keys.append(crank);
  }

  dispose(): void {
    this.another?.removeEventListener("click", this.onAnother);
    this.keep?.removeEventListener("click", this.onKeep);
    put(this.content, "opacity", "");
    put(this.content, "transform", "");
  }

  private readonly onAnother = (): void => {
    this.handlers.another();
  };

  private readonly onKeep = (): void => {
    this.handlers.keep();
  };
}
