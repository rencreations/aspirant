import { describe, expect, it } from "vitest";

import { MOVED_COSPLAY } from "../core/legacy-ids";
import { buildIndex, filterIndexes, searchIndexes } from "../core/flow/filter";
import {
  adaptFan,
  allNewest,
  artistOrder,
  canonLabel,
  charsWords,
  fanFacetOf,
  fanFacets,
  fanFilter,
  fanSearchOf,
  formatDate,
  groupByArtist,
  movedTarget,
  namedArtists,
  picturesNewest,
  videosOrdered,
} from "./model";
import type { FanItem, FanRaw } from "./types";

const img = { t: "t", p: "p", f: "f", w: 100, h: 100, c: "#000000" };

function raw(over: Partial<FanRaw> & { id: string }): FanRaw {
  return {
    title: "Layla, fan art",
    collection: "arts",
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
  raw({ id: "a", date: "2024-03-01" }),
  raw({
    id: "b",
    chars: ["fanny"],
    title: "Fanny, fan art",
    date: "2023-01-01",
    artist: "other",
    credit: { by: "@other", platform: "DeviantArt", url: null },
    platform: "DeviantArt",
  }),
  raw({
    id: "c",
    kind: "video",
    chars: ["ruby"],
    pairs: ["ruby-angela"],
    pair: "ruby-angela",
    title: "Ruby, speedpaint",
    tags: ["speedpaint"],
    date: "2025-05-05",
    video: { src: "v", poster: "p", w: 100, h: 100, dur: 10 },
  }),
  raw({
    id: "d",
    artist: null,
    chars: ["selena", "obsidia"],
    pairs: ["selena-obsidia"],
    pair: "selena-obsidia",
    date: "2022-02-02",
    credit: {
      by: "Several artists",
      platform: "Instagram",
      url: "https://www.instagram.com/p/grp/",
      note: "Named in the post: @a, @b, @c. The post does not say who made which picture.",
    },
  }),
  raw({
    id: "e",
    canon: "non-canon",
    artist: null,
    kind: "video",
    tags: ["edit", "reel", "official"],
    date: "2026-01-01",
    credit: { by: "Mobile Legends: Bang Bang", platform: "Instagram", url: null },
  }),
  raw({
    id: "f",
    artist: null,
    credit: { by: null, platform: "Reddit", url: null },
    platform: "Reddit",
    date: "2021-01-01",
  }),
  raw({ id: "g", date: "2024-03-02" }),
].map(adaptFan);

const byId = (list: readonly FanItem[]) => list.map((i) => i.id);

describe("the items", () => {
  it("makes a piece into what the flow reads", () => {
    const a = sample[0]!;
    expect(a.collection).toBe("arts");
    expect(a.room).toBe("fanart");
    expect(a.places).toEqual(["layla"]);
    expect(a.alt).toBe("Layla, fan art. By @someone.");
    // Nothing is invented: a missing maker is said so, a group post says several.
    expect(sample[3]?.alt).toContain("By several artists.");
    expect(sample[5]?.alt).toContain("By an artist who is not named.");
    expect(a.alt).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "u"));
  });

  it("puts the pictures newest first, with no videos", () => {
    expect(byId(picturesNewest(sample))).toEqual(["g", "a", "b", "d", "f"]);
    expect(byId(allNewest(sample))[0]).toBe("e");
  });

  it("puts fan videos before the official reels", () => {
    expect(byId(videosOrdered(sample))).toEqual(["c", "e"]);
    const more = [...sample, adaptFan(raw({ id: "h", kind: "video", date: "2020-01-01" }))];
    expect(byId(videosOrdered(more))).toEqual(["c", "h", "e"]);
  });
});

