import { describe, expect, it } from "vitest";

import { retryDelay, retryUrl } from "./retry-url";

describe("retryUrl", () => {
  it("adds a query to a path and keeps it relative", () => {
    expect(retryUrl("/img/vexana/art/a.webp", 1)).toBe("/img/vexana/art/a.webp?vxr=1");
  });
  it("replaces its own earlier query and keeps the others", () => {
    expect(retryUrl("/a.webp?v=3&vxr=1", 2)).toBe("/a.webp?v=3&vxr=2");
  });
  it("keeps an absolute address absolute and a hash in place", () => {
    expect(retryUrl("https://aspirant.cc/a.webp#x", 1)).toBe("https://aspirant.cc/a.webp?vxr=1#x");
  });
  it("gives back what it cannot read", () => {
    expect(retryUrl("", 1)).toBe("");
  });
});

describe("retryDelay", () => {
  it("waits longer each time", () => {
    expect(retryDelay(0)).toBeLessThan(retryDelay(1));
  });
});
