import { put } from "@/features/character/vexana/seams/scroll-kit";
import { withSound } from "@/lib/sound-prompt";

import type { DuoActor } from "../../actors/duo";
import { MUSIC_UI } from "../../content";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionEnd } from "../../kernel/where";
import { newSpots, ramp, smooth } from "../voices/choreo";

import { EXIT_RESET, exitAt, j10, j11, type Place } from "./choreo";
import { MusicDom } from "./dom";
import { SoundField } from "./field";
import { STAND } from "./stations";

const mix = (a: number, b: number, u: number) => a + (b - a) * u;

class MusicRuntime implements SectionRuntime {
  private readonly dom: MusicDom;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly field: SoundField;
  private readonly start = newSpots();
  private readonly end = newSpots();
  private readonly places: [Place, Place] = [
    { x: 0, y: 0, height: 0 },
    { x: 0, y: 0, height: 0 },
  ];
  private viewportW = 0;
  private viewportH = 0;
  private el: HTMLAudioElement | null = null;
  private local = -1;
  private request = 0;
  private angle = 0;
  private speed = 0;
  private bassAverage = 0;
  private inRange = false;

  constructor(
    private readonly ctx: SectionCtx,
    private readonly duo: DuoActor | null,
  ) {
    const root = ctx.dom.text.querySelector<HTMLElement>("[data-music]") ?? ctx.dom.text;
    this.canvas = ctx.dom.below.querySelector("[data-music-field]");
    this.field = new SoundField(this.canvas);
    this.dom = new MusicDom(root, (track) => this.choose(track));
  }

  private ownsMusic(): boolean {
    return (
      this.el !== null &&
      this.ctx.audio.getMusicElement() === this.el &&
      this.el.src === this.dom.selected?.dataset.audio
    );
  }

  private choose(track: HTMLButtonElement): void {
    if (!this.inRange || this.local < 0.025 || exitAt(this.local) > EXIT_RESET) return;
    const audio = this.ctx.audio;
    const token = ++this.request;
    const url = track.dataset.audio;
    if (!url) return;
    audio.unlock();
    if (track === this.dom.selected && this.ownsMusic() && this.el && !this.el.paused) {
      audio.pauseMusic();
      return;
    }
    if (track !== this.dom.selected) {
      if (this.ownsMusic()) audio.stopMusic(0);
      this.detach();
      this.dom.select(track);
      this.dom.playback(false, 0);
    }
    withSound("This song", () => {
      if (token !== this.request || !this.inRange) return;
      audio.stopVoice();
      if (track === this.dom.selected && this.ownsMusic() && this.el && !this.el.error) {
        if (this.el.ended) this.el.currentTime = 0;
        audio.resumeMusic(150);
        return;
      }
      this.detach();
      audio.playMusic(url, { loop: false, volume: 0.7, fadeMs: 250 });
      this.el = audio.getMusicElement();
      if (this.el) this.el.addEventListener("error", this.onError);
      else this.onError();
    });
  }

  private readonly onError = (): void => {
    this.stop(0);
    this.dom.message(MUSIC_UI.unavailable);
  };

  private detach(): void {
    this.el?.removeEventListener("error", this.onError);
    this.el = null;
  }

  private stop(fadeMs: number): void {
    this.request++;
    if (this.ownsMusic()) this.ctx.audio.stopMusic(fadeMs);
    this.detach();
    this.dom.playback(false, 0);
  }

  update(local: number, frame: FrameInfo): void {
    const out = exitAt(local);
    const enter = smooth(ramp(local, 0, STAND * 0.85));
    if (
      (local < 0.025 && this.local >= 0.025) ||
      (out > EXIT_RESET && exitAt(this.local) <= EXIT_RESET)
    )
      this.stop(550);
    this.local = local;
    const lift = Math.round(
      Math.min(1, Math.max(0, frame.S - sectionEnd("music") + 1)) * frame.viewport.h,
    );
    this.dom.scene(enter, lift);
    put(this.canvas, "opacity", enter.toFixed(3));
    put(this.canvas, "transform", `translate3d(0,${-lift}px,0)`);
    if (local < 0) return;
    const { w, h } = frame.viewport;
    const el = this.ownsMusic() ? this.el : null;
    const playing =
      !!el && !el.paused && !el.ended && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    this.dom.playback(playing, el?.currentTime ?? 0);
    if (enter > 0 && out < 1) {
      this.field.update(
        w,
        h,
        frame.dt,
        frame.time,
        playing ? this.ctx.audio.getMusicAnalyser() : null,
      );
    }
    this.speed = mix(this.speed, playing ? 29 : 0, 1 - Math.exp(-frame.dt * 4.8));
    this.angle = (this.angle + this.speed * frame.dt) % 360;
    this.dom.spin(this.angle + (1 - enter) * -50);
    this.drones(frame, enter, out, playing);
  }

  private drones(frame: FrameInfo, enter: number, out: number, playing: boolean): void {
    if (!this.duo) return;
    const { w, h } = frame.viewport;
    if (w !== this.viewportW || h !== this.viewportH) {
      this.viewportW = w;
      this.viewportH = h;
      j10(frame.viewport, this.start);
      j11(frame.viewport, this.end);
    }
    const portrait = w <= 760 && h > w;
    const size = Math.min(w * 0.12, h * 0.1, 86);
    const bass = this.field.bass;
    this.bassAverage = mix(this.bassAverage, bass, 1 - Math.exp(-frame.dt * 2.5));
    const beat = Math.min(1, Math.max(0, bass - this.bassAverage) * 4);
    for (const i of [0, 1] as const) {
      const key = i === 0 ? "a" : "b";
      const from = this.start[key];
      const to = this.end[key];
      const place = this.places[i];
      const sign = i === 0 ? -1 : 1;
      const energy = i === 0 ? beat : this.field.treble;
      const x = sign * w * (portrait ? 0.38 : 0.165);
      const y = (portrait ? 0.12 : -0.27) * h + energy * size * 0.48;
      place.x = mix(mix(from.x, x + sign * energy * size * 0.16, enter), to.x, out);
      place.y = mix(mix(from.y, y, enter), to.y, out);
      place.height = mix(mix(from.h, size, enter), to.h, out);
    }
    this.duo.visible = true;
    this.duo.place(this.places[0], this.places[1]);
    if (playing)
      this.duo.pose(
        "dance",
        Math.min(1, (bass * 0.45 + beat * 0.65 + this.field.treble * 0.4) * enter * (1 - out)),
      );
    else this.duo.pose("float", 1);
  }

  enter(): void {
    this.inRange = true;
  }

  leave(): void {
    this.inRange = false;
    this.dom.hidePreview();
    this.stop(550);
  }

  dispose(): void {
    this.leave();
    this.dom.dispose();
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  let duo: DuoActor | null = null;
  try {
    const { ensureDuo } = await import("../../actors/duo");
    duo = await ensureDuo(ctx);
  } catch (error) {
    console.warn("music: the drones could not be loaded", error);
  }
  return new MusicRuntime(ctx, duo);
}
