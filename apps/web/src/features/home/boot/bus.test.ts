import { describe, expect, it } from "vitest";

import { bootBus, resetBootBus } from "./bus";

describe("the boot bus", () => {
  it("starts with no scene and nothing shown", () => {
    resetBootBus();
    expect(bootBus).toEqual({
      stage: "none",
      droneShown: false,
      introT: -1,
      pressOnDrone: false,
    });
  });

  it("a reset clears everything", () => {
    bootBus.stage = "ready";
    bootBus.droneShown = true;
    bootBus.introT = 4;
    bootBus.pressOnDrone = true;
    resetBootBus();
    expect(bootBus.stage).toBe("none");
    expect(bootBus.pressOnDrone).toBe(false);
    expect(bootBus.introT).toBe(-1);
  });
});
