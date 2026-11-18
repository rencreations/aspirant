import type { PreloadItem } from "@/lib/preload";

/**
 * What the comic marks need to load: nothing. Every shape is drawn by the shader (no picture, no
 * model, no data file) and the code is part of the engine's chunk. The function exists so a
 * section's list can call it like every other actor's, and so a later asset has one place to go.
 */
export function marksItems(): PreloadItem[] {
  return [];
}