describe("the filter", () => {
  const pictures = picturesNewest(sample);
  const facets = fanFacets(pictures);
  const ids = facets.map((f) => f.id);

  it("lists the Aspirants first, the most pictures first", () => {
    expect(ids[0]).toBe("c:layla");
    const firstNonCharacter = ids.findIndex((id) => !id.startsWith("c:"));
    expect(ids.slice(0, firstNonCharacter).every((id) => id.startsWith("c:"))).toBe(true);
    // Then pairs, platforms, artists, each in its own block.
    const kinds = ids.map((id) => id.split(":")[0]);
    const order = ["c", "p", "pl", "a"];
    expect(kinds.map((k) => order.indexOf(k ?? ""))).toEqual(
      [...kinds.map((k) => order.indexOf(k ?? ""))].sort((a, b) => a - b),
    );
  });

  it("counts the pictures it is given, not the videos", () => {
    const layla = facets.find((f) => f.id === "c:layla");
    expect(layla?.count).toBe(3);
    expect(facets.find((f) => f.id === "c:ruby")).toBeUndefined();
    const all = fanFacets(sample);
    expect(all.find((f) => f.id === "c:ruby")?.count).toBe(1);
  });

  it("keeps a chip for a pair, platform or artist only when it has more than one picture", () => {
    expect(ids).toContain("a:someone");
    expect(ids).not.toContain("a:other");
    expect(ids).toContain("pl:Instagram");
    expect(ids).not.toContain("pl:Reddit");
    expect(facets.find((f) => f.id === "pl:Instagram")?.name).toBe("Instagram");
    expect(facets.find((f) => f.id === "p:fanny-layla")?.name).toBe("Pair: Fanny and Layla");
    expect(facets.find((f) => f.id === "a:someone")?.name).toBe("@someone");
  });

  it("never makes a facet of an unknown artist", () => {
    expect(ids.some((id) => id.startsWith("a:null"))).toBe(false);
    expect(fanFacetOf(sample[3]!)).toEqual([
      "c:selena",
      "c:obsidia",
      "p:selena-obsidia",
      "pl:Instagram",
    ]);
  });

  it("finds a piece by its maker, Aspirant, platform and kind", () => {
    expect(fanSearchOf(sample[0]!).toLowerCase()).toContain("someone");
    expect(fanSearchOf(sample[2]!).toLowerCase()).toContain("video");
    expect(fanSearchOf(sample[3]!).toLowerCase()).toContain("selena and obsidia");
    const index = buildIndex(sample, fanFacetOf, fanSearchOf, fanFacets(sample));
    expect(searchIndexes(index, "layla someone")).toEqual([0, 6]);
    expect(searchIndexes(index, "layla nobody")).toEqual([]);
    expect(searchIndexes(index, "speedpaint")).toEqual([2]);
    expect(searchIndexes(index, "reddit")).toEqual([5]);
    expect(searchIndexes(index, "")).toHaveLength(sample.length);
  });

  it("filters the video row and the artist view with the flow's own functions", () => {
    const all = fanFacets(sample);
    expect(byId(fanFilter(sample, all, "", "c:ruby"))).toEqual(["c"]);
    expect(byId(fanFilter(sample, all, "official", ""))).toEqual(["e"]);
    expect(byId(fanFilter(sample, all, "", "pl:Instagram"))).toEqual(["a", "c", "d", "e", "g"]);
    // A filter the list does not know (nobody, or a platform with one piece) is no filter.
    expect(fanFilter(sample, all, "", "c:nobody")).toHaveLength(sample.length);
    expect(fanFilter(sample, all, "", "pl:Reddit")).toHaveLength(sample.length);
    // The same answer as the pipeline the rows use.
    const index = buildIndex(sample, fanFacetOf, fanSearchOf, all);
    const flow = filterIndexes(index, searchIndexes(index, "fanny"), "c:fanny");
    expect(fanFilter(sample, all, "fanny", "c:fanny").map((i) => sample.indexOf(i))).toEqual(flow);
  });
});

describe("by artist", () => {
  const view = groupByArtist(allNewest(sample));

  it("groups single artists with counts of pictures and videos", () => {
    const someone = view.artists.find((a) => a.key === "someone");
    expect(someone?.creative).toBe(2);
    expect(someone?.animated).toBe(1);
    expect(view.artists.map((a) => a.key)[0]).toBe("someone");
  });

  it("keeps group posts, official reels and unnamed work apart", () => {
    expect(view.posts).toHaveLength(1);
    expect(view.posts[0]?.artists).toEqual(["@a", "@b", "@c"]);
    expect(byId(view.official)).toEqual(["e"]);
    expect(byId(view.unnamed)).toEqual(["f"]);
  });

  it("orders the viewer like the page", () => {
    expect(byId(artistOrder(view))).toEqual(["c", "g", "a", "b", "d", "e", "f"]);
  });

  it("reads artists from a note", () => {
    expect(namedArtists("Named in the post: @x, @y. Other.")).toEqual(["@x", "@y"]);
    expect(namedArtists(undefined)).toEqual([]);
  });
});

describe("words", () => {
  it("labels the official reels as what they are", () => {
    expect(canonLabel(sample[0]!)).toBe("Fan work");
    expect(canonLabel(sample[4]!)).toBe("Official reel, not story");
    expect(canonLabel({ ...sample[4]!, tags: [] })).toBe("Non-canon");
  });

  it("writes dates in plain words", () => {
    expect(formatDate("2022-01-23")).toBe("January 23, 2022");
    expect(formatDate(null)).toBeNull();
    expect(formatDate("soon")).toBe("soon");
  });

  it("names the Aspirants of a piece", () => {
    expect(charsWords(["fanny", "change"])).toBe("Fanny, Chang'e");
    expect(charsWords([])).toBe("Heroes");
  });
});

describe("the old address", () => {
  it("sends every moved cosplay id to its Aspirant's page with the new id", () => {
    for (const [oldId, moved] of Object.entries(MOVED_COSPLAY)) {
      const target = movedTarget(oldId);
      expect(target).toBe(
        `/collection/arts/cosplay/${moved.character}/?i=${encodeURIComponent(moved.id)}`,
      );
    }
    expect(Object.keys(MOVED_COSPLAY)).toHaveLength(12);
  });

  it("leaves every other id alone", () => {
    expect(movedTarget("fanart-ig-deyt9pycc-y-3")).toBeNull();
    expect(movedTarget("")).toBeNull();
    expect(movedTarget("toString")).toBeNull();
  });
});
