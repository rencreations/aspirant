/**
 * The contracts of the home page's kernel. Everything a section, an actor or a pass may rely on is
 * here; `docs/design/home/kernel.md` says how to use them. This file imports types only, so it is
 * safe in the server markup, in the light shell and in the lazy engine alike.
 */
import type { ReactNode } from "react";
import type { Object3D, WebGLRenderer } from "three";

import type { audio } from "@/lib/audio";
import type { PreloadItem } from "@/lib/preload";

import type { Stage } from "./stage";

/** The sixteen sections of the scroll story, in scroll order (design section 4). */
export const SECTION_IDS = [
  "hero",
  "aspirants",
  "rows",
  "strip",
  "bolt",
  "fall",
  "hand",
  "list",
  "selena",
  "voices",
  "music",
  "funny",
  "chase",
  "bend",
  "archive",
  "footer",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** The theme a section lays under the top bar and under its own text. */
type HomeTheme = "daybreak" | "storm";

/**
 * The ground behind a section: the daybreak paper, the storm night, or a plain colour (`#rrggbb`).
 * Two grounds cross-fade by opacity at a joint (`kernel/background.ts`).
 */
export type GroundName = HomeTheme | `#${string}`;

/** The size of the screen the home is drawn in. `h` is the large viewport (what `100lvh` is). */
export interface Viewport {
  readonly w: number;
  readonly h: number;
  /** The pixel ratio the canvas is drawn at (capped, see `pixelRatioFor`). */
  readonly dpr: number;
}

/** What one frame knows. Every section and every pass gets the same object for one frame. */
export interface FrameInfo {
  /** Seconds since the clock started. Frozen while the probe freezes the scene. */
  readonly time: number;
  /** Seconds since the last frame, at most `DT_MAX` (0 while frozen). */
  readonly dt: number;
  /** The scroll position in screens, smoothed for the scene (`kernel/scroll.ts`). */
  readonly S: number;
  /** The same position without the smoothing. Use it for what must answer at once (a button). */
  readonly raw: number;
  /** Screens per second, signed. */
  readonly velocity: number;
  readonly viewport: Viewport;
  readonly frame: number;
}

/**
 * Something the stage draws and a section drives: the drone, Silverbolt, the doll, a card. The
 * kernel sets `visible` to false on every actor before the sections run, so an actor that no
 * section sets is not shown. `object` is the root the stage draws; the kernel copies `visible` to
 * it once per frame, after the sections have run.
 */
export interface Actor {
  readonly name: string;
  visible: boolean;
  readonly object?: Object3D;
  /** Free what the actor holds on the GPU. Called when it is removed and when the engine goes. */
  dispose?(): void;
}

/** One thing drawn by the stage, in order. Autoclear is off and the depth is cleared between passes. */
export interface Pass {
  readonly name: string;
  /** Smaller draws first. */
  readonly order: number;
  /** False when nothing in the pass is visible: the stage then draws nothing for it. */
  active(): boolean;
  render(renderer: WebGLRenderer, frame: FrameInfo): void;
  /** The screen changed size (CSS pixels). */
  resize?(w: number, h: number): void;
  /** The GL context was rebuilt: re-make what lived on the GPU outside three's own tracking. */
  rebuild?(): void;
  dispose?(): void;
}

/** The pointer in the home's own terms. Read it in `update`, never keep a copy. */
export interface PointerState {
  /** Client pixels. */
  x: number;
  y: number;
  /** -1 (left, top) to 1 (right, bottom). */
  nx: number;
  ny: number;
  down: boolean;
  type: "mouse" | "touch" | "pen";
  /** A pointer is over the page (always false for touch between presses). */
  inside: boolean;
  /** Smoothed speed in pixels per second. */
  speed: number;
  /** The id of the 3D target under the pointer, or null (also null over a DOM control). */
  hit: string | null;
}

/**
 * A 3D thing the pointer can be over. The canvas takes no pointer events: the kernel asks every
 * registered target, in the frame, whether the pointer is on it, and the nearest wins. A DOM
 * control (a link, a button, `[data-home-hit="dom"]`) under the pointer always wins over any target.
 */
export interface HitTarget {
  readonly id: string;
  /** The depth of the hit (smaller is nearer), or null when the point misses. Must be cheap. */
  test(x: number, y: number): number | null;
  /** The word the site's cursor shows while this target is under the pointer. */
  cursor?: string;
  enter?(): void;
  leave?(): void;
  move?(x: number, y: number): void;
  press?(x: number, y: number): void;
  release?(x: number, y: number): void;
}

/** The site's cursor, asked for a label by a 3D target (DOM elements use `data-cursor`). */
export interface CursorApi {
  set(label: string | null): void;
}

export interface PointerApi {
  readonly state: PointerState;
  /** Register a 3D target. Returns the way to take it out. */
  add(target: HitTarget): () => void;
}

export interface ScrollApi {
  /** The position in screens without the smoothing. */
  raw(): number;
  /** The position in screens the scene is drawn at. */
  shown(): number;
  /** Move the page to a position in screens. */
  to(screens: number, options?: { immediate?: boolean }): void;
  /**
   * Hold the page still (wheel, touch and scroll keys do nothing) until the returned release is
   * called. It never stops the smooth scroller by itself and has a long safety limit.
   */
  hold(limitMs?: number): () => void;
}

/** Everything a section is given when it mounts. */
export interface SectionCtx {
  readonly id: SectionId;
  readonly stage: Stage;
  readonly actors: Actors;
  /** The section's own DOM: its slot in the `below` layer and its text (see `docs/design/home/kernel.md`). */
  readonly dom: {
    readonly root: HTMLElement;
    readonly below: HTMLElement;
    readonly text: HTMLElement;
  };
  viewport(): Viewport;
  readonly pointer: PointerApi;
  readonly cursor: CursorApi;
  readonly scroll: ScrollApi;
  readonly audio: typeof audio;
  /** Hold the loading screen and the page change until this section has drawn. Call the result when it has. */
  expectReady(id: string): () => void;
}

/** What a mounted section does. `update` is a pure function of `local` and the section's own state. */
export interface SectionRuntime {
  /** `local` runs 0 to 1 across the section, a little outside it in its lead and tail. */
  update(local: number, frame: FrameInfo): void;
  /** The section came into its range (play its videos, start its audio). */
  enter?(): void;
  /** The section left its range (pause its videos, stop its audio). */
  leave?(): void;
  dispose(): void;
}

/** What the server draws for a section: the `below` DOM (z 1) and the `text` DOM (z 3). */
export interface SectionMarkup {
  /** Frames, video windows, anything a 3D actor must pass in front of. Decorative, so `aria-hidden`. */
  below?: ReactNode;
  /** Titles, copy, buttons: real HTML, readable without scripts. */
  text: ReactNode;
}

/** The static description of a section. The registry (`kernel/sections.ts`) lists them in order. */
export interface HomeSection {
  readonly id: SectionId;
  /** Scroll length in screens (design section 4; an owner may move it by a quarter). */
  readonly screens: number;
  /** Screens before the start in which the section already runs (for joints). */
  readonly lead: number;
  /** Screens after the end in which the section still runs. */
  readonly tail: number;
  readonly bg: GroundName;
  readonly nav: { readonly theme: HomeTheme };
  /**
   * Where the text lives. "fixed": in the fixed text layer (every section but the last). "flow": in
   * the page itself, after the scroll room, so a visitor can scroll to it (the footer only).
   */
  readonly dom: "fixed" | "flow";
  /** Mount even when the section is far behind, so a jump past it can replay its end (rare). */
  readonly carry?: boolean;
  preload(): PreloadItem[];
  /** Called when the section is near. Loads the section's runtime chunk and builds its part of the scene. */
  mount(ctx: SectionCtx): Promise<SectionRuntime> | SectionRuntime;
}

/** The registry of actors: hide by default, one writer per frame wins. */
export interface Actors {
  register<T extends Actor>(actor: T): T;
  /** Take an actor out and dispose it (a section that goes). */
  remove(name: string): void;
  get(name: string): Actor | undefined;
  list(): readonly Actor[];
  /** Every actor to hidden. The kernel calls this before the sections run each frame. */
  hideAll(): void;
  /** Copy `visible` to each actor's `object`. The kernel calls this after the sections have run. */
  apply(): void;
}

/** Where the home is, for the shell, the footer and the probes. */
export type HomeMode = "pending" | "on" | "off";
