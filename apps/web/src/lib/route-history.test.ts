import { describe, expect, it } from "vitest";

import { noteRoute, routeBefore } from "./route-history";

describe("route history", () => {
  it("knows nothing on a fresh load, then the page before", () => {
    expect(routeBefore("/character")).toBeNull();
    noteRoute("/");
    // Asked while the page change to /character is starting: the page now shown is the origin.
    expect(routeBefore("/character")).toBe("/");
    noteRoute("/character");
    // Asked after it has been noted: the one before.
    expect(routeBefore("/character")).toBe("/");
    noteRoute("/character");
    expect(routeBefore("/character")).toBe("/");
    noteRoute("/character/selena");
    expect(routeBefore("/character")).toBe("/character/selena");
    noteRoute("/character");
    expect(routeBefore("/character")).toBe("/character/selena");
  });
});
