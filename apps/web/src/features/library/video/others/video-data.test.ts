import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FILM_IDS, videoRoomOf } from "../links";
import type { OtherVideo, OthersFile } from "./types";
import {
  CANON_OPTIONS,
  KIND_LABEL,
  LENGTH_BANDS,
  NO_FILTERS,
  SHELVES,
  clock,
  dateWords,
  estimateShelf,
  facets,
  filterCount,
  filterVideos,
  findVideo,
  firstScreenKeys,
  groupVideos,
  hasFilters,
  isGroupMode,
  lengthBandOf,
  neighbour,
  notice,
  parseSeconds,
  restKeys,
  runtimeWords,
  sceneAt,
  shelfOf,
  sizeWords,
  stripKeys,
  videoUrlAt,
} from "./video-data";

function video(over: Partial<OtherVideo> & Pick<OtherVideo, "id" | "kind">): OtherVideo {
  return {
    title: over.id,
    collection: "video",
    chars: [],
    pair: null,
    canon: "official",
    tags: [],
    desc: "",
    video: {
      src: `films/${over.id}/video.mp4`,
      poster: `films/${over.id}/poster/p.webp`,
      w: 1920,
      h: 1080,
      dur: 100,
    },
    thumb: `films/${over.id}/poster/t.webp`,
    c: "#000000",
    ar: 16 / 9,
    strip: { src: `video/others/${over.id}/strip.webp`, n: 8 },
    bytes: 1000,
    chapters: [],
    ...over,
  };
}

const VIDEOS: OtherVideo[] = [
  video({
    id: "a",
    kind: "teaser",
    chars: ["layla", "fanny"],
    pair: "fanny-layla",
    title: "We Believe, teaser",
    video: { src: "x", poster: "p", w: 1280, h: 720, dur: 28 },
  }),
  video({ id: "b", kind: "lore", chars: ["ruby"], pair: "ruby-angela", desc: "A quiet picture" }),
  video({ id: "c", kind: "social", chars: ["selena"], pair: "selena-obsidia" }),
  video({
    id: "d",
    kind: "drama",
    chars: ["guinevere", "vexana"],
    pair: "guinevere-vexana",
    also: ["d-2"],
    chapters: [
      { t: 0, l: "Courtyard of the academy" },
      { t: 34, l: "A rift over a rooftop" },
    ],
    video: { src: "x", poster: "p", w: 1920, h: 1080, dur: 49 },
  }),
  video({
    id: "e",
    kind: "emote",
    canon: "fan",
    chars: ["fanny"],
    pair: "fanny-layla",
    credit: { by: "@maker", platform: "Instagram", url: null },
    video: { src: "x", poster: "p", w: 480, h: 480, dur: 2 },
  }),
  video({
    id: "f",
    kind: "edit",
    canon: "non-canon",
    chars: ["obsidia"],
    pair: "selena-obsidia",
    credit: { by: "Mobile Legends: Bang Bang", platform: "Instagram", url: null },
    video: { src: "x", poster: "p", w: 1080, h: 1920, dur: 15 },
  }),
  video({
    id: "g",
    kind: "livestream",
    chars: ["vexana"],
    pair: "guinevere-vexana",
    video: { src: "x", poster: "p", w: 608, h: 1080, dur: 1367 },
  }),
  video({ id: "h", kind: "reel", chars: [], pair: null, title: "Pick your girl" }),
  video({ id: "i", kind: "parody", canon: "non-canon", chars: ["layla", "fanny"] }),
  video({ id: "j", kind: "gameplay", chars: ["obsidia"], pair: "selena-obsidia" }),
];

const ids = (list: readonly OtherVideo[]) => list.map((v) => v.id);

describe("shelves", () => {
  it("give every kind one shelf", () => {
    for (const kind of Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>) {
      expect(SHELVES.filter((s) => s.kinds.includes(kind))).toHaveLength(1);
    }
  });

  it("find the shelf of a kind", () => {
    expect(shelfOf("teaser").id).toBe("trailers");
    expect(shelfOf("parody").id).toBe("parody");
    expect(shelfOf("social").id).toBe("shorts");
  });
});

