import { asset } from "@/lib/asset";
import { mediaUrl } from "@/lib/media-store";

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
