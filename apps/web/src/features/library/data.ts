"use client";

import { useEffect, useState } from "react";

import { asset } from "@/lib/asset";
import { expectReady } from "@/lib/page-ready";
import { dataItem, type PreloadItem } from "@/lib/preload";

import { ARTS_ROOMS, ROOM_LABELS, type ArtsRoom } from "./arts/core/routes";
import { getCollection } from "./registry";
import type { CollectionFile, CollectionSlug, ItemBase } from "./types";

/** The data file of one Arts room: `arts-splash`, `arts-scene`, `arts-fanart` ... */
export type ArtsDataName = `arts-${ArtsRoom}`;

/**
 * The data files of the library. One per collection, except Video, which has two (one per room):
 * `video-films` (the ten official films) and `video-others` (every other video), and Arts, which
 * has one per room (`arts-splash`, `arts-scene`, `arts-comic`, `arts-game`, `arts-design`,
 * `arts-others`, `arts-fanart`, `arts-cosplay`).
 */
export type LibraryDataName =
  Exclude<CollectionSlug, "video" | "arts"> | "video-films" | "video-others" | ArtsDataName;

/** The data file name of one Arts room. */
export function artsDataName(room: ArtsRoom): ArtsDataName {
  return `arts-${room}`;
}

function isArtsDataName(name: string): name is ArtsDataName {
  return ARTS_ROOMS.some((room) => name === `arts-${room}`);
}

/** The path in `public/` of one data file (go through `asset()` to fetch it). */
export function libraryDataPath(name: LibraryDataName | "search"): string {
  return `/data/library/${name}.json`;
}

/** The loading list entry for a data file. */
export function libraryDataItem(name: LibraryDataName, label?: string): PreloadItem {
  const what = isArtsDataName(name)
    ? ROOM_LABELS[name.slice("arts-".length) as ArtsRoom].toLowerCase()
    : name === "video-films"
      ? "films"
      : name === "video-others"
        ? "videos"
        : getCollection(name).name.toLowerCase();
  return dataItem(libraryDataPath(name), label ?? `Reading ${what}`, 2);
}

const cache = new Map<string, Promise<unknown>>();

/** Fetch a data file once per visit. */
export function fetchLibraryJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(asset(path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
}

/**
 * A collection's data file. The loading list has already put it in the browser cache, so it
 * arrives at once. The page tells the curtain to wait until the data has drawn.
 */
export function useLibraryData<T extends ItemBase = ItemBase>(
  slug: LibraryDataName,
): { data: CollectionFile<T> | null; failed: boolean } {
  const [state, setState] = useState<{ data: CollectionFile<T> | null; failed: boolean }>({
    data: null,
    failed: false,
  });

  useEffect(() => {
    let live = true;
    const mark = expectReady(`library-${slug}`);
    fetchLibraryJson<CollectionFile<T>>(libraryDataPath(slug)).then(
      (data) => {
        if (live) setState({ data, failed: false });
        // One frame later, so the curtain opens on a drawn page.
        requestAnimationFrame(() => {
          requestAnimationFrame(mark);
        });
      },
      () => {
        if (live) setState({ data: null, failed: true });
        mark();
      },
    );
    return () => {
      live = false;
      mark();
    };
  }, [slug]);

  return state;
}
