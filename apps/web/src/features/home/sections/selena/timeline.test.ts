import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { AT_ENTER, AT_FILM, REST_U, REST_V, SELENA_PLAYS, STORY } from "./stations";
import {
  AT,
  DOLL_T,
  FILM_END,
  FILM_KEYS,
  WORD_IN,
  beatsAt,
  filmTime,
  newBeats,
  selenaScreens,
  storyAtFilm,
} from "./timeline";

describe("the plays", () => {
  it("are a valid table that starts at the list's end and ends at the white", () => {
    expect(() => {
      validatePlays("selena", SELENA_PLAYS);
    }).not.toThrow();
    expect(SELENA_PLAYS[0]!.from).toBe(0);
    expect(SELENA_PLAYS[0]!.to).toBe(REST_V);
    expect(SELENA_PLAYS[1]!.to).toBe(1);
  });

  it("run one story unit a second, so a beat in `u` is a beat in seconds", () => {
    for (const p of SELENA_PLAYS) expect(p.seconds).toBeCloseTo((p.to - p.from) * STORY, 9);
  });

  it("keep every scene short: nothing holds the visitor for more than about four seconds", () => {
    for (const p of SELENA_PLAYS) expect(p.seconds).toBeLessThanOrEqual(4);
    expect(SELENA_PLAYS[0]!.seconds).toBeLessThanOrEqual(1.2);
  });

  it("fire the film at least half a screen before the end (the voices' lead is not touched)", () => {
    expect(AT_FILM).toBeLessThanOrEqual(1 - 0.5 / selenaScreens() + 1e-9);
    expect(AT_ENTER).toBeLessThan(AT_FILM);
  });

  it("leave a dwell of at least 0.6 screen in the room between the two", () => {
    expect((AT_FILM - AT_ENTER) * selenaScreens()).toBeGreaterThanOrEqual(0.6);
  });
});

describe("the clip time", () => {
  it("is 0 before the first key and the end of the clip after the last", () => {
    expect(filmTime(-1)).toBe(0);
    expect(filmTime(FILM_KEYS[0]![0])).toBe(0);
    expect(filmTime(STORY)).toBe(FILM_END);
    expect(filmTime(FILM_KEYS[FILM_KEYS.length - 1]![0])).toBeCloseTo(FILM_END, 9);
  });

  it("never runs backward and is continuous across the keys", () => {
    let last = -1;
    for (let u = 2; u <= STORY; u += 0.002) {
      const t = filmTime(u);
      expect(t).toBeGreaterThanOrEqual(last - 1e-9);
      if (last >= 0) expect(t - last).toBeLessThan(0.02);
      last = t;
    }
  });

  it("is the inverse of the story time for a clip time", () => {
    for (const t of [0, 0.6, 1.2, 2.6, 3.0, 3.5, 3.9]) {
      expect(filmTime(storyAtFilm(t))).toBeCloseTo(t, 6);
    }
  });

  it("plays the dragon's pass slower than real time and the hover faster", () => {
    const rate = (a: number, b: number) => (filmTime(b) - filmTime(a)) / (b - a);
    expect(rate(REST_U + 0.95, REST_U + 1.5)).toBeGreaterThan(1.5);
    const last = FILM_KEYS[FILM_KEYS.length - 1]![0];
    expect(rate(last - 0.5, last)).toBeLessThan(1);
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
  const at = (u: number, tail = 0) => beatsAt(u, newBeats(), tail);

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

  it("is a composed room at the rest: the drawer open, the dragon in, the words shown, live", () => {
    const b = at(REST_U);
    expect(b.drawer).toBe(1);
    expect(b.dragon).toBe(1);
    expect(b.doll).toBe(0);
    expect(b.camera).toBe(0);
    expect(b.live).toBe(true);
    // The words of the drawer are all in before the rest.
    for (let i = 0; i < 3; i++) expect(AT.words[0] + i * 0.1 + WORD_IN).toBeLessThanOrEqual(REST_U);
    expect(AT.dragon[1]).toBeLessThanOrEqual(REST_U);
    expect(AT.drawer[1]).toBeLessThanOrEqual(REST_U);
  });

  it("has the drawer open wherever the dwell stands, so a keyboard focus lands in the room", () => {
    expect(REST_V).toBeGreaterThan(0);
    expect(at(REST_V * STORY).drawer).toBe(1);
  });

  it("is not live once the film's play has begun", () => {
    expect(at(REST_U + 0.05).live).toBe(false);
  });

  it("lets the doll fall before the camera is done", () => {
    expect(AT.doll[0]).toBeLessThanOrEqual(AT.camera[0]);
    expect(AT.doll[1]).toBeLessThanOrEqual(AT.camera[1]);
    expect(at(AT.camera[0]).doll).toBeGreaterThan(0.2);
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

  it("starts the white on the bite and has it whole before the head reaches the lens", () => {
    // The clip's 3.7 s is where the dragon's head is at the lens (`BAKED.pass.outAt` less a little).
    expect(filmTime(AT.white[0])).toBeGreaterThanOrEqual(DOLL_T.bite - 0.1);
    expect(filmTime(AT.white[1])).toBeLessThanOrEqual(3.8);
  });

  it("is white, with nothing drawn, on the first screen of the voices", () => {
    const b = at(STORY);
    expect(b.white).toBe(1);
    expect(b.actors).toBe(false);
    expect(b.front).toBe(0);
    expect(b.whiteOut).toBe(0);
    // The white over the canvas hands over to the one under it before the story ends.
    expect(AT.frontOut[1]).toBe(STORY);
  });

  it("leaves the white layer in the tail, after the ground behind it is the voices' own", () => {
    expect(at(STORY, 0.2).whiteOut).toBe(0);
    expect(at(STORY, AT.whiteOut[1]).whiteOut).toBe(1);
    // The kernel's ground is the next section's from a quarter screen after the joint.
    expect(AT.whiteOut[0]).toBeGreaterThanOrEqual(0.25);
  });

  it("gives the same beats for the same position (a jump is a played scene)", () => {
    const a = beatsAt(2.9, newBeats());
    const scratch = newBeats();
    for (let u = 0; u < 2.9; u += 0.1) beatsAt(u, scratch);
    expect(beatsAt(2.9, scratch)).toEqual(a);
  });
});
