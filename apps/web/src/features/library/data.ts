"use client";

import { useEffect, useState } from "react";

import { asset } from "@/lib/asset";
import { expectReady } from "@/lib/page-ready";
import { dataItem, type PreloadItem } from "@/lib/preload";

import { getCollection } from "./registry";
import type { CollectionFile, CollectionSlug, ItemBase } from "./types";

/** The path in `public/` of one collection's data file (go through `asset()` to fetch it). */
export function libraryDataPath(slug: CollectionSlug | "search"): string {
  return `/data/library/${slug}.json`;
}

/** The loading list entry for a collection's data file. */
export function libraryDataItem(slug: CollectionSlug): PreloadItem {
  return dataItem(libraryDataPath(slug), `Reading ${getCollection(slug).name.toLowerCase()}`, 2);
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
  slug: CollectionSlug,
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
