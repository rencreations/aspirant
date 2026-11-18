/**
 * One loop of the list inside its frame. The file comes whole from the media store (the loading
 * list fetches it, deferred; if the visitor is here first it is asked for now, as urgent), and
 * until it has arrived the frame shows its 4:5 still. It plays muted, only while its frame is on
 * screen: a paused video does not decode, and a hidden one that plays does. One play promise is
 * in flight at a time, and a pause waits for it (a play that is interrupted rejects).
 */
import { loadMedia, promoteMedia } from "@/lib/media-store";

import type { FrameWindow } from "./frames";
import { windowFit } from "./layout";
import styles from "./list.module.css";

export class LoopVideo {
  readonly el: HTMLVideoElement;
  private asked = false;
  private ready = false;
  private wantPlay = false;
  private pending = false;
  private disposed = false;

  constructor(
    private readonly path: string,
    parent: HTMLElement,
    private readonly pic: { w: number; h: number },
    private readonly win: FrameWindow,
  ) {
    const el = document.createElement("video");
    el.className = styles.video ?? "";
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = "auto";
    el.setAttribute("aria-hidden", "true");
    el.tabIndex = -1;
    parent.append(el);
    this.el = el;
  }

  /** Lay the picture so the window fills a frame of this size. */
  fit(frameW: number, frameH: number): void {
    const f = windowFit(frameW, frameH, this.pic.w, this.pic.h, this.win);
    const s = this.el.style;
    s.left = `${f.left}px`;
    s.top = `${f.top}px`;
    s.width = `${f.width}px`;
    s.height = `${f.height}px`;
  }

  /** The file is wanted soon: ask for it (a no-op after the first time). `urgent` jumps the queue. */
  want(urgent: boolean): void {
    if (this.disposed) return;
    if (urgent) promoteMedia(this.path);
    if (this.asked) return;
    this.asked = true;
    void loadMedia(this.path, { background: !urgent }).then((url) => {
      if (this.disposed) return;
      this.el.src = url;
      this.ready = true;
      this.sync();
    });
  }

  /** Play while `on`, pause otherwise. */
  play(on: boolean): void {
    if (this.wantPlay === on) return;
    this.wantPlay = on;
    this.sync();
  }

  private sync(): void {
    if (!this.ready || this.disposed || this.pending) return;
    const el = this.el;
    if (this.wantPlay && el.paused) {
      this.pending = true;
      void el.play().then(
        () => {
          this.pending = false;
          el.classList.add(styles.videoOn ?? "");
          this.sync();
        },
        () => {
          this.pending = false;
        },
      );
    } else if (!this.wantPlay && !el.paused) {
      el.pause();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.el.pause();
    this.el.removeAttribute("src");
    this.el.load();
    this.el.remove();
  }
}
