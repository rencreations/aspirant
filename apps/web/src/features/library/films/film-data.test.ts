import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  chapterAt,
  clock,
  dateWords,
  facets,
  firstScreenKeys,
  filterFilms,
  findFilm,
  groupRows,
  hasFilters,
  parseSeconds,
  restKeys,
  rowOf,
  runtimeWords,
  sizeWords,
  videoUrlAt,
} from "./film-data";
import type { Film } from "./types";

function film(over: Partial<Film> & Pick<Film, "id" | "kind">): Film {
  return {
    title: over.id,
    collection: "films",
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
    bytes: 1000,
    chapters: [],
    ...over,
  };
}

const FILMS: Film[] = [
  film({
    id: "a",
    kind: "trailer",
    chars: ["layla", "fanny"],
    pair: "fanny-layla",
    title: "We Believe!",
  }),
  film({ id: "b", kind: "teaser", chars: ["ruby"], pair: "ruby-angela", desc: "A short teaser" }),
  film({ id: "c", kind: "character", chars: ["ruby", "angela"], pair: "ruby-angela" }),
  film({ id: "d", kind: "social", chars: ["selena"], pair: "selena-obsidia" }),
  film({
    id: "e",
    kind: "drama",
    chars: ["guinevere", "vexana"],
    pair: "guinevere-vexana",
    also: ["e-2"],
    chapters: [
      { t: 0, l: "Courtyard of the academy" },
      { t: 34, l: "A rift over a rooftop" },
    ],
  }),
  film({
    id: "f",
    kind: "parody",
    canon: "non-canon",
    chars: ["layla", "fanny"],
    pair: "fanny-layla",
  }),
];

describe("rows", () => {
  it("puts every kind in a row", () => {
    expect(rowOf("teaser").id).toBe("trailers");
    expect(rowOf("social").id).toBe("shorts");
    expect(rowOf("behind-the-scenes").id).toBe("music");
    expect(rowOf("match").id).toBe("live");
  });

  it("groups in order and leaves empty rows out", () => {
    const rows = groupRows(FILMS);
    expect(rows.map((r) => r.row.id)).toEqual([
      "trailers",
      "characters",
      "shorts",
      "drama",
      "parody",
    ]);
    expect(rows[0]!.films.map((f) => f.id)).toEqual(["a", "b"]);
  });
});

describe("filters", () => {
  it("knows when nothing is filtered", () => {
    expect(hasFilters(NO_FILTERS)).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, q: "  " })).toBe(false);
    expect(hasFilters({ ...NO_FILTERS, who: "ruby" })).toBe(true);
  });

  it("filters by character, pair and row", () => {
    expect(filterFilms(FILMS, { ...NO_FILTERS, who: "ruby" }).map((f) => f.id)).toEqual(["b", "c"]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, pair: "fanny-layla" }).map((f) => f.id)).toEqual([
      "a",
      "f",
    ]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, kind: "shorts" }).map((f) => f.id)).toEqual(["d"]);
  });

  it("searches titles, text, names and scene captions", () => {
    expect(filterFilms(FILMS, { ...NO_FILTERS, q: "believe" }).map((f) => f.id)).toEqual(["a"]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, q: "teaser" }).map((f) => f.id)).toEqual(["b"]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, q: "rooftop rift" }).map((f) => f.id)).toEqual([
      "e",
    ]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, q: "vexana" }).map((f) => f.id)).toEqual(["e"]);
    expect(filterFilms(FILMS, { ...NO_FILTERS, q: "nothing here" })).toEqual([]);
  });

  it("counts each choice against the other choices", () => {
    const f = facets(FILMS, { ...NO_FILTERS, pair: "ruby-angela" });
    expect(f.who.ruby).toBe(2);
    expect(f.who.angela).toBe(1);
    expect(f.who.layla).toBeUndefined(); // the character counts follow the pair choice
    expect(f.pair["fanny-layla"]).toBe(2); // the pair counts do not
    expect(f.kind.trailers).toBe(1);
  });
});

describe("find", () => {
  it("finds a film by its id or by an alias", () => {
    expect(findFilm(FILMS, "e")?.id).toBe("e");
    expect(findFilm(FILMS, "e-2")?.id).toBe("e");
    expect(findFilm(FILMS, "nope")).toBeUndefined();
    expect(findFilm(FILMS, "")).toBeUndefined();
  });
});

describe("times", () => {
  it("reads a start time", () => {
    expect(parseSeconds("90")).toBe(90);
    expect(parseSeconds("1:30")).toBe(90);
    expect(parseSeconds("1m30s")).toBe(90);
    expect(parseSeconds("90s")).toBe(90);
    expect(parseSeconds("1:02:03")).toBe(3723);
    expect(parseSeconds("abc")).toBe(0);
    expect(parseSeconds("")).toBe(0);
    expect(parseSeconds(null)).toBe(0);
    expect(parseSeconds("-5")).toBe(0);
    expect(parseSeconds("44.58")).toBe(44.6);
    expect(parseSeconds("500", 100)).toBe(99);
  });

  it("finds the scene that holds a time", () => {
    const chapters = FILMS[4]!.chapters;
    expect(chapterAt(chapters, 0)).toBe(0);
    expect(chapterAt(chapters, 33.9)).toBe(0);
    expect(chapterAt(chapters, 34)).toBe(1);
    expect(chapterAt(chapters, 400)).toBe(1);
    expect(chapterAt([], 5)).toBe(-1);
  });

  it("writes clocks and runtimes", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65)).toBe("1:05");
    expect(clock(3723)).toBe("1:02:03");
    expect(clock(180.8)).toBe("3:00");
    expect(runtimeWords(45)).toBe("45 s");
    expect(runtimeWords(100)).toBe("1 min 40 s");
    expect(runtimeWords(1683)).toBe("28 min");
    expect(runtimeWords(7500)).toBe("2 h 5 min");
  });
});

describe("words and addresses", () => {
  it("writes sizes and dates", () => {
    expect(sizeWords(154 * 1024 ** 2)).toBe("154 MB");
    expect(sizeWords(1.5 * 1024 ** 3)).toBe("1.5 GB");
    expect(dateWords("2026-09-26")).toBe("26 Sep 2026");
    expect(dateWords(undefined)).toBe("");
  });

  it("adds a start time to the address only when there is one", () => {
    const f = FILMS[0]!;
    expect(videoUrlAt(f, 0)).toMatch(/films\/a\/video\.mp4$/u);
    expect(videoUrlAt(f, 12.7)).toMatch(/films\/a\/video\.mp4#t=12\.7$/u);
    const local = film({
      id: "z",
      kind: "drama",
      video: { ...f.video, src: "", local: "/video/vexana/drama/1.mp4" },
    });
    expect(videoUrlAt(local, 5)).toBe("/video/vexana/drama/1.mp4#t=5");
  });
});

describe("loading list", () => {
  it("takes the featured poster and the first row for the first screen", () => {
    const first = firstScreenKeys(FILMS, "a", 1);
    expect(first).toEqual(["films/a/poster/p.webp", "films/a/poster/t.webp"]);
  });

  it("leaves every other thumbnail for the background", () => {
    const rest = restKeys(FILMS, "a", 1);
    expect(rest).toHaveLength(FILMS.length - 1);
    expect(rest).not.toContain("films/a/poster/t.webp");
  });
});
