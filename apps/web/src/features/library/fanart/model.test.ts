import { describe, expect, it } from "vitest";

import {
  artistOrder,
  byDate,
  countBy,
  filterItems,
  formatDate,
  groupByArtist,
  isFiltered,
  kindOf,
  matchesQuery,
  namedArtists,
  toPicture,
} from "./model";
import { NO_FILTERS, type FanItem } from "./types";

const img = { t: "t", p: "p", f: "f", w: 100, h: 100, c: "#000000" };

function item(over: Partial<FanItem> & { id: string }): FanItem {
  return {
    title: "Layla, fan art",
    collection: "fanart",
    chars: ["layla"],
    pair: "fanny-layla",
    pairs: ["fanny-layla"],
    canon: "fan",
    tags: [],
    kind: "image",
    platform: "Instagram",
    date: "2024-01-01",
    artist: "someone",
    credit: { by: "@someone", platform: "Instagram", url: "https://www.instagram.com/p/x/" },
    img,
    src: [],
    ...over,
  };
}

const sample: FanItem[] = [
  item({ id: "a", date: "2024-03-01" }),
  item({
    id: "b",
    chars: ["fanny"],
    title: "Fanny, fan art",
    date: "2023-01-01",
    artist: "other",
    credit: { by: "@other", platform: "DeviantArt", url: null },
    platform: "DeviantArt",
  }),
  item({
    id: "c",
    kind: "video",
    chars: ["ruby"],
    pairs: ["ruby-angela"],
    pair: "ruby-angela",
    title: "Ruby, speedpaint",
    tags: ["speedpaint"],
    date: "2025-05-05",
  }),
  item({
    id: "d",
    kind: "cosplay",
    chars: ["fanny", "layla"],
    title: "Fanny and Layla, cosplay",
    artist: null,
    credit: { by: "XiXia (Heliko) Beta", platform: "Instagram", url: null },
  }),
  item({
    id: "e",
    artist: null,
    chars: ["selena", "obsidia"],
    pairs: ["selena-obsidia"],
    pair: "selena-obsidia",
    credit: {
      by: "Several artists",
      platform: "Instagram",
      url: "https://www.instagram.com/p/grp/",
      note: "Named in the post: @a, @b, @c. The post does not say who made which picture.",
    },
  }),
  item({
    id: "f",
    canon: "non-canon",
    artist: null,
    kind: "video",
    credit: { by: "Mobile Legends: Bang Bang", platform: "Instagram", url: null },
  }),
  item({
    id: "g",
    artist: null,
    credit: { by: null, platform: "Reddit", url: null },
    platform: "Reddit",
  }),
];

describe("filters", () => {
  it("matches every word of the query in the title, artist or name", () => {
    expect(matchesQuery(sample[0]!, "layla someone")).toBe(true);
    expect(matchesQuery(sample[0]!, "layla nobody")).toBe(false);
    expect(matchesQuery(sample[3]!, "xixia")).toBe(true);
    expect(matchesQuery(sample[0]!, "")).toBe(true);
  });

  it("filters by pair, character, platform and kind together", () => {
    expect(filterItems(sample, { ...NO_FILTERS, pair: "ruby-angela" }).map((i) => i.id)).toEqual([
      "c",
    ]);
    expect(filterItems(sample, { ...NO_FILTERS, who: "fanny" }).map((i) => i.id)).toEqual([
      "b",
      "d",
    ]);
    expect(filterItems(sample, { ...NO_FILTERS, platform: "Reddit" }).map((i) => i.id)).toEqual([
      "g",
    ]);
    expect(filterItems(sample, { ...NO_FILTERS, kind: "cosplay" }).map((i) => i.id)).toEqual(["d"]);
    expect(filterItems(sample, { ...NO_FILTERS, kind: "video" }).map((i) => i.id)).toEqual([
      "c",
      "f",
    ]);
    expect(
      filterItems(sample, { ...NO_FILTERS, kind: "art", who: "fanny" }).map((i) => i.id),
    ).toEqual(["b"]);
  });

  it("knows when something is filtered", () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, q: "  " })).toBe(false);
    expect(isFiltered({ ...NO_FILTERS, who: "layla" })).toBe(true);
    expect(kindOf(sample[2]!)).toBe("video");
  });

  it("counts a filter's values with the other filters applied", () => {
    const counts = countBy(sample, { ...NO_FILTERS, kind: "art" }, "who", (i) => i.chars);
    expect(counts.get("layla")).toBe(2);
    expect(counts.get("ruby")).toBeUndefined();
  });
});

describe("by artist", () => {
  const view = groupByArtist(sample);

  it("groups single artists with counts of pictures and videos", () => {
    const someone = view.artists.find((a) => a.key === "someone");
    expect(someone?.creative).toBe(1);
    expect(someone?.animated).toBe(1);
    expect(view.artists.map((a) => a.key)[0]).toBe("someone");
  });

  it("keeps group posts, official reels and unnamed work apart", () => {
    expect(view.posts).toHaveLength(1);
    expect(view.posts[0]?.artists).toEqual(["@a", "@b", "@c"]);
    expect(view.official.map((i) => i.id)).toEqual(["f"]);
    expect(view.unnamed.map((i) => i.id)).toEqual(["d", "g"]);
  });

  it("orders the viewer like the page", () => {
    expect(artistOrder(view).map((i) => i.id)).toEqual(["a", "c", "b", "e", "f", "d", "g"]);
  });

  it("reads artists from a note", () => {
    expect(namedArtists("Named in the post: @x, @y. Other.")).toEqual(["@x", "@y"]);
    expect(namedArtists(undefined)).toEqual([]);
  });
});

describe("text", () => {
  it("sorts newest first", () => {
    expect(byDate(sample).map((i) => i.id)[0]).toBe("c");
  });

  it("writes dates in plain words", () => {
    expect(formatDate("2022-01-23")).toBe("January 23, 2022");
    expect(formatDate(null)).toBeNull();
  });

  it("gives the viewer a note and facts", () => {
    const p = toPicture(sample[2]!);
    expect(p.facts?.[0]).toEqual(["Kind", "Video"]);
    expect(p.facts?.some(([k]) => k === "Medium")).toBe(true);
  });
});