describe("filters", () => {
  it("start with none on", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(filterVideos(VIDEOS, NO_FILTERS)).toHaveLength(VIDEOS.length);
    expect(filterCount(NO_FILTERS)).toBe(0);
  });

  it("filter by character, pair, shelf, canon and length", () => {
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, who: "obsidia" }))).toEqual(["f", "j"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, pair: "ruby-angela" }))).toEqual(["b"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, kind: "trailers" }))).toEqual(["a", "b"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, canon: "fan" }))).toEqual(["e"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, canon: "non-canon" }))).toEqual(["f", "i"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, length: "long" }))).toEqual(["g"]);
  });

  it("search every word in the title, text, credit, names and scenes", () => {
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "believe" }))).toEqual(["a"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "quiet picture" }))).toEqual(["b"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "rooftop" }))).toEqual(["d"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "@maker" }))).toEqual(["e"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "vexana livestream" }))).toEqual(["g"]);
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "skin nothing" }))).toEqual([]);
    // The name of the shelf is searched too.
    expect(ids(filterVideos(VIDEOS, { ...NO_FILTERS, q: "trailers short" }))).toEqual(["a", "b"]);
  });

  it("count how many videos each choice would leave", () => {
    const base = facets(VIDEOS, NO_FILTERS);
    expect(base.who.obsidia).toBe(2);
    expect(base.pair["selena-obsidia"]).toBe(3);
    expect(base.canon.official).toBe(7);
    expect(base.kind.trailers).toBe(2);
    expect(base.length.long).toBe(1);

    // With a character on, the other characters count only the videos that have both.
    const withObsidia = facets(VIDEOS, { ...NO_FILTERS, who: "obsidia", canon: "non-canon" });
    expect(withObsidia.who.obsidia).toBe(1);
    expect(withObsidia.canon.official).toBe(1);
    expect(withObsidia.canon["non-canon"]).toBe(1);
  });

  it("count every filter that is on", () => {
    expect(filterCount({ ...NO_FILTERS, who: "ruby", q: "  x " })).toBe(2);
    expect(hasFilters({ ...NO_FILTERS, q: "   " })).toBe(false);
  });
});

describe("length bands", () => {
  it("put a video in one band", () => {
    expect(lengthBandOf(2).id).toBe("quick");
    expect(lengthBandOf(30).id).toBe("short");
    expect(lengthBandOf(119.9).id).toBe("short");
    expect(lengthBandOf(300).id).toBe("medium");
    expect(lengthBandOf(5000).id).toBe("long");
    expect(LENGTH_BANDS.map((b) => b.id)).toEqual(["quick", "short", "medium", "long"]);
  });
});

describe("groups", () => {
  it("group by kind in the order of the shelves and drop the empty ones", () => {
    const groups = groupVideos(VIDEOS, "kind");
    // The live-action parody is the first shelf of the wall (the owner asked, 11 Nov 2026).
    expect(groups.map((g) => g.id)).toEqual([
      "parody",
      "trailers",
      "shorts",
      "drama",
      "live",
      "reels",
      "gameplay",
      "emotes",
      "edits",
    ]);
    expect(ids(groups[1]!.items)).toEqual(["a", "b"]);
  });

  it("group by pair, with the videos of no pair last", () => {
    const groups = groupVideos(VIDEOS, "pair");
    expect(groups.map((g) => g.id)).toEqual([
      "fanny-layla",
      "ruby-angela",
      "guinevere-vexana",
      "selena-obsidia",
      "none",
    ]);
    expect(ids(groups[groups.length - 1]!.items)).toEqual(["h", "i"]);
  });

  it("group by length, shortest first inside a band", () => {
    const groups = groupVideos(VIDEOS, "length");
    expect(groups.map((g) => g.id)).toEqual(["quick", "short", "long"]);
    const quick = ids(groups[0]!.items);
    expect(quick[0]).toBe("e");
    // Every video is in exactly one group.
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(VIDEOS.length);
  });

  it("know the three modes", () => {
    expect(isGroupMode("kind")).toBe(true);
    expect(isGroupMode("pair")).toBe(true);
    expect(isGroupMode("length")).toBe(true);
    expect(isGroupMode("year")).toBe(false);
  });
});

