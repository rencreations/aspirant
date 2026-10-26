import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";

/**
 * A muted picture may run by itself unless data saving is on. The light performance level does not
 * stop it: that level is often a remembered guess about a busy moment, and these pictures are short,
 * small and only one or two run at a time (they pause when they leave the screen).
 */
export function mayPlay(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  return nav.connection?.saveData !== true;
}

const guarded = new WeakSet<HTMLVideoElement>();

/**
 * Give a video its source: the copy the loading bar holds in memory, or the file. If the copy in
 * memory goes bad (its address was freed by another page), the video asks for the file instead of
 * staying black.
 */
export function giveSource(video: HTMLVideoElement, file: string): void {
  video.src = mediaUrl(file);
  if (guarded.has(video)) return;
  guarded.add(video);
  video.addEventListener("error", () => {
    if (!video.src.startsWith("blob:")) return;
    const wasPlaying = !video.paused;
    video.src = asset(file);
    video.load();
    if (wasPlaying) void video.play().catch(() => undefined);
  });
}
