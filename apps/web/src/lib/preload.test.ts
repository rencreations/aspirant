import { describe, expect, it, vi } from "vitest";

import { runPreload, type PreloadItem, type PreloadProgress } from "./preload";

const item = (id: string, weight: number, run: () => Promise<unknown>): PreloadItem => ({
  id,
  label: `Loading ${id}`,
  weight,
  run,
});

describe("runPreload", () => {
  it("reports real progress by weight and ends at 1", async () => {
    const seen: PreloadProgress[] = [];
    await runPreload(
      [
        item("a", 1, () => Promise.resolve()),
        item("b", 3, () => new Promise((r) => setTimeout(r, 5))),
      ],
      (p) => seen.push(p),
    );
    expect(seen[0]?.progress).toBe(0);
    expect(seen.at(-1)?.progress).toBe(1);
    expect(seen.at(-1)?.label).toBe("Ready");
    const values = seen.map((p) => p.progress);
    expect([...values].sort((x, y) => x - y)).toEqual(values);
  });

  it("names the heaviest pending item", async () => {
    const seen: PreloadProgress[] = [];
    await runPreload(
      [
        item("small", 1, () => Promise.resolve()),
        item("big", 5, () => new Promise((r) => setTimeout(r, 5))),
      ],
      (p) => seen.push(p),
    );
    expect(seen[0]?.label).toBe("Loading big");
  });

  it("does not block on a failing item", async () => {
    const onProgress = vi.fn();
    await runPreload([item("bad", 1, () => Promise.reject(new Error("nope")))], onProgress);
    expect(onProgress).toHaveBeenLastCalledWith(expect.objectContaining({ progress: 1 }));
  });

  it("runs an item once even if listed twice", async () => {
    const run = vi.fn(() => Promise.resolve());
    await runPreload([item("same", 1, run), item("same", 1, run)]);
    await runPreload([item("same", 1, run)]);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