describe("finding a video", () => {
  it("find a video by its id or by an id of the same video", () => {
    expect(findVideo(VIDEOS, "d")?.id).toBe("d");
    expect(findVideo(VIDEOS, "d-2")?.id).toBe("d");
    expect(findVideo(VIDEOS, "nope")).toBeUndefined();
    expect(findVideo(VIDEOS, "")).toBeUndefined();
    expect(findVideo(VIDEOS, null)).toBeUndefined();
  });

  it("step to the next and the previous video and wrap round", () => {
    expect(neighbour(VIDEOS, VIDEOS[0]!, 1)?.id).toBe("b");
    expect(neighbour(VIDEOS, VIDEOS[0]!, -1)?.id).toBe("j");
    expect(neighbour(VIDEOS, VIDEOS[VIDEOS.length - 1]!, 1)?.id).toBe("a");
    expect(neighbour(VIDEOS, video({ id: "z", kind: "short" }), 1)).toBeUndefined();
    expect(neighbour([], VIDEOS[0]!, 1)).toBeUndefined();
  });
});

describe("start times", () => {
  it("read seconds, clocks and units", () => {
    expect(parseSeconds("90")).toBe(90);
    expect(parseSeconds("1:30")).toBe(90);
    expect(parseSeconds("1:02:03")).toBe(3723);
    expect(parseSeconds("1m30s")).toBe(90);
    expect(parseSeconds("90s")).toBe(90);
    expect(parseSeconds("12.5")).toBe(12.5);
  });

  it("read nothing from nonsense and keep the start inside the video", () => {
    expect(parseSeconds("")).toBe(0);
    expect(parseSeconds(null)).toBe(0);
    expect(parseSeconds("abc")).toBe(0);
    expect(parseSeconds("-5")).toBe(0);
    expect(parseSeconds("500", 100)).toBe(99);
    expect(parseSeconds("5", 0)).toBe(0);
  });

  it("find the scene that holds a time", () => {
    const scenes = [
      { t: 0, l: "a" },
      { t: 34, l: "b" },
      { t: 60, l: "c" },
    ];
    expect(sceneAt(scenes, 0)).toBe(0);
    expect(sceneAt(scenes, 33.9)).toBe(0);
    expect(sceneAt(scenes, 34)).toBe(1);
    expect(sceneAt(scenes, 500)).toBe(2);
    expect(sceneAt([], 10)).toBe(-1);
  });
});

describe("words", () => {
  it("write a clock", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65)).toBe("1:05");
    expect(clock(3723)).toBe("1:02:03");
    expect(clock(-3)).toBe("0:00");
  });

  it("write a runtime", () => {
    expect(runtimeWords(12)).toBe("12 s");
    expect(runtimeWords(100)).toBe("1 min 40 s");
    expect(runtimeWords(1683)).toBe("28 min");
    expect(runtimeWords(7500)).toBe("2 h 5 min");
    expect(runtimeWords(7200)).toBe("2 h");
  });

  it("write a size and a date", () => {
    expect(sizeWords(500)).toBe("1 MB");
    expect(sizeWords(154 * 1024 ** 2)).toBe("154 MB");
    expect(sizeWords(1.2 * 1024 ** 3)).toBe("1.2 GB");
    expect(dateWords("2026-09-26")).toBe("26 Sep 2026");
    expect(dateWords("2026-09-26T10:00:00Z")).toBe("26 Sep 2026");
    expect(dateWords(undefined)).toBe("");
    expect(dateWords("soon")).toBe("");
  });

  it("put a start time on the address of the file", () => {
    const v = VIDEOS[0]!;
    expect(videoUrlAt(v, 0)).not.toContain("#t=");
    expect(videoUrlAt(v, 12.345)).toMatch(/#t=12\.35$|#t=12\.34$/u);
    expect(videoUrlAt({ ...v, video: { ...v.video, local: "/video/x.mp4" } }, 5)).toBe(
      "/video/x.mp4#t=5",
    );
  });
});

