import { describe, expect, it } from "vitest";

import { logoItems } from "./preload";

describe("logoItems", () => {
  it("is one waited item: the actor's code and the drawing of its big picture", () => {
    const items = logoItems();
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item?.id).toBe("chunk:home-logo");
    expect(item?.deferred).toBeFalsy();
    expect(typeof item?.run).toBe("function");
  });

  it("says what it does in words a visitor can read", () => {
    const [item] = logoItems();
    expect(item?.label).toMatch(/logo/i);
  });
});
