import { describe, expect, it } from "vitest";

import { pickFilm } from "./hero-media";
import type { DesignHero } from "./types";

const hero: DesignHero = {
  poster: "design/hero/v1/poster.webp",
  pw: 1920,
  ph: 810,
  c: "#342d23",
  films: [
    { src: "design/hero/v1/loop-1280.mp4", w: 1280, h: 540, dur: 76.9, bytes: 11_800_000 },
    { src: "design/hero/v1/loop-1920.mp4", w: 1920, h: 810, dur: 76.9, bytes: 21_000_000 },
  ],
};

describe("the film behind the title", () => {
  it("gives the small film to a narrow display and the large one to the rest", () => {
    expect(pickFilm(hero, 390)?.w).toBe(1280);
    expect(pickFilm(hero, 699)?.w).toBe(1280);
    expect(pickFilm(hero, 700)?.w).toBe(1920);
    expect(pickFilm(hero, 2560)?.w).toBe(1920);
  });

  it("falls back to the only film there is, and to nothing", () => {
    expect(pickFilm({ ...hero, films: hero.films.slice(0, 1) }, 2560)?.w).toBe(1280);
    expect(pickFilm({ ...hero, films: [] }, 1440)).toBeUndefined();
  });
});
