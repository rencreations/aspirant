import { put } from "@/features/character/vexana/seams/scroll-kit";
import { drawFace, groundOf, loadDiscFonts } from "@/features/library/music/disc-art";
import { getFaceBitmap, holdFaceBitmaps } from "@/features/library/music/faces";
import { clock, discUrl } from "@/features/library/music/logic";
import { MUSIC_UI } from "../../content";
import { releases } from "./tracks";

export class MusicDom {
  readonly tracks: HTMLButtonElement[];
  selected: HTMLButtonElement | undefined;
  private readonly center: HTMLElement | null;
  private readonly rotor: HTMLElement | null;
  private readonly label: HTMLElement | null;
  private readonly toggles: HTMLButtonElement[];
  private readonly sides: HTMLElement[];
  private readonly caption: HTMLElement | null;
  private readonly time: HTMLElement | null;
  private readonly error: HTMLElement | null;
  private readonly services: HTMLElement[];
  private readonly preview: HTMLElement | null;
  private readonly sleeve: HTMLImageElement | null;
  private readonly releaseFaces = holdFaceBitmaps();
  private readonly fonts = loadDiscFonts();
  private printRequest = 0;
  private hoverTrack: HTMLButtonElement | null = null;
  private previewSize = 0;
  private originX = 0;
  private originY = 0;
  private lastLift = 0;
  private playing = false;
  private second = -1;

  constructor(
    private readonly root: HTMLElement,
    private readonly choose: (track: HTMLButtonElement) => void,
  ) {
    this.tracks = Array.from(root.querySelectorAll("[data-music-key]"));
    this.selected = this.tracks[0];
    this.center = root.querySelector("[data-music-center]");
    this.rotor = root.querySelector("[data-music-rotor]");
    this.label = root.querySelector("[data-music-label]");
    this.toggles = Array.from(root.querySelectorAll("[data-music-toggle]"));
    this.sides = Array.from(root.querySelectorAll("[data-music-side]"));
    this.caption = root.querySelector("[data-music-caption]");
    this.time = root.querySelector("[data-music-clock]");
    this.error = root.querySelector("[data-music-error]");
    this.services = Array.from(root.querySelectorAll("[data-music-services]"));
    this.preview = root.querySelector("[data-music-preview]");
    this.sleeve = this.preview?.querySelector("img") ?? null;
    if (this.selected) void this.print(this.selected);
    root.addEventListener("click", this.onClick);
    root.addEventListener("pointermove", this.onPointer);
    root.addEventListener("pointerout", this.onOut);
    root.addEventListener("pointercancel", this.hidePreview);
    root.addEventListener("focusin", this.onFocus);
    root.addEventListener("focusout", this.hidePreview);
    window.addEventListener("resize", this.hidePreview);
  }

  private async print(track: HTMLButtonElement): Promise<void> {
    const item = releases.get(track.dataset.musicKey ?? "");
    if (!this.label || !item) return;
    const request = ++this.printRequest;
    this.label.replaceChildren();
    this.label.style.backgroundImage = `url("${discUrl(item)}")`;
    const [bitmap] = await Promise.all([getFaceBitmap(item.disc), this.fonts]);
    if (request === this.printRequest)
      this.label.replaceChildren(drawFace(item, bitmap, groundOf(item)));
  }

  private showPreview(track: HTMLButtonElement, x: number, y: number): void {
    const preview = this.preview;
    if (!preview || !this.sleeve) return;
    if (track !== this.hoverTrack) {
      const bounds = this.root.getBoundingClientRect();
      this.originX = bounds.left;
      this.originY = bounds.top;
      this.previewSize = preview.offsetWidth;
      this.sleeve.src = track.dataset.cover ?? "";
      this.hoverTrack = track;
      preview.dataset.open = "1";
    }
    const size = this.previewSize;
    const beside = x + 20 + size <= window.innerWidth - 8 ? x + 20 : x - size - 20;
    const left = Math.max(8, Math.min(window.innerWidth - size - 8, beside));
    const top = Math.max(8, Math.min(window.innerHeight - size - 8, y - size * 0.45));
    put(preview, "transform", `translate3d(${left - this.originX}px,${top - this.originY}px,0)`);
  }

