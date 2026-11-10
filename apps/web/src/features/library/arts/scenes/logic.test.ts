import { describe, expect, it } from "vitest";

import { FILM_IDS } from "../../video/links";
import {
  clock,
  columnsFor,
  currentIndex,
  estimateHeight,
  filterFilms,
  formatDuration,
  fractionOf,
  groupScenes,
  hasSceneFilters,
  nearestIndex,
  NO_SCENE_FILTERS,
  sceneFacets,
  sceneSummary,
  watchHref,
} from "./logic";
import type { Scene, SceneFilm } from "./types";

const img = { t: "a/t.webp", p: "a/p.webp", f: "a/f.webp", w: 1920, h: 1080, c: "#000000" };

function scene(n: number, t: number, note: string, beat: number | null): Scene {
  return { id: `s-${n}`, t, time: clock(t), note, img, beat };
}

function film(id: string, over: Partial<SceneFilm> = {}): SceneFilm {
  return {
    id,
    title: id,
    pair: "fanny-layla",
    chars: ["fanny", "layla"],
    kind: "trailer",
    duration: 100,
    w: 1920,
    h: 1080,
    beats: [
      { i: 1, from: 0, to: 40, note: "A dark corridor" },
      { i: 2, from: 40, to: 100, note: "A bright city at dawn" },
    ],
    scenes: [
      scene(1, 5, "A dark corridor", 1),
      scene(2, 20, "A dark corridor", 1),
      scene(3, 50, "A bright city at dawn", 2),
      scene(4, 90, "A bright city at dawn", 2),
    ],
    poster: 0,
    ...over,
  };
}

const films = [
  film("film-a"),
  film("film-b", {
    pair: "ruby-angela",
    chars: ["ruby", "angela"],
    kind: "character film",
    beats: [],
  }),
];

describe("filterFilms", () => {
  it("keeps everything with no filters", () => {
    const shown = filterFilms(films, NO_SCENE_FILTERS);
    expect(shown).toHaveLength(2);
    expect(shown[0]?.scenes).toHaveLength(4);
    expect(hasSceneFilters(NO_SCENE_FILTERS)).toBe(false);
  });

  it("filters by character, pair and film", () => {
    expect(filterFilms(films, { ...NO_SCENE_FILTERS, who: "ruby" }).map((s) => s.film.id)).toEqual([
      "film-b",
    ]);
    expect(
      filterFilms(films, { ...NO_SCENE_FILTERS, pair: "fanny-layla" }).map((s) => s.film.id),
    ).toEqual(["film-a"]);
    expect(
      filterFilms(films, { ...NO_SCENE_FILTERS, film: "film-b" }).map((s) => s.film.id),
    ).toEqual(["film-b"]);
  });

  it("searches the note, the title and the time, every word", () => {
    const dawn = filterFilms(films, { ...NO_SCENE_FILTERS, q: "city DAWN" });
    expect(dawn[0]?.scenes.map((s) => s.id)).toEqual(["s-3", "s-4"]);
    const time = filterFilms(films, { ...NO_SCENE_FILTERS, q: "01:30" });
    expect(time.map((s) => s.scenes.map((x) => x.time))).toEqual([["01:30"], ["01:30"]]);
    expect(filterFilms(films, { ...NO_SCENE_FILTERS, q: "nothing like this" })).toEqual([]);
  });

  it("can leave one filter out", () => {
    const f = { ...NO_SCENE_FILTERS, who: "ruby", pair: "fanny-layla" };
    expect(filterFilms(films, f)).toEqual([]);
    expect(filterFilms(films, f, "who").map((s) => s.film.id)).toEqual(["film-a"]);
  });
});

describe("groupScenes", () => {
  it("groups by section in time order", () => {
    const groups = groupScenes(films[0]!, films[0]!.scenes);
    expect(groups.map((g) => [g.key, g.scenes.length, g.beat?.note])).toEqual([
      ["b1", 2, "A dark corridor"],
      ["b2", 2, "A bright city at dawn"],
    ]);
  });

  it("gives a film without sections one group, and none for no stills", () => {
    expect(groupScenes(films[1]!, films[1]!.scenes)).toHaveLength(1);
    expect(groupScenes(films[1]!, [])).toEqual([]);
  });
});

describe("sceneFacets", () => {
  it("counts stills with the other filters kept", () => {
    const facets = sceneFacets(films, { ...NO_SCENE_FILTERS, pair: "ruby-angela" });
    expect(facets.who.ruby).toBe(4);
    // The pair filter itself is left out of the pair counts.
    expect(facets.pair["fanny-layla"]).toBe(4);
    expect(facets.film["film-b"]).toBe(4);
  });
});

describe("summary and formats", () => {
  it("says what is shown", () => {
    const all = filterFilms(films, NO_SCENE_FILTERS);
    expect(sceneSummary(all, 8, false)).toBe("8 stills in 2 films");
    const some = filterFilms(films, { ...NO_SCENE_FILTERS, film: "film-a" });
    expect(sceneSummary(some, 8, true)).toBe("4 of 8 stills in 1 film");
  });

  it("formats times", () => {
    expect(formatDuration(100.4)).toBe("1:40");
    expect(formatDuration(9)).toBe("0:09");
    expect(clock(75.9)).toBe("01:15");
    // A film that is not one of the ten goes to the Others room, one of the ten to Films.
    expect(watchHref("film-a", 75.9)).toBe("/collection/video/others?i=film-a&t=75");
    expect(watchHref(FILM_IDS[3], 12)).toBe(`/collection/video/films?i=${FILM_IDS[3]}&t=12`);
  });
});

describe("the scrubber", () => {
  const scenes = films[0]!.scenes;

  it("places a time on the film", () => {
    expect(fractionOf(25, 100)).toBe(0.25);
    expect(fractionOf(500, 100)).toBe(1);
    expect(fractionOf(5, 0)).toBe(0);
  });

  it("finds the nearest still", () => {
    expect(nearestIndex(scenes, 0, 100)).toBe(0);
    expect(nearestIndex(scenes, 0.45, 100)).toBe(2);
    expect(nearestIndex(scenes, 1, 100)).toBe(3);
    expect(nearestIndex([], 0.5, 100)).toBe(-1);
  });

  it("finds the still at the reading line", () => {
    const bottoms = [100, 100, 100, 220, 220, 220, 340];
    expect(currentIndex(bottoms, 50)).toBe(0);
    expect(currentIndex(bottoms, 100)).toBe(3);
    expect(currentIndex(bottoms, 219)).toBe(3);
    expect(currentIndex(bottoms, 900)).toBe(6);
    expect(currentIndex([], 10)).toBe(-1);
  });
});

describe("layout", () => {
  it("fits columns", () => {
    expect(columnsFor(1000, 176, 0)).toBe(5);
    expect(columnsFor(100, 176, 0)).toBe(1);
  });

  it("estimates a taller section when there are more stills or a narrower page", () => {
    const many = film("film-many", {
      scenes: Array.from({ length: 40 }, (_, i) => scene(i, i * 2, "", null)),
      beats: [],
    });
    const shown = filterFilms([many], NO_SCENE_FILTERS)[0]!;
    const wide = estimateHeight(shown, 1200, "strips");
    const narrow = estimateHeight(shown, 360, "strips");
    expect(narrow).toBeGreaterThan(wide);
    expect(estimateHeight(shown, 1200, "sheet")).toBeLessThan(wide);
    expect(wide).toBeGreaterThan(200);
  });
});
