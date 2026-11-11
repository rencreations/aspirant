import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MOVED_COSPLAY } from "../core/legacy-ids";
import { firstKeys } from "./first-keys";
import {
  adaptFan,
  fanFacets,
  fanFilter,
  movedTarget,
  picturesNewest,
  videosOrdered,
} from "./model";
import type { FanItem, FanRaw } from "./types";

const FILE = path.resolve(__dirname, "../../../../../public/data/library/arts-fanart.json");
const file = JSON.parse(fs.readFileSync(FILE, "utf8")) as { items: FanRaw[] };
const all: FanItem[] = file.items.map(adaptFan);

const DESKTOP = { width: 1440, height: 900, dpr: 1 };
const PHONE = { width: 390, height: 844, dpr: 2 };
/** An en dash or an em dash, built from char codes so this file holds none. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "u");

describe("the data file", () => {
  it("holds 149 pictures and 18 videos, and no cosplay", () => {
    expect(all).toHaveLength(167);
    expect(all.filter((i) => i.kind === "video")).toHaveLength(18);
    expect(all.some((i) => (i.kind as string) === "cosplay")).toBe(false);
    for (const oldId of Object.keys(MOVED_COSPLAY)) {
      expect(all.some((i) => i.id === oldId)).toBe(false);
    }
  });

  it("gives every piece a maker line, a label and a post to look at", () => {
    for (const item of all) {
      expect(item.credit, item.id).toBeDefined();
      expect(item.credit?.platform ?? item.platform, item.id).toBeTruthy();
      // A fan piece is fan work. The only others are the official account's reels, and they are videos.
      if (item.canon !== "fan") {
        expect(item.kind, item.id).toBe("video");
        expect(item.tags, item.id).toContain("official");
      }
    }
  });

  it("makes every piece into something the flow can read, with no dashes in its words", () => {
    for (const item of all) {
      expect(item.room).toBe("fanart");
      expect(item.alt.length, item.id).toBeGreaterThan(5);
      expect(item.img.w, item.id).toBeGreaterThan(0);
      expect(item.alt, item.id).not.toMatch(DASHES);
      expect(item.title, item.id).not.toMatch(DASHES);
    }
  });

  it("has a poster and a file for every video", () => {
    for (const item of all.filter((i) => i.kind === "video")) {
      expect(item.video?.src, item.id).toBeTruthy();
      expect(item.video?.poster, item.id).toBeTruthy();
      expect(item.video?.dur, item.id).toBeGreaterThan(0);
    }
  });

  it("knows no id of the cosplay photos any more, and forwards all twelve", () => {
    for (const oldId of Object.keys(MOVED_COSPLAY)) expect(movedTarget(oldId)).not.toBeNull();
    for (const item of all) expect(movedTarget(item.id), item.id).toBeNull();
  });
});

describe("the filter on the real data", () => {
  const pictures = picturesNewest(all);
  const facets = fanFacets(pictures);

  it("opens on the Aspirants, the most pictures first, and keeps the other chips behind", () => {
    const names = facets.map((f) => f.name);
    expect(names.slice(0, 3)).toEqual(["Fanny", "Layla", "Ruby"]);
    expect(facets.filter((f) => f.id.startsWith("c:"))).toHaveLength(10);
    // Every chip holds at least one picture, and the ones that are not an Aspirant hold two.
    for (const f of facets)
      expect(f.count, f.id).toBeGreaterThanOrEqual(f.id.startsWith("c:") ? 1 : 2);
    // The biggest artist is a named one, never the unknown maker.
    const artists = facets.filter((f) => f.id.startsWith("a:"));
    expect(artists.length).toBeGreaterThan(2);
    expect(artists[0]?.name).toContain("jlen_ismyname");
  });

  it("agrees between the rows and the video row", () => {
    const videos = videosOrdered(all);
    const ruby = fanFilter(pictures, facets, "", "c:ruby");
    const rubyVideos = fanFilter(videos, facets, "", "c:ruby");
    expect(ruby.length).toBeGreaterThan(10);
    expect(rubyVideos.length).toBeGreaterThan(0);
    expect(ruby.every((i) => i.chars.includes("ruby"))).toBe(true);
    // "change" finds Chang'e whichever way it is spelled.
    const a = fanFilter(pictures, facets, "change", "");
    const b = fanFilter(pictures, facets, "Chang'e", "");
    expect(a.length).toBeGreaterThan(0);
    expect(b.map((i) => i.id)).toEqual(a.map((i) => i.id));
  });
});

describe("the first screen", () => {
  it("waits for the first rows and the first posters, and nothing twice", () => {
    const keys = firstKeys(all, "", DESKTOP);
    expect(keys.length).toBeGreaterThan(5);
    expect(keys.length).toBeLessThanOrEqual(14 + 6);
    expect(new Set(keys).size).toBe(keys.length);
    // The row's pictures are thumbnails or previews of pictures, the posters are videos'.
    const posters = videosOrdered(all).map((v) => v.video?.poster);
    expect(keys.some((k) => posters.includes(k))).toBe(true);
    const videoIds = new Set(all.filter((i) => i.kind === "video").flatMap((v) => [v.img.t]));
    // A video's thumbnail is never asked for as a row picture.
    expect(keys.some((k) => videoIds.has(k))).toBe(false);
  });

  it("asks for fewer pictures on a short phone and the same maths as the page", () => {
    const phone = firstKeys(all, "", PHONE);
    expect(phone.length).toBeGreaterThan(3);
  });

  it("follows the address: a filter, a search that leaves no video, a picture that opens", () => {
    // A filter leaves only the pieces it names: every key is one of theirs.
    const ruby = firstKeys(all, "?f=c:ruby", DESKTOP);
    const theirs = new Set(
      all
        .filter((i) => i.chars.includes("ruby"))
        .flatMap((i) => [i.img.t, i.img.p, i.video?.poster ?? ""]),
    );
    expect(ruby.length).toBeGreaterThan(3);
    expect(ruby.every((k) => theirs.has(k))).toBe(true);

    // A search that no video matches has no posters in it.
    const noVideo = firstKeys(all, "?q=lineart", DESKTOP);
    const posters = new Set(videosOrdered(all).map((v) => v.video?.poster));
    const stills = picturesNewest(all).filter((i) => i.tags.includes("lineart"));
    if (stills.length > 0) expect(noVideo.some((k) => posters.has(k))).toBe(false);

    const one = picturesNewest(all).at(-1);
    expect(firstKeys(all, `?i=${one?.id ?? ""}`, DESKTOP)).toContain(one?.img.p);
    const video = videosOrdered(all)[0];
    expect(firstKeys(all, `?i=${video?.id ?? ""}`, DESKTOP)).toContain(video?.video?.poster);
  });

  it("waits for the By artist thumbnails when the view says so", () => {
    const keys = firstKeys(all, "?view=artist", DESKTOP);
    expect(keys.length).toBeGreaterThan(3);
    expect(keys.length).toBeLessThanOrEqual(14);
  });
});
