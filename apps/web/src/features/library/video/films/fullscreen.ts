import { fullscreenWay, type FullscreenWay } from "./film-math";

/**
 * Full screen for the Films room. The room itself (the picture and its own controls) goes full
 * screen with the Fullscreen API, and the screen turns to landscape where the browser lets a page
 * ask for that (a phone; a desktop browser refuses and nothing happens). A browser that cannot put
 * an element full screen (Safari on an iPhone) plays the film in its own full screen player.
 * Safari before 16.4 has only the prefixed calls: both are tried.
 */

type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FsElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FsVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

/** How this browser can put the room full screen. */
export function readFullscreenWay(root: HTMLElement): FullscreenWay {
  const doc = document as FsDocument;
  const el = root as FsElement;
  const video = HTMLVideoElement.prototype as FsVideo;
  return fullscreenWay({
    enabled: Boolean(document.fullscreenEnabled ?? doc.webkitFullscreenEnabled),
    element:
      typeof el.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function",
    video: typeof video.webkitEnterFullscreen === "function",
  });
}

/** The element that is full screen now, if any. */
export function fullscreenElement(): Element | null {
  return document.fullscreenElement ?? (document as FsDocument).webkitFullscreenElement ?? null;
}

/** Is the film playing in the browser's own full screen player (an iPhone). */
export function videoFullscreen(video: HTMLVideoElement | null): boolean {
  return (
    !!video && "webkitDisplayingFullscreen" in video && video.webkitDisplayingFullscreen === true
  );
}

function lockLandscape(): void {
  const orientation = typeof screen === "undefined" ? undefined : screen.orientation;
  try {
    // Refused on a desktop and wherever the page is not full screen: that is fine.
    void orientation?.lock?.("landscape").catch(() => undefined);
  } catch {
    // An old browser throws instead of refusing.
  }
}

/** Let the screen turn freely again. */
export function unlockOrientation(): void {
  const orientation = typeof screen === "undefined" ? undefined : screen.orientation;
  try {
    orientation?.unlock?.();
  } catch {
    // Nothing was locked.
  }
}

/** Put the room full screen (called inside the press, as browsers ask). */
export async function enterFullscreen(
  root: HTMLElement,
  video: HTMLVideoElement | null,
  way: FullscreenWay,
): Promise<void> {
  if (way === "element") {
    const el = root as FsElement;
    try {
      if (typeof el.requestFullscreen === "function") {
        await el.requestFullscreen({ navigationUI: "hide" });
      } else {
        await el.webkitRequestFullscreen?.();
      }
    } catch {
      return;
    }
    lockLandscape();
    return;
  }
  if (way === "video" && video) {
    try {
      (video as FsVideo).webkitEnterFullscreen?.();
    } catch {
      // The film has no picture yet: the button stays as it was.
    }
  }
}

/** Leave full screen, whichever way it was entered. */
export async function exitFullscreen(video: HTMLVideoElement | null): Promise<void> {
  if (videoFullscreen(video)) {
    try {
      (video as FsVideo).webkitExitFullscreen?.();
    } catch {
      // Already left.
    }
    return;
  }
  if (!fullscreenElement()) return;
  const doc = document as FsDocument;
  try {
    if (typeof document.exitFullscreen === "function") await document.exitFullscreen();
    else await doc.webkitExitFullscreen?.();
  } catch {
    // Already left.
  }
}

/** Hear when the page enters or leaves full screen (also by Esc or the browser's own control). */
export function onFullscreenChange(fn: () => void): () => void {
  document.addEventListener("fullscreenchange", fn);
  document.addEventListener("webkitfullscreenchange", fn);
  return () => {
    document.removeEventListener("fullscreenchange", fn);
    document.removeEventListener("webkitfullscreenchange", fn);
  };
}
