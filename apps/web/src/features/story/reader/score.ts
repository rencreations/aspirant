"use client";

/**
 * The music under a chapter, through the site's own music player (`lib/now-playing.ts`): it shows
 * in the record in the nav, the sound button mutes it, voice lines duck it, and a browser that
 * blocks the start gets it on the first touch or key. One track runs across neighbouring chapters
 * (a chapter that names the track already playing leaves it alone) and crossfades when the next
 * chapter names another. A chapter with no score lets the music fade out. When the reader is left
 * for a page that is not the story, the music fades out after a short grace (a chapter that opens
 * next cancels it).
 */
import { startMusic, type Track } from "@/lib/now-playing";

const GRACE_MS = 500;

const SCORES: Readonly<Record<string, Track>> = {
  "we-believe": {
    title: "We Believe",
    artist: "The Aspirants series theme",
    cover: "/img/pair/fanny-layla/fanny-and-layla.webp",
    src: "/audio/music/we-believe.m4a",
  },
  "guinevere-theme": {
    title: "CROSSxCREDO: Guinevere Version",
    artist: "Eye",
    cover: "/img/char/guinevere/splash-sm.webp",
    src: "/audio/music/guinevere-theme.m4a",
  },
  "vexana-theme": {
    title: "CROSSxCREDO: Vexana Version",
    artist: "WaMi",
    cover: "/img/char/vexana/splash-sm.webp",
    src: "/audio/music/vexana-theme.m4a",
  },
  "silverbolt-raiko": {
    title: "Silverbolt Raiko",
    artist: "Mobile Legends: Bang Bang",
    cover: "/img/char/selena/splash-sm.webp",
    src: "/audio/music/silverbolt-raiko.m4a",
  },
  "obsidia-theme": {
    title: "Obsidia theme",
    artist: "The Aspirants",
    cover: "/img/char/obsidia/splash-sm.webp",
    src: "/audio/music/obsidia-theme.m4a",
  },
  "obsidia-aspirant": {
    title: "Obsidia theme, Aspirants version",
    artist: "The Aspirants",
    cover: "/img/char/obsidia/splash-sm.webp",
    src: "/audio/music/obsidia-aspirant.m4a",
  },
  "obsidia-solo": {
    title: "Obsidia theme, solo version",
    artist: "The Aspirants",
    cover: "/img/char/obsidia/splash-sm.webp",
    src: "/audio/music/obsidia-solo.m4a",
  },
};

let current: { id: string; stop: () => void } | null = null;
let releaseTimer = 0;

export function startScore(id: string | null): void {
  window.clearTimeout(releaseTimer);
  if (!id) {
    current?.stop();
    current = null;
    return;
  }
  if (current?.id === id) return;
  const track = SCORES[id];
  if (!track) return;
  current = { id, stop: startMusic(track) };
}

export function releaseScore(): void {
  window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    current?.stop();
    current = null;
  }, GRACE_MS);
}
