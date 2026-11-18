import { describe, expect, it } from "vitest";

import { duoItems } from "./preload";

describe("duoItems", () => {
  it("lists the code and the model, the model by its real size", () => {
    const items = duoItems({ deferred: false });
    expect(items.map((i) => i.id)).toEqual(["chunk:home-duo", "media:/models/about/companion.glb"]);
    // 241,420 bytes rounds to a weight of 1.
    expect(items[1]?.weight).toBe(1);
    expect(items.every((i) => !i.deferred)).toBe(true);
  });

  it("is deferred with a priority unless a section asks to wait for it", () => {
    for (const item of duoItems()) {
      expect(item.deferred).toBe(true);
      expect(item.priority).toBe(30);
    }
    for (const item of duoItems({ priority: 5 })) expect(item.priority).toBe(5);
  });
});
