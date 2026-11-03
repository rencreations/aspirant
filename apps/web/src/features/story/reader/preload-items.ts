import { chapterBySlug } from "@/content/story";
import type { FirstFile } from "@/content/story-types";
import { imageItem, mediaItem, type PreloadItem } from "@/lib/preload";

/** The files of one picture: a still, or a clip with its still. */
function itemsOf(
  file: FirstFile,
  label: string,
  deferred: boolean,
  priority: number,
): PreloadItem[] {
  const items: PreloadItem[] =
    file.kind === "clip" && file.poster
      ? [
          imageItem(`/${file.poster}`, label, 1),
          mediaItem(`/${file.src}`, label, {
            type: "video/mp4",
            ...(file.bytes ? { bytes: file.bytes } : {}),
          }),
        ]
      : [imageItem(`/${file.src}`, label, 1)];
  return deferred ? items.map((i) => ({ ...i, deferred: true, priority })) : items;
}

/**
 * What a chapter page needs before it opens: its title card (the picture, or the loop and its
 * still, held whole in memory). The first pictures set into the text come next in the background.
 * Everything else is lazy in the page itself.
 */
export function chapterItems(slug: string): PreloadItem[] {
  const entry = chapterBySlug(slug);
  if (!entry) return [];
  return entry.first.flatMap((file, i) =>
    i === 0
      ? itemsOf(file, "Loading the chapter", false, 0)
      : itemsOf(file, "Loading the pictures", true, 12 - i),
  );
}
