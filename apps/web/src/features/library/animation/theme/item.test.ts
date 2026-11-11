import fs from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const loadMedia = vi.fn((_url: string, _options?: unknown) => Promise.resolve("blob:x"));

vi.mock("@/lib/media-store", () => ({
  loadMedia: (url: string, options?: unknown) => loadMedia(url, options),
  releaseMedia: vi.fn(),
}));

vi.mock("../../data", () => ({
  libraryDataPath: (name: string) => `/data/library/${name}.json`,
  fetchLibraryJson: () =>
    Promise.resolve({
      items: [
        { id: "music-angela-ruby", title: "Angela & Ruby Music", src: "music/angela-ruby.m4a" },
        { id: "music-we-believe", title: "We Believe!", src: "music/we-believe.m4a" },
      ],
    }),
}));

const { THEME_TRACK, themeItem } = await import("../theme-music");
const { libUrl } = await import("@/lib/library");

describe("themeItem", () => {
  beforeEach(() => {
    loadMedia.mockClear();
  });

  it("is one entry per song, so the two characters of a pair share it", () => {
    expect(themeItem("ruby", false).id).toBe(themeItem("angela", 30).id);
    expect(themeItem("ruby", false).id).not.toBe(themeItem("layla", false).id);
  });

  it("is waited for, or deferred with a priority", () => {
    expect(themeItem("ruby", false).deferred).toBeUndefined();
    expect(themeItem("layla", 25)).toMatchObject({ deferred: true, priority: 25 });
  });

  it("loads the song's own file from music.json, whole, in the background when asked", async () => {
    const report = vi.fn();
    await themeItem("angela", 25).run(report, { background: true });
    expect(loadMedia).toHaveBeenCalledTimes(1);
    const [address, options] = loadMedia.mock.calls[0] ?? [];
    expect(address).toBe(libUrl("music/angela-ruby.m4a"));
    expect(options).toMatchObject({ type: "audio/mp4", background: true, onFraction: report });
  });

  it("has nothing to load, and no error, for a song music.json does not hold", async () => {
    await expect(themeItem("selena", false).run(vi.fn(), { background: false })).resolves.toBe(
      undefined,
    );
    expect(loadMedia).not.toHaveBeenCalled();
  });
});

describe("THEME_TRACK", () => {
  it("names a song of music.json for each of the ten, one song to a pair", () => {
    const file = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "public/data/library/music.json"), "utf8"),
    ) as { items: Array<{ id: string }> };
    const ids = new Set(file.items.map((t) => t.id));
    expect(Object.keys(THEME_TRACK)).toHaveLength(10);
    for (const id of Object.values(THEME_TRACK)) expect(ids.has(id)).toBe(true);
    for (const [a, b] of [
      ["lesley", "change"],
      ["ruby", "angela"],
      ["layla", "fanny"],
    ] as const) {
      expect(THEME_TRACK[a]).toBe(THEME_TRACK[b]);
    }
  });
});
