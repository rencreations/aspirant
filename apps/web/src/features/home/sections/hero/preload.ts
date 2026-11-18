import { chunkItem, type PreloadItem } from "@/lib/preload";

/**
 * What the hero needs, as loading items (see `kernel/preload.ts`). The first screen is waited for:
 * the section's own scene code. The section's owner adds its pictures, its logo data and the rest.
 */
export function preload(): PreloadItem[] {
  return [chunkItem("home-hero", "Hanging the art", () => import("./runtime"), 1)];
}
