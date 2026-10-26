import { beforeEach, describe, expect, it, vi } from "vitest";

import { comicStreamHooks, interludeComicHooks, registerComic } from "./comic-link";
import type { ComicApi } from "./comic-link";
import { toneHint } from "./gates";

vi.mock("@/lib/perf", () => ({ perfLevel: () => "full" }));

function fakeComic() {
  const calls: string[] = [];
  const api: ComicApi = {
    calm: (wait) => {
      calls.push(`calm ${String(wait ?? true)}`);
      return Promise.resolve();
    },
    release: () => calls.push("release"),
    pin: (on) => calls.push(`pin ${String(on)}`),
    show: (what) => calls.push(`show ${what}`),
    slideOut: (s) => {
      calls.push(`slideOut ${String(s)}`);
      return Promise.resolve();
    },
    slideIn: (s) => {
      calls.push(`slideIn ${String(s > 0)}`);
      return Promise.resolve();
    },
    enter: () => {
      calls.push("enter");
      return Promise.resolve();
    },
    rest: () => calls.push("rest"),
    decoded: () => {
      calls.push("decoded");
      return Promise.resolve();
    },
  };
  return { api, calls };
}

describe("the doors around the comic", () => {
  let off: () => void;
  let calls: string[];

  beforeEach(() => {
    off?.();
    toneHint.set(null);
    const fake = fakeComic();
    calls = fake.calls;
    off = registerComic(fake.api);
  });

  it("puts the comic to nothing under the dark doors, then plays its entrance", async () => {
    await interludeComicHooks.ready?.("down");
    interludeComicHooks.covered?.("down");
    await interludeComicHooks.arrival?.("down");
    expect(calls).toEqual(["decoded", "rest", "show nothing", "enter"]);
  });

  it("lets the pointer's choice go without waiting when the comic is left upwards", async () => {
    await interludeComicHooks.leave?.("up");
    expect(calls).toEqual(["calm false"]);
  });

  it("shows the comic as it is meant to be seen to a page opened on its side", () => {
    interludeComicHooks.settle?.("after");
    interludeComicHooks.settle?.("before");
    expect(calls).toEqual(["show all", "rest", "show nothing"]);
  });

  it("opens the halves out of the comic going down, and closes the stage back after", async () => {
    await comicStreamHooks.leave?.("down");
    await comicStreamHooks.arrival?.("down");
    expect(calls).toEqual(["calm true", "pin true", "slideOut 0.95", "pin false"]);
    expect(toneHint.get()).toBe("dark");
  });

  it("brings the halves in over the livestream going up, then lets the words come", async () => {
    await comicStreamHooks.leave?.("up");
    comicStreamHooks.covered?.("up");
    await comicStreamHooks.arrival?.("up");
    expect(calls).toEqual([
      "calm false",
      "show disc",
      "pin true",
      "slideOut 0",
      "slideIn true",
      "pin false",
      "enter",
      "release",
    ]);
  });

  it("does nothing when the comic is not mounted", async () => {
    off();
    await expect(comicStreamHooks.leave?.("down")).resolves.toBeUndefined();
    expect(await interludeComicHooks.arrival?.("down")).toBeUndefined();
  });
});
