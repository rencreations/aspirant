import { describe, expect, it } from "vitest";

import { ActorRegistry } from "./actors";
import type { Actor, FrameInfo } from "./types";

const frame: FrameInfo = {
  time: 1,
  dt: 0.016,
  S: 0,
  raw: 0,
  velocity: 0,
  viewport: { w: 100, h: 100, dpr: 1 },
  frame: 1,
  input: { wheel: 0 },
};

describe("ActorRegistry", () => {
  it("steps only the actors that are shown", () => {
    const registry = new ActorRegistry();
    const steps: string[] = [];
    const make = (name: string): Actor => ({
      name,
      visible: false,
      update: () => steps.push(name),
    });
    const a = registry.register(make("a"));
    registry.register(make("b"));
    registry.register({ name: "plain", visible: true });
    a.visible = true;
    registry.update(frame);
    expect(steps).toEqual(["a"]);
  });

  it("refuses a second actor of one name", () => {
    const registry = new ActorRegistry();
    registry.register({ name: "a", visible: false });
    expect(() => registry.register({ name: "a", visible: false })).toThrow();
  });
});
