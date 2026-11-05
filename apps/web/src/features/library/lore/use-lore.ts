"use client";

import { useLibraryData } from "../data";
import type { LoreFile } from "./types";

/**
 * The lore data file. `lore.json` is a collection file (`v`, `slug`, `items`) that also carries
 * the texts, the atlas and the people, so the shared hook is typed one step wider here.
 */
export function useLore(): { lore: LoreFile | null; failed: boolean } {
  const { data, failed } = useLibraryData("lore");
  return { lore: data as LoreFile | null, failed };
}
