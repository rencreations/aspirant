import { describe, expect, it } from "vitest";

import { expectReady, whenPageReady } from "./page-ready";

describe("page ready", () => {
  it("resolves at once when nothing is pending", async () => {
    await expect(whenPageReady(1000)).resolves.toBeUndefined();
  });

  it("waits for a pending item and resolves after it is marked", async () => {
    const mark = expectReady("test-item");
    let done = false;
    const waited = whenPageReady(2000).then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 200));
    expect(done).toBe(false);
    mark();
    await waited;
    expect(done).toBe(true);
  });

  it("gives up after the cap", async () => {
    const mark = expectReady("stuck");
    const t0 = performance.now();
    await whenPageReady(250);
    expect(performance.now() - t0).toBeGreaterThanOrEqual(240);
    mark();
  });
});
