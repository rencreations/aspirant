import { describe, expect, it, vi } from "vitest";

import {
  cancelDeferred,
  capWait,
  runPreload,
  type PreloadItem,
  type PreloadProgress,
} from "./preload";

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

describe("deferred items", () => {
  /** An item that stays running until it is let go. */
  function held(id: string, extra: Partial<PreloadItem> = {}) {
    let release: () => void = () => undefined;
    const started = vi.fn();
    const it: PreloadItem = {
      id,
      label: id,
      weight: 1,
      deferred: true,
      run: () =>
        new Promise<void>((resolve) => {
          started();
          release = resolve;
        }),
      ...extra,
    };
    return { it, started, release: () => release() };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("are not waited for, and start once the rest is in, three at a time, nearest need first", async () => {
    const first = held("d-first", { priority: 10 });
    const late = held("d-late", { priority: 40 });
    const mid = held("d-mid", { priority: 20 });
    const mid2 = held("d-mid2", { priority: 20 });
    const now = vi.fn(() => Promise.resolve());
    const seen: PreloadProgress[] = [];
    await runPreload([late.it, item("d-now", 1, now), mid.it, first.it, mid2.it], (p) =>
      seen.push(p),
    );
    // The loading bar was only about the item that was not deferred.
    expect(now).toHaveBeenCalledTimes(1);
    expect(seen.at(-1)?.progress).toBe(1);
    await tick();
    expect(first.started).toHaveBeenCalledTimes(1);
    expect(mid.started).toHaveBeenCalledTimes(1);
    expect(mid2.started).toHaveBeenCalledTimes(1);
    expect(late.started).not.toHaveBeenCalled();
    // One finishes, and the next in line takes its place.
    first.release();
    await tick();
    expect(late.started).toHaveBeenCalledTimes(1);
    for (const h of [mid, mid2, late]) h.release();
    await tick();
  });

  it("are not started twice when a list is asked for again, whatever wide the queue is", async () => {
    const a = held("e-a");
    const b = held("e-b");
    const c = held("e-c");
    const d = held("e-d");
    await runPreload([a.it, b.it, c.it, d.it]);
    await runPreload([a.it, b.it, c.it, d.it]);
    await tick();
    expect(a.started).toHaveBeenCalledTimes(1);
    expect(d.started).not.toHaveBeenCalled();
    for (const h of [a, b, c]) h.release();
    await tick();
    expect(d.started).toHaveBeenCalledTimes(1);
    d.release();
    await tick();
  });

  it("can be dropped for one group while they wait, and are asked for again next time", async () => {
    const blockers = [held("f-1"), held("f-2"), held("f-3")];
    const mine = held("f-mine", { group: "selena" });
    const other = held("f-other", { group: "obsidia" });
    await runPreload([...blockers.map((b) => b.it), mine.it, other.it]);
    await tick();
    cancelDeferred("selena");
    for (const b of blockers) b.release();
    await tick();
    expect(mine.started).not.toHaveBeenCalled();
    expect(other.started).toHaveBeenCalledTimes(1);
    other.release();
    await tick();
    await runPreload([mine.it]);
    await tick();
    expect(mine.started).toHaveBeenCalledTimes(1);
    mine.release();
    await tick();
  });
});

describe("capWait", () => {
  it("returns at once when the work is done, and at the cap when it is not", async () => {
    vi.useFakeTimers();
    try {
      let finish: () => void = () => undefined;
      const slow = new Promise<void>((resolve) => {
        finish = resolve;
      });
      let capped = false;
      void capWait(slow, 1000).then(() => {
        capped = true;
      });
      await vi.advanceTimersByTimeAsync(999);
      expect(capped).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect(capped).toBe(true);
      // The work itself was not cancelled.
      finish();
      await slow;
    } finally {
      vi.useRealTimers();
    }
  });
});
