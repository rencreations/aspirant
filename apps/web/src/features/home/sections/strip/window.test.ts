import { describe, expect, it } from "vitest";

import filmsFile from "../../../../../public/data/library/video-films.json";
import { TRAILER_FILM } from "../../fx/video-plane/data";
import {
  expandBox,
  sceneBox,
  stripLook,
  windowBox,
  WINDOW_ASPECT,
} from "../../fx/video-plane/layout";
import { DEFAULT_STATE } from "../../fx/video-plane/types";

import { filmStateAt } from "./film-state";
import { STORY } from "../story";

const SIZES: Array<[number, number]> = [
  [1440, 900],
  [1706, 950],
  [1920, 1080],
  [1280, 720],
];

describe("the window takes the film's own shape (no crop)", () => {
  it("is the shape of the collection's file", () => {
    const film = filmsFile.items.find((f) => f.id === TRAILER_FILM.id)!;
    expect(TRAILER_FILM.aspect).toBeCloseTo(film.video.w / film.video.h, 9);
  });

  it("opens to a box with the film's ratio, as wide as the scene", () => {
    for (const [w, h] of SIZES) {
      const box = windowBox(w, h, TRAILER_FILM.aspect);
      expect(box.w / box.h, `${w}x${h}`).toBeCloseTo(TRAILER_FILM.aspect, 6);
      expect(box.w).toBeCloseTo(sceneBox(w, h).w, 6);
    }
  });

  it("keeps the strip at 3.70 to 1 whatever the window's shape", () => {
    for (const [w, h] of SIZES) {
      const a = expandBox(w, h, 0, WINDOW_ASPECT);
      const b = expandBox(w, h, 0, TRAILER_FILM.aspect);
      expect(a.w / a.h).toBeCloseTo(3.7, 1);
      expect(b.w / b.h).toBeCloseTo(a.w / a.h, 6);
      expect(b.w).toBeCloseTo(a.w, 6);
    }
  });

  it("is 1120 by 471 at 1440 by 900 and 504 by 136 for the strip", () => {
    const open = expandBox(1440, 900, 1, TRAILER_FILM.aspect);
    expect(open.w).toBeCloseTo(1120, 3);
    expect(open.h).toBeCloseTo(1120 / TRAILER_FILM.aspect, 3);
    const strip = expandBox(1440, 900, 0, TRAILER_FILM.aspect);
    expect(strip.w).toBeCloseTo(504, 3);
    expect(strip.h).toBeCloseTo(136.2, 0);
  });

  it("grows smoothly and never shrinks on the way", () => {
    let last = 0;
    for (let e = 0; e <= 1.0001; e += 0.05) {
      const box = expandBox(1440, 900, e, TRAILER_FILM.aspect);
      expect(box.w).toBeGreaterThanOrEqual(last - 1e-6);
      last = box.w;
    }
  });

  it("leaves the 16 to 9 default as it was (the reference's inset)", () => {
    expect(stripLook(1440, 900).inset).toBeCloseTo(0.2597, 6);
    expect(stripLook(1440, 900, WINDOW_ASPECT).inset).toBeCloseTo(0.2597, 6);
    expect(stripLook(390, 844).inset).toBeCloseTo(0.2198, 6);
    expect(stripLook(1440, 900, TRAILER_FILM.aspect).inset).toBeCloseTo(0.179, 2);
    expect(DEFAULT_STATE.aspect).toBeCloseTo(WINDOW_ASPECT, 9);
  });

  it("is set by the film's state for the rows and the strip alike (nothing jumps at J3)", () => {
    const a = filmStateAt(STORY.rows.start + 0.5, 0, { ...DEFAULT_STATE });
    const b = filmStateAt(STORY.strip.start + 1.2, 0, { ...DEFAULT_STATE });
    expect(a.aspect).toBe(TRAILER_FILM.aspect);
    expect(b.aspect).toBe(TRAILER_FILM.aspect);
  });
});
