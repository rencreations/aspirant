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

describe("runPreload byte progress", () => {
  it("moves with the fraction an item reports before it ends", async () => {
    const seen: number[] = [];
    let release: () => void = () => undefined;
    const done = runPreload(
      [
        {
          id: "download",
          label: "Loading a download",
          weight: 4,
          run: (report) =>
            new Promise<void>((resolve) => {
              report(0.25);
              report(0.5);
              release = resolve;
            }),
        },
        item("quick", 4, () => Promise.resolve()),
      ],
      (p) => seen.push(p.progress),
    );
    await new Promise((r) => setTimeout(r, 150));
    expect(seen.some((v) => Math.abs(v - 0.75) < 1e-9)).toBe(true);
    release();
    await done;
    expect(seen.at(-1)).toBe(1);
  });

  it("remembers an item for the session, unless it opts out (media is freed and loaded again)", async () => {
    const kept = vi.fn(() => Promise.resolve());
    const again = vi.fn(() => Promise.resolve());
    await runPreload([item("kept-once", 1, kept)]);
    await runPreload([item("kept-once", 1, kept)]);
    expect(kept).toHaveBeenCalledTimes(1);

    const media = (): PreloadItem => ({ ...item("media-twice", 1, again), memo: false });
    await runPreload([media()]);
    await runPreload([media()]);
    expect(again).toHaveBeenCalledTimes(2);
  });
});
