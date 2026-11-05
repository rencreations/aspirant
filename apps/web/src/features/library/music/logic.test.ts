import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  append,
  clock,
  creditSummary,
  downloadName,
  filterTracks,
  insertNext,
  stepIn,
  totalLength,
} from "./logic";
import type { MusicFile, MusicItem } from "./types";

function load(): MusicFile {
  const file = path.resolve(__dirname, "../../../../public/data/library/music.json");
  return JSON.parse(fs.readFileSync(file, "utf8")) as MusicFile;
}

function track(id: string, over: Partial<MusicItem> = {}): MusicItem {
  return {
    id,
    title: id,
    collection: "music",
    chars: [],
    pair: null,
    canon: "official",
    tags: [],
    kind: "song",
    ep: null,
    credits: [],
    released: null,
    src: `music/${id}.m4a`,
    dur: 100,
    cover: { site: "img/char/layla/splash-sm.webp" },
    films: [],
    about: "",
    quality: "",
    ...over,
  };
}

describe("queue helpers", () => {
  const a = track("a");
  const b = track("b");
  const c = track("c");

  it("steps forward and back, and stops at the ends", () => {
    expect(stepIn([a, b, c], "a", 1)?.id).toBe("b");
    expect(stepIn([a, b, c], "b", -1)?.id).toBe("a");
    expect(stepIn([a, b, c], "c", 1)).toBeNull();
    expect(stepIn([a, b, c], "a", -1)).toBeNull();
    expect(stepIn([a, b, c], "zzz", 1)).toBeNull();
  });

  it("puts a track right after the current one, once", () => {
    expect(insertNext([a, b, c], c, "a").map((t) => t.id)).toEqual(["a", "c", "b"]);
    expect(insertNext([a, b], c, null).map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(insertNext([a, b, c], b, "a").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("appends a track unless it is queued", () => {
    expect(append([a], b).map((t) => t.id)).toEqual(["a", "b"]);
    expect(append([a, b], a).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("filter and labels", () => {
  const items = [
    track("we-believe", {
      title: "We Believe",
      chars: ["fanny", "layla"],
      credits: [{ role: "Music", name: "Yasuharu Takanashi" }],
    }),
    track("lullaby", { title: "Lullaby of Oblivion", kind: "song", chars: ["selena", "obsidia"] }),
    track("piece", { title: "Obsidia: Solo", kind: "piece", chars: ["obsidia"] }),
  ];

  it("filters by kind, by word and by character", () => {
    expect(filterTracks(items, { q: "", kind: "piece", who: "" }).map((t) => t.id)).toEqual([
      "piece",
    ]);
    expect(filterTracks(items, { q: "takanashi", kind: "", who: "" }).map((t) => t.id)).toEqual([
      "we-believe",
    ]);
    expect(filterTracks(items, { q: "", kind: "", who: "obsidia" })).toHaveLength(2);
    expect(filterTracks(items, { q: "lullaby oblivion", kind: "", who: "" })).toHaveLength(1);
    expect(filterTracks(items, { q: "nothing", kind: "", who: "" })).toHaveLength(0);
  });

  it("writes the credit line, the clock and the download name", () => {
    expect(creditSummary(items[0]!)).toBe("Music: Yasuharu Takanashi");
    expect(creditSummary(items[2]!)).toBe("Credit not named in the sources");
    expect(
      creditSummary(
        track("x", {
          credits: [
            { role: "Music", name: "A" },
            { role: "Vocals", name: "B" },
          ],
        }),
      ),
    ).toBe("Vocals: B");
    expect(clock(855.5)).toBe("14:16");
    expect(totalLength(1996)).toBe("33 min");
    expect(downloadName(track("x", { title: "CROSS×CREDO: Vexana Version" }))).toBe(
      "CROSS×CREDO Vexana Version.m4a",
    );
    expect(
      downloadName(track("y", { title: "Obsidia: Solo", orig: "music/original/obsidia-solo.mp3" })),
    ).toBe("Obsidia Solo.mp3");
  });
});

describe("music.json", () => {
  const data = load();

  it("lists the tracks with real durations and unique ids", () => {
    expect(data.items.length).toBe(data.totals.tracks);
    expect(new Set(data.items.map((i) => i.id)).size).toBe(data.items.length);
    for (const i of data.items) {
      expect(i.dur, i.id).toBeGreaterThan(30);
      expect(i.src, i.id).toMatch(/^music\/.+\.m4a$/u);
      expect(i.collection).toBe("music");
    }
  });

  it("credits We Believe to Yoshino Nanjo, not to anyone else", () => {
    const wb = data.items.find((i) => i.id === "music-we-believe");
    expect(wb?.credits).toEqual([
      { role: "Music", name: "Yasuharu Takanashi" },
      { role: "Lyrics", name: "Funta7" },
      { role: "Vocals", name: "Yoshino Nanjo" },
    ]);
    expect(JSON.stringify(data)).not.toContain("Aino");
  });

  it("names the soundtrack film's tracks as its title cards do", () => {
    const titles = data.items.map((i) => i.title);
    expect(titles).toContain("Lullaby of Oblivion");
    expect(titles).toContain("Gray New World");
    expect(titles).toContain("CROSS×CREDO: Vexana Version");
    expect(titles).toContain("CROSS×CREDO: Guinevere Version");
  });

  it("gives the long listen a chapter for each track, in time order", () => {
    const full = data.items.find((i) => i.id === "music-soundtrack-full");
    expect(full?.chapters).toHaveLength(6);
    const times = full?.chapters?.map((c) => c.t) ?? [];
    expect(times).toEqual([...times].sort((x, y) => x - y));
    expect(times.every((t) => t < (full?.dur ?? 0))).toBe(true);
  });

  it("links only to films by the Films room's id rule", () => {
    for (const i of data.items) {
      for (const f of i.films) expect(f.id, i.id).toMatch(/^film-[a-z0-9-]+$/u);
    }
  });

  it("links to films that exist in films.json (when the Films room has been built)", () => {
    const films = path.resolve(__dirname, "../../../../public/data/library/films.json");
    if (!fs.existsSync(films)) return;
    const ids = new Set(
      (JSON.parse(fs.readFileSync(films, "utf8")) as { items: Array<{ id: string }> }).items.map(
        (i) => i.id,
      ),
    );
    for (const i of data.items)
      for (const f of i.films) expect(ids.has(f.id), `${i.id}: ${f.id}`).toBe(true);
  });

  it("uses no dashes and no banned word", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u"),
    );
    expect(text.toLowerCase()).not.toContain("con" + "viction");
  });
});
