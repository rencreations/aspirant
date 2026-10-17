import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import manifestJson from "../../../public/data/manifest.json";

import { buildCatalog, loadCatalog, toClientCatalog, type ManifestFile } from "./catalog";
import { formatDuration, formatRuntime } from "./format";
import { FILM_TITLES } from "./titles";
import type { CollectionItem } from "./types";

const PUBLIC = path.resolve(import.meta.dirname, "../../../public");
const catalog = loadCatalog();
const manifest = manifestJson as unknown as ManifestFile;

const all = (): CollectionItem[] => [
  ...catalog.films,
  ...catalog.music,
  ...catalog.comics,
  ...catalog.art,
  ...catalog.fanart,
  ...catalog.models,
  ...catalog.voice,
];

/** Every public file a collection item refers to. */
function filesOf(item: CollectionItem): string[] {
  switch (item.kind) {
    case "film":
      return [item.src, item.poster, ...(item.captions ? [item.captions] : [])];
    case "track":
      return [item.src, item.cover.src];
    case "comic":
      return item.pages.map((p) => p.file);
    case "art":
    case "fanart":
      return [item.src, item.thumb];
    case "model":
      return [item.src, item.poster.src, ...item.emotes];
    case "voice":
      return [item.file];
  }
}

describe("collection catalog", () => {
  it("resolves every file it refers to", () => {
    const missing: string[] = [];
    for (const item of all()) {
      for (const file of filesOf(item)) {
        if (!existsSync(path.join(PUBLIC, file))) missing.push(`${item.id}: ${file}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("gives every item a title and alt text", () => {
    for (const item of all()) {
      expect(item.title.trim(), item.id).not.toBe("");
      expect(item.alt.trim(), item.id).not.toBe("");
    }
  });

  it("lists every manifest video, music track and voice line", () => {
    const videos = manifest.assets.filter((a) => a.kind === "video");
    expect(catalog.films.map((f) => f.src).sort()).toEqual(videos.map((v) => v.path).sort());
    const music = manifest.assets.filter((a) => a.kind === "audio" && a.role === "music");
    expect(catalog.music.map((t) => t.src).sort()).toEqual(music.map((m) => m.path).sort());
    const voice = manifest.assets.filter((a) => a.role === "voice-line");
    expect(catalog.voice.map((v) => v.file).sort()).toEqual(voice.map((v) => v.path).sort());
    expect(catalog.voice).toHaveLength(380);
  });

  it("has a title for every video, and only for videos that exist", () => {
    const keys = manifest.assets
      .filter((a) => a.kind === "video")
      .map((a) => `${a.pair}/${a.role}`)
      .sort();
    expect(Object.keys(FILM_TITLES).sort()).toEqual(keys);
  });

  it("tags every item with a known pair and characters", () => {
    for (const item of all()) {
      expect(item.pair, item.id).not.toBeNull();
      expect(item.characters.length, item.id).toBeGreaterThan(0);
    }
  });

  it("marks tall videos as vertical from their size", () => {
    const vertical = catalog.films.filter((f) => f.vertical).map((f) => f.src);
    expect(vertical).toContain("video/ruby-angela/rerun.mp4");
    expect(vertical).toContain("video/selena-obsidia/selena-short-showcase.mp4");
    expect(vertical).not.toContain("video/fanny-layla/trailer.mp4");
    for (const film of catalog.films) expect(film.vertical).toBe(film.height > film.width);
  });

  it("attaches captions only where a .vtt exists", () => {
    const withCaptions = catalog.films.filter((f) => f.captions).map((f) => f.src);
    expect(withCaptions.sort()).toEqual([
      "video/fanny-layla/short-animation.mp4",
      "video/fanny-layla/trailer.mp4",
      "video/lesley-change/trailer.mp4",
      "video/selena-obsidia/trailer.mp4",
    ]);
  });

  it("always credits fan art and links only trusted sources", () => {
    expect(catalog.fanart).toHaveLength(29);
    for (const piece of catalog.fanart) {
      expect(piece.credit.length, piece.id).toBeGreaterThan(3);
      if (piece.url) expect(piece.url).toMatch(/^https:\/\//);
    }
    const unknown = catalog.fanart.find((p) => p.id === "fanart-both-xiaodanjoe-1");
    expect(unknown?.url).toBeNull();
    const pixiv = catalog.fanart.find((p) => p.id === "fanart-fanny-pixiv-1");
    expect(pixiv?.credit).toBe("Unknown artist, via Pixiv");
  });

  it("describes the comics, with the missing pages kept", () => {
    const [aspirant, gv] = catalog.comics;
    expect(aspirant?.pageCount).toBe(42);
    expect(aspirant?.pages).toHaveLength(42);
    expect(gv?.pageCount).toBe(43);
    expect(gv?.missingPages).toEqual([3, 23, 40]);
    expect(gv?.pages.map((p) => p.page)).not.toContain(3);
  });

  it("counts what it lists and adds the runtime", () => {
    const { counts, totalSeconds, filmSeconds, musicSeconds, voiceSeconds } = catalog.stats;
    expect(counts.films).toBe(31);
    expect(counts.music).toBe(3);
    expect(counts.comics).toBe(2);
    expect(counts.models).toBe(2);
    expect(counts.voice).toBe(380);
    expect(counts.art).toBe(catalog.art.length);
    expect(totalSeconds).toBeCloseTo(filmSeconds + musicSeconds + voiceSeconds, 5);
    expect(filmSeconds).toBeGreaterThan(3600);
  });

  it("keeps shipped text free of dashes and banned words", () => {
    const text = JSON.stringify(all());
    expect(text).not.toMatch(/[–—]/);
    expect(text).not.toMatch(/conviction|Terenia|Terinia|Terrenia|Seiresk|Windstorm Nest/);
  });

  it("slims the client catalog to durations for voice", () => {
    const client = toClientCatalog(catalog);
    expect("voice" in client).toBe(false);
    expect(client.voiceDurations.layla).toHaveLength(28);
    expect(client.voiceDurations.selena).toHaveLength(46);
  });

  it("fails loudly on a video without a title", () => {
    const broken = {
      manifest: {
        assets: [
          ...manifest.assets,
          {
            id: "video-x",
            kind: "video",
            path: "video/fanny-layla/unknown.mp4",
            bytes: 1,
            pair: "fanny-layla",
            role: "unknown",
          },
        ],
      },
      fanart: { items: [] },
      comics: { comics: {} },
    };
    expect(() => buildCatalog(broken)).toThrow(/No title/);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(308.48)).toBe("5:08");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(0)).toBe("0:00");
  });
  it("formats a runtime", () => {
    expect(formatRuntime(27720)).toBe("7 h 42 min");
    expect(formatRuntime(1500)).toBe("25 min");
  });
});
