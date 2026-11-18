import { chunkItem, type PreloadItem } from "@/lib/preload";

/**
 * What the aspirants section needs, as loading items (see `kernel/preload.ts`). Its scene code is
 * not at first paint, so it keeps downloading after the page has opened. The section's owner adds
 * the wall's pictures (waited for: the wall is the next thing the visitor sees).
 */
export function preload(): PreloadItem[] {
  return [
    {
      ...chunkItem("home-aspirants", "Hanging the wall", () => import("./runtime"), 1),
      deferred: true,
      priority: 10,
    },
  ];
}
