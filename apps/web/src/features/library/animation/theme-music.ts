"use client";

import { useEffect } from "react";

import { loadMedia } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";
import type { CharacterSlug } from "@/lib/slugs";

import { ORDER } from "./characters";
import { neighbours } from "./theme/plan";
import { themePlayer, themeSong, type ThemeSnapshot } from "./theme/player";

/**
 * The song that plays for each character, as an id of `public/data/library/music.json`. The pairs
 * share one song. The file of each song is read from `music.json` by its id, never written here.
 */
export const THEME_TRACK: Readonly<Record<CharacterSlug, string>> = {
  selena: "music-gray-new-world",
  obsidia: "music-lullaby-of-oblivion",
  guinevere: "music-cross-credo-guinevere",
  vexana: "music-cross-credo-vexana",
  change: "music-change-lesley-display",
  lesley: "music-change-lesley-display",
  ruby: "music-angela-ruby",
  angela: "music-angela-ruby",
  layla: "music-we-believe",
  fanny: "music-we-believe",
};

declare global {
  interface Window {
    /** Specs and probes: the state of the room's song. */
    __themeMusic?: { snapshot: () => ThemeSnapshot; element: () => HTMLAudioElement | null };
  }
}

/**
 * Plays the theme of the character in front, on the carousel and on a character's page. `slug` is
 * the character on show, or null when none is. A song goes on across two characters that share it,
 * a different song cross fades in once the ring has come to rest on it, and the song fades away
 * when the room is left. The songs of the characters beside the one on show warm in the background.
 * Call it once, in the room's shell.
 */
export function useThemeMusic(slug: CharacterSlug | null): void {
  useEffect(() => {
    themePlayer.want(slug ? THEME_TRACK[slug] : null);
    if (!slug) return;
    const at = ORDER.indexOf(slug);
    themePlayer.warm(neighbours(at, ORDER.length).map((i) => THEME_TRACK[ORDER[i] ?? slug]));
  }, [slug]);

  useEffect(() => {
    window.__themeMusic = {
      snapshot: () => themePlayer.snapshot(),
      element: () => themePlayer.element(),
    };
    return () => {
      themePlayer.leave();
      delete window.__themeMusic;
    };
  }, []);
}

/**
 * The loading list's entry for a character's song: the whole file into memory (the bar moves with
 * the bytes), saved in the browser for the next visit. Waited for the character the room opens on
 * (`deferred` false), deferred for the ones beside her (`deferred` is the priority). A character
 * whose song is not in `music.json` has nothing to load.
 */
export function themeItem(slug: CharacterSlug, deferred: false | number): PreloadItem {
  const id = THEME_TRACK[slug];
  return {
    // By song, so the two characters of a pair share one entry.
    id: `animation:theme:${id}`,
    label: "Loading the music",
    weight: 3,
    memo: false,
    ...(deferred === false ? {} : { deferred: true, priority: deferred }),
    run: async (report, context) => {
      const song = await themeSong(id);
      if (!song) return;
      await loadMedia(song.url, {
        type: "audio/mp4",
        onFraction: report,
        background: context.background,
      });
    },
  };
}