describe("labels", () => {
  it("give fan work and the parody the shared badge", () => {
    expect(notice(VIDEOS.find((v) => v.id === "e")!)?.kind).toBe("badge");
    expect(notice(VIDEOS.find((v) => v.id === "i")!)?.kind).toBe("badge");
  });

  it("never call an official edit a parody", () => {
    const edit = notice(VIDEOS.find((v) => v.id === "f")!);
    expect(edit).toEqual({ kind: "note", text: "Official reel, not story", short: "Not story" });
    expect(notice(VIDEOS.find((v) => v.id === "j")!)).toEqual({
      kind: "note",
      text: "Not story",
      short: "Not story",
    });
  });

  it("say nothing about plain official work", () => {
    expect(notice(VIDEOS[0]!)).toBeNull();
    expect(notice(VIDEOS.find((v) => v.id === "h")!)).toBeNull();
  });
});

describe("loading lists", () => {
  it("wait for the first thumbnails and the header, and leave the rest for later", () => {
    const first = firstScreenKeys(VIDEOS);
    expect(first).toContain(VIDEOS[0]!.thumb);
    const rest = restKeys(VIDEOS);
    expect(first.filter((k) => rest.includes(k))).toEqual([]);
    expect(new Set([...first, ...rest]).size).toBe(first.length + rest.length);
  });

  it("add the poster of the video in the address", () => {
    const linked = VIDEOS[VIDEOS.length - 1]!;
    expect(firstScreenKeys(VIDEOS, linked, 2)).toContain(linked.video.poster);
    expect(restKeys(VIDEOS, linked)).not.toContain(linked.video.poster);
  });

  it("list every strip once", () => {
    expect(stripKeys(VIDEOS)).toHaveLength(VIDEOS.length);
  });
});

