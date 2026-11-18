import { describe, expect, it } from "vitest";

import {
  AT,
  DOLL_T,
  FILM_END,
  FILM_KEYS,
  SELENA_SCREENS,
  beatsAt,
  filmTime,
  newBeats,
  screensAtFilm,
} from "./timeline";

describe("the clip time", () => {
  it("is 0 before the first key and the end of the clip after the last", () => {
    expect(filmTime(-1)).toBe(0);
    expect(filmTime(FILM_KEYS[0]![0])).toBe(0);
    expect(filmTime(SELENA_SCREENS)).toBe(FILM_END);
    expect(filmTime(FILM_KEYS[FILM_KEYS.length - 1]![0])).toBeCloseTo(FILM_END, 9);
  });

  it("never runs backward and is continuous across the keys", () => {
    let last = -1;
    for (let u = 2.5; u <= 3.7; u += 0.002) {
      const t = filmTime(u);
      expect(t).toBeGreaterThanOrEqual(last - 1e-9);
      if (last >= 0) expect(t - last).toBeLessThan(0.08);
      last = t;
    }
  });

  it("is the inverse of the scroll for a clip time", () => {
    for (const t of [0, 0.6, 1.2, 2.6, 3.0, 3.5, 3.9]) {
      expect(filmTime(screensAtFilm(t))).toBeCloseTo(t, 6);
    }
  });
});

describe("the order of the clip's events", () => {
  it("floats, flies, bites, then shuts the jaw, all before the dragon has left", () => {
    expect(DOLL_T.float).toBeLessThan(DOLL_T.fly);
    expect(DOLL_T.fly).toBeLessThan(DOLL_T.bite);
    expect(DOLL_T.jawOpen[0]).toBeLessThan(DOLL_T.jawOpen[1]);
    expect(DOLL_T.jawOpen[1]).toBeLessThanOrEqual(DOLL_T.bite);
    expect(DOLL_T.jawShut[0]).toBeGreaterThanOrEqual(DOLL_T.bite);
    expect(DOLL_T.jawShut[1]).toBeLessThan(FILM_END);
  });
});

describe("the beats", () => {
  const at = (u: number) => beatsAt(u, newBeats());

  it("starts as the list ends: nothing opened yet, the doll hanging, the pixel view", () => {
    for (const u of [-0.5, -0.1, 0]) {
      const b = at(u);
      expect(b.drawer).toBe(0);
      expect(b.dragon).toBe(0);
      expect(b.doll).toBe(0);
      expect(b.camera).toBe(0);
      expect(b.pose).toBe(0);
      expect(b.white).toBe(0);
      expect(b.live).toBe(true);
      expect(b.actors).toBe(true);
    }
  });

  it("has the drawer fully open where a keyboard focus lands (the middle of the section)", () => {
    expect(at(0.5 * SELENA_SCREENS).drawer).toBe(1);
    expect(AT.wordsOut[0]).toBeGreaterThan(0.5 * SELENA_SCREENS);
    expect(AT.drawerOut[0]).toBeGreaterThan(0.5 * SELENA_SCREENS);
  });

  it("rests, fully live, between the drawer's opening and the doll's release", () => {
    for (const u of [0.7, 1.2, 1.9, 1.99]) {
      const b = at(u);
      expect(b.drawer).toBe(1);
      expect(b.live).toBe(true);
      expect(b.doll).toBe(0);
      expect(b.camera).toBe(0);
    }
    expect(at(AT.restEnd).live).toBe(false);
  });

  it("lets the doll fall before the camera moves", () => {
    expect(AT.doll[0]).toBeLessThanOrEqual(AT.camera[0]);
    expect(AT.doll[1]).toBeLessThanOrEqual(AT.camera[1]);
    expect(at(AT.camera[0]).doll).toBeGreaterThan(0.3);
  });

  it("is the film once the camera has arrived, and the clip starts at the first key", () => {
    expect(at(AT.camera[1]).film).toBe(true);
    expect(at(AT.camera[1] - 0.05).film).toBe(false);
    expect(AT.camera[1]).toBeLessThanOrEqual(FILM_KEYS[0]![0]);
    expect(at(FILM_KEYS[0]![0]).t).toBe(0);
  });

  it("goes white behind the dragon, then over everything, and hides the actors at the end of it", () => {
    expect(at(AT.white[1]).white).toBe(1);
    expect(at(AT.white[0] - 0.01).white).toBe(0);
    expect(at(AT.front[0] - 0.01).front).toBe(0);
    expect(at(AT.front[1]).front).toBe(1);
    expect(at(AT.front[1]).actors).toBe(false);
    expect(at(AT.front[1] - 0.05).actors).toBe(true);
    expect(AT.white[1]).toBeLessThanOrEqual(AT.front[0] + 1e-9);
  });

  it("is white, with nothing drawn, on the first screen of the voices", () => {
    const b = at(SELENA_SCREENS - 0.01);
    expect(b.white).toBe(1);
    expect(b.actors).toBe(false);
    expect(b.front).toBeGreaterThan(0.99);
    expect(b.whiteOut).toBe(0);
    // The white over the canvas has handed over to the one under it before that one leaves.
    expect(AT.frontOut[1]).toBeLessThan(AT.whiteOut[0]);
  });

  it("leaves the white layer in the tail, after the ground behind it is the voices' own", () => {
    expect(at(AT.whiteOut[1]).whiteOut).toBe(1);
    // The kernel's ground is the next section's from a quarter screen after the joint.
    expect(AT.whiteOut[0]).toBeGreaterThanOrEqual(SELENA_SCREENS + 0.25);
  });

  it("gives the same beats for the same position (a jump is a slow scroll)", () => {
    const a = beatsAt(2.9, newBeats());
    const scratch = newBeats();
    for (let u = 0; u < 2.9; u += 0.1) beatsAt(u, scratch);
    expect(beatsAt(2.9, scratch)).toEqual(a);
  });
});
