/**
 * The theme music of the Animation room, as pure decisions: which song a character has, what to do
 * when the character on show changes, and how long each fade takes. `player.ts` carries them out
 * through the site's audio engine (`lib/audio`), whose fades follow a smooth S curve, so a cross
 * fade is the old song easing out while the new one eases in, over the same time.
 */

/** How long the fades take, and how long the ring must rest on a new song before it plays. */
export const THEME_FADE = {
  /** The first song, from silence. */
  in: 1800,
  /** One song into another. */
  cross: 1600,
  /** Out of the room: the song fades away and its element is released. */
  out: 1200,
  /**
   * A new song waits this long after the character changes, so a quick turn of the ring past
   * three characters plays only the one it stops on. A song that goes on is never held.
   */
  settle: 450,
} as const;

/** How loud the theme sits (0 to 1): under the site's blips, like the music of a page. */
export const THEME_VOLUME = 0.32;

export type ThemeMove =
  /** The same song goes on (the next character shares it, or nothing changed). */
  | { kind: "keep" }
  /** A song starts from silence. */
  | { kind: "start"; fadeMs: number; delayMs: number }
  /** The song changes: the new one fades in while the old one fades out. */
  | { kind: "cross"; fadeMs: number; delayMs: number }
  /** No song is wanted any more. */
  | { kind: "stop"; fadeMs: number; delayMs: number };

/**
 * What to do when the song on show changes from `current` to `wanted` (track ids, null for none).
 * `leaving` is true when the visitor leaves the room: the song goes at once, with no wait.
 */
export function themeMove(
  current: string | null,
  wanted: string | null,
  leaving = false,
): ThemeMove {
  if (current === wanted) return { kind: "keep" };
  if (wanted === null)
    return { kind: "stop", fadeMs: THEME_FADE.out, delayMs: leaving ? 0 : THEME_FADE.settle };
  if (current === null) return { kind: "start", fadeMs: THEME_FADE.in, delayMs: 0 };
  return { kind: "cross", fadeMs: THEME_FADE.cross, delayMs: THEME_FADE.settle };
}

/** The part of `music.json` a theme reads. */
export interface ThemeTrackData {
  id: string;
  title: string;
  src: string;
  disc?: string;
  credits?: ReadonlyArray<{ role: string; name: string }>;
}

/** What the record in the top bar shows for a song: its title, who made the music, its disc. */
export function themeLabel(track: ThemeTrackData): { title: string; artist: string } {
  const credits = track.credits ?? [];
  const music = credits.find((c) => /music/iu.test(c.role)) ?? credits[0];
  return { title: track.title, artist: music?.name ?? "The Aspirants" };
}

/** The characters whose songs are worth warming: the ones beside `index` on a ring of `count`. */
export function neighbours(index: number, count: number): number[] {
  if (count < 2) return [];
  const next = (index + 1) % count;
  const before = (index - 1 + count) % count;
  return next === before ? [next] : [next, before];
}