  readonly hidePreview = (): void => {
    if (this.preview && this.hoverTrack) delete this.preview.dataset.open;
    this.hoverTrack = null;
  };

  private readonly onPointer = (event: PointerEvent): void => {
    const track =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-music-key]")
        : null;
    if (track && event.pointerType !== "touch")
      this.showPreview(track, event.clientX, event.clientY);
    else this.hidePreview();
  };

  private readonly onOut = (event: PointerEvent): void => {
    if (!(event.relatedTarget instanceof Node) || !this.hoverTrack?.contains(event.relatedTarget))
      this.hidePreview();
  };

  private readonly onFocus = (event: FocusEvent): void => {
    const track = event.target;
    if (track instanceof HTMLButtonElement && track.matches("[data-music-key]:focus-visible")) {
      const bounds = track.getBoundingClientRect();
      this.showPreview(track, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    const button =
      event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button) return;
    const track = this.toggles.includes(button) ? this.selected : button;
    if (track && this.tracks.includes(track)) this.choose(track);
  };

  select(track: HTMLButtonElement): void {
    this.message("");
    if (track === this.selected) return;
    if (this.selected) {
      this.selected.dataset.selected = "0";
      this.selected.setAttribute("aria-pressed", "false");
    }
    this.selected = track;
    track.dataset.selected = "1";
    void this.print(track);
    for (const group of this.services)
      group.hidden = group.dataset.musicServices !== track.dataset.musicKey;
    if (this.caption) this.caption.textContent = track.dataset.title ?? "";
    this.second = -1;
    this.controls();
  }

  private controls(): void {
    const track = this.selected;
    if (!track) return;
    track.setAttribute("aria-pressed", String(this.playing));
    for (const toggle of this.toggles) {
      toggle.setAttribute(
        "aria-label",
        `${this.playing ? MUSIC_UI.pause : MUSIC_UI.play} ${track.dataset.title}`,
      );
    }
    this.root.dataset.playing = this.playing ? "1" : "0";
  }

  playback(playing: boolean, seconds: number): void {
    if (this.playing !== playing) {
      this.playing = playing;
      this.controls();
    }
    const second = Math.floor(seconds);
    if (second === this.second) return;
    this.second = second;
    if (this.time)
      this.time.textContent = `${clock(second)} / ${clock(Number(this.selected?.dataset.seconds ?? 0))}`;
  }

  message(text: string): void {
    if (this.error) this.error.textContent = text;
  }

  scene(enter: number, lift: number): void {
    if (lift !== this.lastLift || enter === 0) this.hidePreview();
    this.lastLift = lift;
    put(this.root, "opacity", enter.toFixed(3));
    put(this.root, "transform", `translate3d(0,${-lift}px,0)`);
    const offset = 1 - enter;
    put(
      this.center,
      "transform",
      `translateY(${(offset * 16).toFixed(2)}%) scale(${(1 - offset * 0.27).toFixed(3)})`,
    );
    this.sides.forEach((side, i) =>
      put(side, "transform", `translateX(${((i ? 1 : -1) * offset * 27).toFixed(2)}%)`),
    );
  }

  spin(angle: number): void {
    put(this.rotor, "transform", `rotate(${angle.toFixed(2)}deg)`);
  }

  dispose(): void {
    this.printRequest++;
    this.releaseFaces();
    this.hidePreview();
    this.root.removeEventListener("click", this.onClick);
    this.root.removeEventListener("pointermove", this.onPointer);
    this.root.removeEventListener("pointerout", this.onOut);
    this.root.removeEventListener("pointercancel", this.hidePreview);
    this.root.removeEventListener("focusin", this.onFocus);
    this.root.removeEventListener("focusout", this.hidePreview);
    window.removeEventListener("resize", this.hidePreview);
  }
}
