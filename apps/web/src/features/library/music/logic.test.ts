import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FILM_IDS } from "../video/links";
import { rimWords, titleLines } from "./disc-art";
import {
  append,
  clock,
  counter,
  creditSummary,
  downloadName,
  indexOfId,
  infoRows,
  loopAfter,
  loopOn,
  stepIn,
  toggleLoopOf,
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

  it("steps forward and back, and goes round at the ends like the field", () => {
    expect(stepIn([a, b, c], "a", 1)?.id).toBe("b");
    expect(stepIn([a, b, c], "b", -1)?.id).toBe("a");
    expect(stepIn([a, b, c], "c", 1)?.id).toBe("a");
    expect(stepIn([a, b, c], "a", -1)?.id).toBe("c");
    expect(stepIn([a], "a", 1)?.id).toBe("a");
    expect(stepIn([a, b, c], "zzz", 1)).toBeNull();
    expect(stepIn([], "a", 1)).toBeNull();
  });

  it("appends a track unless it is queued", () => {
    expect(append([a], b).map((t) => t.id)).toEqual(["a", "b"]);
    expect(append([a, b], a).map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("the loop", () => {
  it("is on only for the track it was set on", () => {
    expect(loopOn(null, "a")).toBe(false);
    expect(loopOn("a", "a")).toBe(true);
    expect(loopOn("a", "b")).toBe(false);
    expect(loopOn("a", null)).toBe(false);
  });

  it("turns on and off with the button, and needs a track", () => {
    expect(toggleLoopOf(null, "a")).toBe("a");
    expect(toggleLoopOf("a", "a")).toBeNull();
    // Set on another track before: the press sets it on this one.
    expect(toggleLoopOf("b", "a")).toBe("a");
    expect(toggleLoopOf("a", null)).toBeNull();
  });

  it("is off for the next track the visitor chooses, and stays on a restart of its own", () => {
    expect(loopAfter("a", "b")).toBeNull();
    expect(loopAfter("a", "a")).toBe("a");
    expect(loopAfter(null, "a")).toBeNull();
    // Gone once the player moved on: coming back to the track later does not bring it back.
    expect(loopAfter(loopAfter("a", "b"), "a")).toBeNull();
  });
});

describe("labels", () => {
  const items = [
    track("we-believe", {
      title: "We Believe",
      chars: ["fanny", "layla"],
      credits: [{ role: "Music", name: "Yasuharu Takanashi" }],
      released: "01/2022",
    }),
    track("lullaby", { title: "Lullaby of Oblivion", kind: "song", chars: ["selena", "obsidia"] }),
    track("piece", { title: "Obsidia: Solo", kind: "piece", chars: ["obsidia"] }),
  ];

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
    expect(downloadName(track("x", { title: "CROSS×CREDO: Vexana Version" }))).toBe(
      "CROSS×CREDO Vexana Version.m4a",
    );
    expect(
      downloadName(track("y", { title: "Obsidia: Solo", orig: "music/original/obsidia-solo.mp3" })),
    ).toBe("Obsidia Solo.mp3");
  });

  it("lists the credits and the release in the title block", () => {
    expect(infoRows(items[0]!)).toEqual([
      { label: "Music", value: "Yasuharu Takanashi" },
      { label: "Released", value: "01/2022" },
    ]);
    expect(infoRows(items[2]!)).toEqual([
      { label: "Credit", value: "Not named in the sources" },
      { label: "Released", value: "Not dated" },
    ]);
    expect(counter(4, 9)).toBe("05 / 09");
  });

  it("finds the disc a link names, or starts at the first", () => {
    expect(indexOfId(items, "piece")).toBe(2);
    expect(indexOfId(items, "nothing")).toBe(0);
    expect(indexOfId(items, null)).toBe(0);
  });

  it("prints the words of a disc without dashes", () => {
    const words = rimWords(items[0]!);
    expect(words).toContain("WE BELIEVE");
    expect(words).toContain("MUSIC YASUHARU TAKANASHI");
    expect(words).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u"),
    );
    expect(titleLines("We Believe!")).toEqual(["WE BELIEVE!"]);
    expect(titleLines("Chang'e & Lesley Music")).toEqual(["CHANG'E &", "LESLEY MUSIC"]);
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

  it("has the owner's seven tracks, in the owner's order and spelling", () => {
    expect(data.items.map((i) => [i.id, i.title])).toEqual([
      ["music-gray-new-world", "Gray New World"],
      ["music-lullaby-of-oblivion", "Lullaby of Oblivion"],
      ["music-cross-credo-vexana", "Cross x Credo: Vexana version"],
      ["music-cross-credo-guinevere", "Cross x Credo: Guinevere version"],
      ["music-change-lesley-display", "Chang'e & Lesley Music"],
      ["music-angela-ruby", "Angela & Ruby Music"],
      ["music-we-believe", "We Believe!"],
    ]);
    expect(JSON.stringify(data)).not.toContain(String.fromCharCode(0xd7));
  });

  it("cuts Angela & Ruby Music on its own, credited as the soundtrack's title card says", () => {
    const ar = data.items.find((i) => i.id === "music-angela-ruby");
    expect(ar?.credits).toEqual([{ role: "Music", name: "Steven Song" }]);
    expect(ar?.ep).toBe("EP 02");
    expect(ar?.released).toBe("12/2022");
    expect(ar?.src).toBe("music/angela-ruby.m4a");
    expect(ar?.dur).toBeGreaterThan(70);
    expect(ar?.dur).toBeLessThan(85);
    // Chang'e & Lesley no longer runs into it (a new key: the old one is cached).
    const cl = data.items.find((i) => i.id === "music-change-lesley-display");
    expect(cl?.src).toBe("music/change-lesley-display-v2.m4a");
    expect(cl?.dur).toBeLessThan(70);
  });

  it("opens the soundtrack video at each track's own time, as the owner timed it", () => {
    const at = (id: string) =>
      data.items
        .find((i) => i.id === id)
        ?.films.find(
          (f) => f.id === "film-selena-and-obsidia-video-music-collection-001-4013351897154849593",
        )?.t;
    expect(at("music-gray-new-world")).toBe(191);
    expect(at("music-lullaby-of-oblivion")).toBe(2);
    expect(at("music-cross-credo-vexana")).toBe(368);
    expect(at("music-cross-credo-guinevere")).toBe(474);
    expect(at("music-change-lesley-display")).toBe(580);
    expect(at("music-angela-ruby")).toBe(644);
  });

  it("links each track to the owner's films", () => {
    const films = (id: string) => data.items.find((i) => i.id === id)?.films.map((f) => f.id) ?? [];
    const soundtrack = "film-selena-and-obsidia-video-music-collection-001-4013351897154849593";
    expect(films("music-gray-new-world")).toEqual([FILM_IDS[1], FILM_IDS[0], soundtrack]);
    expect(films("music-lullaby-of-oblivion")).toEqual([FILM_IDS[2], FILM_IDS[0], soundtrack]);
    expect(films("music-cross-credo-vexana")).toEqual([FILM_IDS[3], FILM_IDS[4], soundtrack]);
    expect(films("music-cross-credo-guinevere")).toEqual([FILM_IDS[3], FILM_IDS[4], soundtrack]);
    expect(films("music-change-lesley-display")).toEqual([FILM_IDS[5], soundtrack]);
    expect(films("music-angela-ruby")).toEqual([FILM_IDS[8], FILM_IDS[6], FILM_IDS[7], soundtrack]);
    // We Believe! keeps its five films.
    expect(films("music-we-believe")).toHaveLength(5);
  });

  it("gives the platform links to the two released singles only", () => {
    for (const i of data.items) {
      const released = ["music-gray-new-world", "music-lullaby-of-oblivion"].includes(i.id);
      expect(Boolean(i.links), i.id).toBe(released);
      if (!i.links) continue;
      expect(i.links.spotify).toMatch(/^https:\/\/open\.spotify\.com\/album\//u);
      expect(i.links.apple).toMatch(/^https:\/\/music\.apple\.com\//u);
      expect(i.links.youtube).toMatch(/^https:\/\/www\.youtube\.com\/playlist\?list=/u);
      expect(i.links.more).toMatch(/^https:\/\/sndo\.ffm\.to\//u);
    }
  });

  it("links only to films by the Films room's id rule", () => {
    for (const i of data.items) {
      for (const f of i.films) expect(f.id, i.id).toMatch(/^film-[a-z0-9-]+$/u);
    }
  });

  it("links to films that exist in the Video rooms (when they have been built)", () => {
    const dir = path.resolve(__dirname, "../../../../public/data/library");
    const files = ["video-films.json", "video-others.json"].map((f) => path.join(dir, f));
    if (!files.every((f) => fs.existsSync(f))) return;
    const ids = new Set(
      files.flatMap((f) =>
        (JSON.parse(fs.readFileSync(f, "utf8")) as { items: Array<{ id: string }> }).items.map(
          (i) => i.id,
        ),
      ),
    );
    for (const i of data.items)
      for (const f of i.films) expect(ids.has(f.id), `${i.id}: ${f.id}`).toBe(true);
  });

  it("gives every track a disc face and the shape of its sound", () => {
    for (const i of data.items) {
      expect(i.disc, i.id).toMatch(/^music\/discs\/[a-z0-9-]+\.webp$/u);
      expect(i.wave, i.id).toMatch(/^[0-9a-z]{240}$/u);
    }
    expect(new Set(data.items.map((i) => i.disc)).size).toBe(data.items.length);
  });

  it("uses no dashes and no banned word", () => {
    const text = JSON.stringify(data);
    expect(text).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u"),
    );
    expect(text.toLowerCase()).not.toContain("con" + "viction");
  });
});
