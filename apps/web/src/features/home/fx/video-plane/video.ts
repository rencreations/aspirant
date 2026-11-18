/**
 * One video of the film plane: a real `<video>` kept off the page, muted, looping and playing
 * inline, and the texture that follows it. The file comes from the media store (`loadMedia`, the
 * same path string the loading list used, so one download serves both) and is a blob in memory.
 *
 * `play` and `pause` follow what is on screen, so only the planes a visitor can see are decoded.
 * The texture is a `VideoTexture` (it uploads when the browser presents a new frame, about 24 times
 * a second, not every frame of the page), with mipmaps and anisotropy, because the pictures are
 * drawn smaller than they are and, for the trailer, at an angle.
 */
import { LinearFilter, LinearMipmapLinearFilter, VideoTexture } from "three";

import { loadMedia } from "@/lib/media-store";

export interface VideoSpec {
  readonly path: string;
  readonly w: number;
  readonly h: number;
  readonly bytes: number;
  /** Loaded behind the urgent downloads (the previews), or as urgent as the page (the trailer). */
  readonly background: boolean;
}

export class FilmVideo {
  readonly el: HTMLVideoElement;
  readonly texture: VideoTexture;
  /** The first frame is in the texture. */
  ready = false;
  /** The picture's fade in, 0 to 1 (it eases up after `ready`). */
  shown = 0;
  /** Frames the browser has presented, for the probes. */
  frames = 0;
  private wanted = false;
  private disposed = false;
  private starting = false;

  constructor(
    readonly spec: VideoSpec,
    anisotropy: number,
  ) {
    const el = document.createElement("video");
    el.muted = true;
    el.defaultMuted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = "auto";
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.disablePictureInPicture = true;
    el.disableRemotePlayback = true;
    this.el = el;

    const tex = new VideoTexture(el);
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = anisotropy;
    this.texture = tex;

    el.addEventListener("loadeddata", this.onData);
    el.addEventListener("seeked", this.onData);
    if ("requestVideoFrameCallback" in el) this.countFrames();
  }

  /** Begin loading the file (idempotent). The picture is shown when its first frame is decoded. */
  start(): void {
    if (this.starting || this.disposed) return;
    this.starting = true;
    void loadMedia(this.spec.path, {
      type: "video/mp4",
      expectedBytes: this.spec.bytes,
      background: this.spec.background,
    }).then((url) => {
      if (this.disposed) return;
      this.el.src = url;
      this.el.load();
      if (this.wanted) this.tryPlay();
    });
  }

  /** The tick of the browser's own frames, counted for the probes (the texture follows them by itself). */
  private countFrames(): void {
    const tick = (): void => {
      if (this.disposed) return;
      this.frames += 1;
      this.el.requestVideoFrameCallback(tick);
    };
    this.el.requestVideoFrameCallback(tick);
  }

  private readonly onData = (): void => {
    if (this.disposed || this.el.readyState < 2) return;
    this.ready = true;
    this.texture.needsUpdate = true;
  };

  /** Play (a plane the visitor can see). */
  play(): void {
    this.wanted = true;
    this.start();
    this.tryPlay();
  }

  private tryPlay(): void {
    const el = this.el;
    if (this.disposed || !el.paused || el.readyState < 2) return;
    void el.play().catch(() => undefined);
  }

  /** Pause (off screen, hidden, a frozen probe). The last frame stays in the texture. */
  pause(): void {
    this.wanted = false;
    if (!this.el.paused) this.el.pause();
  }

  get playing(): boolean {
    return !this.el.paused && !this.el.ended;
  }

  /** The context was made again: upload the frame once more. */
  rebuilt(): void {
    if (this.ready) this.texture.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.el.removeEventListener("loadeddata", this.onData);
    this.el.removeEventListener("seeked", this.onData);
    this.el.pause();
    this.texture.dispose();
    this.el.removeAttribute("src");
    this.el.load();
  }
}
