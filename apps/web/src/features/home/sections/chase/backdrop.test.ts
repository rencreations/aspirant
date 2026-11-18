import { describe, expect, it } from "vitest";

import { backdropAt } from "./backdrop";
import { T } from "./timeline";

describe("the chase's backdrop", () => {
  it("streaks while she chases, a soft sky while she pants, halftone while she reads", () => {
    expect(backdropAt(0.2).kind).toBe("speed-lines");
    expect(backdropAt(T.tetraTo - 0.03).kind).toBe("speed-lines");
    expect(backdropAt(T.tetraTo).kind).toBe("soft-aurora");
    expect(backdropAt(T.zoomFrom - 0.01).kind).toBe("soft-aurora");
    expect(backdropAt(T.comic).kind).toBe("pixel-blast");
  });

  it("ends on the ask the bend section starts with, so the joint has no cross-fade", () => {
    expect(backdropAt(T.comic).options).toMatchObject({ amount: 0.5, speed: 0.7 });
  });
});
