"use client";

import { useEffect, useState } from "react";

import { expectReady } from "@/lib/page-ready";
import type { CharacterSlug } from "@/lib/slugs";

import { fetchLibraryJson, libraryDataPath } from "../data";
import type { VoiceCharacterFile, VoiceIndex } from "./types";

interface Loaded<T> {
  data: T | null;
  failed: boolean;
}

/**
 * Reads one data file of the room. The loading list has already put it in the browser's cache, so
 * it arrives at once. The page tells the curtain to wait until it has drawn.
 */
function useVoiceFile<T>(name: Parameters<typeof libraryDataPath>[0]): Loaded<T> {
  const [state, setState] = useState<Loaded<T>>({ data: null, failed: false });
  useEffect(() => {
    let live = true;
    const mark = expectReady(`library-${name}`);
    fetchLibraryJson<T>(libraryDataPath(name)).then(
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
  }, [name]);
  return state;
}

/** The index: languages, the ten Aspirants, the film behind the title. */
export function useVoiceIndex(): Loaded<VoiceIndex> {
  return useVoiceFile<VoiceIndex>("voicelines");
}

/** Every line of one Aspirant, in every language. */
export function useCharacterFile(slug: CharacterSlug): Loaded<VoiceCharacterFile> {
  return useVoiceFile<VoiceCharacterFile>(`voicelines-${slug}`);
}
