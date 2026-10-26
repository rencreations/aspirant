import { describe, expect, it } from "vitest";

import { ACTIONS } from "./spots";

describe("the room's actions", () => {
  it("are three, each with its own short and its own label", () => {
    expect(ACTIONS).toHaveLength(3);
    expect(new Set(ACTIONS.map((a) => a.short)).size).toBe(3);
    expect(new Set(ACTIONS.map((a) => a.label)).size).toBe(3);
    expect(ACTIONS.map((a) => a.label)).toEqual(["Action 1", "Action 2", "Action 3"]);
  });

  it("play the face, the left hand and the Guardian, in that order", () => {
    expect(ACTIONS.map((a) => a.short)).toEqual(["short-1", "short-2", "short-3"]);
  });
});
