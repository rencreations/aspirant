import type { ReactNode } from "react";

import type { LibImage } from "../../../types";
import type { FrameRect } from "../types";
import type { Rect, ZoomMode } from "./zoom-math";

/** One picture the viewer can open. `img` is the whole picture, never cropped. */
export interface ZoomPicture {
  id: string;
  img: LibImage;
  /** One plain sentence about what is seen. It names the dialog. */
  alt: string;
  title?: string;
  /** `fit` (default) shows the whole picture. `scroll` is for a tall strip: fit the width, read it by scrolling. */
  mode?: ZoomMode;
  /** The window of the picture that the tile shows (fractions). Absent when the tile shows all of it. */
  frame?: FrameRect;
  /** Small text beside the picture in the viewer, for example a credit line. */
  caption?: ReactNode;
}

export interface ZoomOpenOptions {
  /** Open without a morph, from the middle of the screen (a deep link does). */
  instant?: boolean;
  /**
   * The window of the picture that the tile shows right now, when it differs from the picture's
   * own `frame` (a tile whose picture drifts inside its frame, for example).
   */
  frame?: FrameRect;
}

export interface ZoomActions {
  /** Open picture `id` from the element that shows it (its place and crop are read now). */
  open: (id: string, source: HTMLElement | null, options?: ZoomOpenOptions) => void;
  /** Close the viewer into the tile that shows the open picture. Does nothing when it is closed. */
  close: () => void;
}

export interface ZoomState {
  /** The open picture, or null (also while it is closing). */
  openId: string | null;
  /** The viewer is mounted and can open. */
  ready: boolean;
}

export type ZoomApi = ZoomActions & ZoomState;

/** The tone of the room behind the viewer. Absent: a deep neutral. */
export type ZoomTone = "dark" | "light";

/** What the viewer is showing. A new `seq` is a new picture. */
export interface ZoomView {
  seq: number;
  picture: ZoomPicture;
  index: number;
  total: number;
  /** `morph` grows from the tile, `fade` from the middle of the screen, `step` swaps with a neighbour. */
  entry: "morph" | "fade" | "step";
  /** The tile (to hide while open, to land on at close). */
  source: HTMLElement | null;
  /** Where the tile was when the picture opened. */
  rect: Rect | null;
  /** The frame to start from, overriding the picture's own. */
  frame?: FrameRect | undefined;
}

export type ZoomPhase = "opening" | "open" | "closing" | "closed";

export interface RunHandle {
  /** Start closing. False when a press is ignored (a double press, or it is closing already). `force` skips the double press rule. */
  close: (force?: boolean) => boolean;
  /** The viewer is dragged down by a finger: follow it. */
  drag: (dy: number) => void;
  /** The finger let go: close from where the viewer is, or come back. */
  release: (dy: number, dismiss: boolean) => void;
  /** The element that scrolls a tall strip, or null when the picture is fitted. */
  scroller: () => HTMLElement | null;
  /** A strip is at its top (or the picture is fitted). */
  atTop: () => boolean;
}

export type ViewerHandle = Pick<RunHandle, "close">;

declare global {
  interface Window {
    /** The probe for frame sheets: set `freeze` before a move to hold it at its first frame. */
    __artsZoom?: {
      freeze: boolean;
      phase: ZoomPhase | "held" | "idle";
      duration: number;
      seek: (ms: number) => void;
      release: () => void;
    };
  }
}