describe("the data file", () => {
  const root = path.resolve(import.meta.dirname, "../../../../..");
  const file = JSON.parse(
    readFileSync(path.join(root, "public/data/library/video-others.json"), "utf8"),
  ) as OthersFile;

  it("says what it is", () => {
    expect(file.v).toBe(1);
    expect(file.slug).toBe("video");
    expect(file.room).toBe("others");
    expect(file.items.length).toBeGreaterThanOrEqual(90);
    expect(file.items.every((v) => v.collection === "video")).toBe(true);
  });

  it("has a shelf for every kind it uses", () => {
    for (const v of file.items) {
      expect(KIND_LABEL[v.kind], `${v.id} has kind ${v.kind}`).toBeTruthy();
      expect(SHELVES.some((s) => s.kinds.includes(v.kind))).toBe(true);
    }
  });

  it("uses the same shelves as the pipeline", () => {
    const catalog = readFileSync(
      path.resolve(root, "../../scripts/library/films/catalog.py"),
      "utf8",
    );
    const rows = [...catalog.matchAll(/\("(\w+)", "([^"]+)", \[([^\]]+)\]\)/gu)].map((m) => ({
      id: m[1],
      title: m[2],
      kinds: m[3]!
        .split(",")
        .map((k) => k.trim().replace(/"/gu, ""))
        .filter(Boolean),
    }));
    expect(rows).toEqual(SHELVES.map((s) => ({ id: s.id, title: s.title, kinds: [...s.kinds] })));
  });

  it("has unique ids and none of the ten films", () => {
    const all = file.items.map((v) => v.id);
    expect(new Set(all).size).toBe(all.length);
    for (const film of FILM_IDS) expect(all).not.toContain(film);
    for (const v of file.items) for (const a of v.also ?? []) expect(all).not.toContain(a);
  });

  it("gives every video a poster, a thumbnail, a strip and a size", () => {
    for (const v of file.items) {
      expect(v.thumb, v.id).toMatch(/\.webp$/u);
      expect(v.video.poster, v.id).toMatch(/\.webp$/u);
      expect(v.strip.n, v.id).toBe(8);
      expect(v.strip.src, v.id).toMatch(/strip\.webp$/u);
      expect(v.ar, v.id).toBeGreaterThan(0.3);
      expect(v.ar, v.id).toBeLessThan(3);
      expect(v.video.dur, v.id).toBeGreaterThan(0.5);
      expect(v.bytes, v.id).toBeGreaterThan(1000);
      expect(Array.isArray(v.chapters), v.id).toBe(true);
      expect(v.video.src !== "" || Boolean(v.video.local), v.id).toBe(true);
      expect(v.video.src.startsWith("/"), v.id).toBe(false);
    }
  });

  it("labels fan work and the parody, and credits every fan video", () => {
    for (const v of file.items) {
      expect(CANON_OPTIONS.some((c) => c.value === v.canon)).toBe(true);
      if (v.canon === "fan") expect(v.credit, v.id).toBeTruthy();
      if (v.kind === "parody") expect(v.canon).toBe("non-canon");
      if (v.kind === "edit" || v.kind === "reel" || v.kind === "gameplay") {
        expect(v.credit?.by, v.id).toBeTruthy();
      }
    }
    expect(file.items.filter((v) => v.kind === "parody")).toHaveLength(1);
  });

  it("never writes a dash or the parody's academy name", () => {
    const text = JSON.stringify(file);
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, "u");
    expect(text).not.toMatch(dashes);
    expect(text.toLowerCase()).not.toContain(["sei", "resk"].join(""));
  });

  it("keeps the drama as one entry per episode set", () => {
    const drama = file.items.filter((v) => v.kind === "drama");
    expect(drama).toHaveLength(13);
    expect(drama.filter((v) => v.also?.length)).toHaveLength(7);
    expect(new Set(drama.map((v) => v.group))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});

describe("the estimate of a shelf", () => {
  const size = { width: 1000, rowHeight: 100, gap: 10 };
  const wide = (n: number) => new Array(n).fill({ ar: 1.78 }) as Array<{ ar: number }>;

  it("is the header alone for nothing to measure or nothing to show", () => {
    expect(estimateShelf([], size)).toBeLessThan(260);
    expect(estimateShelf(wide(1), { width: 0, rowHeight: 100, gap: 10 })).toBe(
      estimateShelf([], size),
    );
  });

  it("takes tiles into a row while their natural widths fit, then stretches the row", () => {
    // Three wide tiles of 178 px fit on one 1000 px line, and the one row is the last row, at its own height.
    expect(estimateShelf(wide(3), size)).toBe(estimateShelf(wide(1), size));
    // Six need two rows, and the first one is stretched to the width (taller than a row).
    expect(estimateShelf(wide(6), size)).toBeGreaterThan(estimateShelf(wide(3), size) + 100);
  });

  it("grows with the number of rows", () => {
    expect(estimateShelf(wide(12), size)).toBeGreaterThan(estimateShelf(wide(6), size));
  });
});

describe("links into the room", () => {
  const root = path.resolve(import.meta.dirname, "../../../../..");
  const read = <T>(name: string): T =>
    JSON.parse(readFileSync(path.join(root, `public/data/library/${name}.json`), "utf8")) as T;
  const file = read<OthersFile>("video-others");
  const known = new Set<string>(FILM_IDS);
  for (const v of file.items) {
    known.add(v.id);
    for (const a of v.also ?? []) known.add(a);
  }

  it("send every video of the room to the room, and the ten films to the Films room", () => {
    for (const v of file.items) expect(videoRoomOf(v.id), v.id).toBe("others");
    for (const a of file.items.flatMap((v) => v.also ?? [])) expect(videoRoomOf(a)).toBe("others");
    for (const f of FILM_IDS) expect(videoRoomOf(f)).toBe("films");
  });

  it("resolve every film that the scene stills of the Arts room link to", () => {
    const scenes = read<{ films: Array<{ id: string }> }>("arts-scenes");
    for (const f of scenes.films) expect(known.has(f.id), f.id).toBe(true);
  });

  it("resolve every video that the library search finds", () => {
    const search = read<Array<{ id: string; c: string }>>("search");
    for (const e of search.filter((x) => x.c === "video")) expect(known.has(e.id), e.id).toBe(true);
  });
});
