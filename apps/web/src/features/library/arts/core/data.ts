"use client";

import { fetchLibraryJson, libraryDataPath, useLibraryData, artsDataName } from "../../data";
import type { ArtsFile, ArtsItem } from "./types";
import type { ArtsRoom } from "./routes";

/**
 * The data file of one Arts room, with the head fields of its room (`facets`, `comics`, `kinds`,
 * `characters`, `pairs`) typed by `Head`. The loading list has already put the file in the
 * browser cache, so it arrives at once. The page tells the curtain to wait until it has drawn.
 */
export function useArtsData<T extends ArtsItem = ArtsItem, Head = unknown>(
  room: ArtsRoom,
): { data: (ArtsFile<T> & Head) | null; failed: boolean } {
  const { data, failed } = useLibraryData<T>(artsDataName(room));
  return { data: data as unknown as (ArtsFile<T> & Head) | null, failed };
}

/** Fetch the data file of one Arts room once per visit (for a loading list). */
export function fetchArtsData<T extends ArtsItem = ArtsItem, Head = unknown>(
  room: ArtsRoom,
): Promise<ArtsFile<T> & Head> {
  return fetchLibraryJson<ArtsFile<T> & Head>(libraryDataPath(artsDataName(room)));
}
