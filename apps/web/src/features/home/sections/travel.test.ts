import { expect, it } from "vitest";

import type { FrameInfo } from "../kernel/types";
import { ScrollTravel } from "./travel";

function frame(S: number, velocity = 0): FrameInfo {
  return {
    S,
    raw: S,
    velocity,
    dt: 1 / 60,
    time: 0,
    frame: 0,
    input: { wheel: 0 },
    viewport: { w: 1440, h: 900, dpr: 1 },
  };
}

it("turns smoothly on reversal and holds formation at rest", () => {
  const travel = new ScrollTravel();
  travel.update(frame(1), false);
  travel.update(frame(1.1), false);
  travel.update(frame(1.08), false);
  expect(travel.heading).toBeGreaterThan(-1);
  expect(travel.heading).toBeLessThan(1);
  const formation = travel.reverse;
  expect(formation).toBeGreaterThan(0);
  for (let i = 0; i < 60; i++) travel.update(frame(1.08), false);
  expect(travel.reverse).toBe(formation);
  expect(travel.runYaw(-1)).toBeGreaterThan(0);
  expect(travel.runYaw(1)).toBeLessThan(0);
  travel.update(frame(1.1), false);
  expect(travel.reverse).toBeLessThan(formation);
});

it("uses the arrival side when reentering a scene without input", () => {
  const travel = new ScrollTravel();
  travel.update(frame(3), true);
  expect(travel.heading).toBe(-1);
  expect(travel.reverse).toBe(1);
  travel.reset();
  travel.update(frame(0), false);
  expect(travel.heading).toBe(1);
  expect(travel.reverse).toBe(0);
});
