import { vi } from "vitest";

import type { PreloadProgress } from "./preload";

const { unlock } = vi.hoisted(() => ({ unlock: vi.fn() }));
vi.mock("@/lib/audio", () => ({ audio: { unlock } }));

const {
  HOME_PHASES,
  bytesWords,
  listenForTap,
  phaseAtLeast,
  phaseIndex,
  pickPending,
  runHomeFlow,
  seedFor,
  selectHomeActive,
  selectIsOpen,
  shownPercent,
  stepShown,
  tapToContinue,
  useHomeFlow,
  whenHomePhase,
} = await import("./home-flow");

function reset(arrival: "document" | "site" | "off", phase: (typeof HOME_PHASES)[number]) {
  useHomeFlow.setState({
    arrival,
    phase,
    progress: null,
    notes: { slow: false, offline: false, retrying: false },
  });
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function progress(p: number, extra: Partial<PreloadProgress> = {}): PreloadProgress {
  return { progress: p, label: "Loading", pending: ["Loading"], ...extra };
}

beforeEach(() => {
  unlock.mockClear();
  reset("document", "cover");
});

describe("phases", () => {
  it("are in the order cover, boot, tap, intro, open", () => {
    expect(HOME_PHASES).toEqual(["cover", "boot", "tap", "intro", "open"]);
    expect(phaseIndex("tap")).toBe(2);
    expect(phaseAtLeast("intro", "tap")).toBe(true);
    expect(phaseAtLeast("boot", "tap")).toBe(false);
  });

  it("only move forward", () => {
    const s = useHomeFlow.getState();
    s.advance("tap");
    expect(useHomeFlow.getState().phase).toBe("tap");
    s.advance("boot");
    expect(useHomeFlow.getState().phase).toBe("tap");
  });

  it("go from tap to intro to open, and only in that order", () => {
    const s = useHomeFlow.getState();
    s.finishIntro();
    expect(useHomeFlow.getState().phase).toBe("cover");
    s.tap();
    expect(useHomeFlow.getState().phase).toBe("cover");
    s.advance("boot");
    s.tap();
    expect(useHomeFlow.getState().phase).toBe("boot");
    s.advance("tap");
    s.finishIntro();
    expect(useHomeFlow.getState().phase).toBe("tap");
    s.tap();
    expect(useHomeFlow.getState().phase).toBe("intro");
    s.advance("boot");
    expect(useHomeFlow.getState().phase).toBe("intro");
    s.finishIntro();
    expect(useHomeFlow.getState().phase).toBe("open");
    s.tap();
    s.advance("tap");
    expect(useHomeFlow.getState().phase).toBe("open");
  });

  it("open at once on abort, from any phase", () => {
    for (const phase of HOME_PHASES) {
      reset("document", phase);
      useHomeFlow.getState().abort();
      expect(useHomeFlow.getState().phase).toBe("open");
    }
  });

  it("have a derived isOpen and an active flag", () => {
    expect(selectIsOpen({ phase: "cover" })).toBe(false);
    expect(selectIsOpen({ phase: "open" })).toBe(true);
    expect(selectHomeActive({ arrival: "document", phase: "boot" })).toBe(true);
    expect(selectHomeActive({ arrival: "document", phase: "open" })).toBe(false);
    expect(selectHomeActive({ arrival: "site", phase: "open" })).toBe(false);
    expect(selectHomeActive({ arrival: "off", phase: "open" })).toBe(false);
  });

  it("keeps the same notes object when nothing changed", () => {
    const first = useHomeFlow.getState().notes;
    useHomeFlow.getState().setNotes({ slow: false, offline: false, retrying: false });
    expect(useHomeFlow.getState().notes).toBe(first);
    useHomeFlow.getState().setNotes({ slow: true, offline: false, retrying: false });
    expect(useHomeFlow.getState().notes.slow).toBe(true);
  });
});

describe("the seed", () => {
  it("runs the opening for a home arrival, whatever else is set", () => {
    expect(seedFor({ arrivalAttr: true, introOff: false })).toEqual({
      arrival: "document",
      phase: "cover",
    });
  });

  it("is open at once with intro off", () => {
    expect(seedFor({ arrivalAttr: false, introOff: true })).toEqual({
      arrival: "off",
      phase: "open",
    });
  });

  it("is open at once for every other arrival", () => {
    expect(seedFor({ arrivalAttr: false, introOff: false })).toEqual({
      arrival: "site",
      phase: "open",
    });
  });

  it("is read from the page once, and the attribute is taken off", async () => {
    vi.resetModules();
    document.documentElement.dataset.arrival = "home";
    const fresh = await import("./home-flow");
    expect(fresh.useHomeFlow.getState()).toMatchObject({ arrival: "document", phase: "cover" });
    expect(document.documentElement.dataset.arrival).toBeUndefined();
    fresh.useHomeFlow.getState().abort();
    fresh.settleHomeFlow();
    expect(fresh.useHomeFlow.getState().phase).toBe("open");
  });

  it("reads intro off from the session", async () => {
    vi.resetModules();
    window.sessionStorage.setItem("aspirants:intro", "off");
    try {
      const fresh = await import("./home-flow");
      expect(fresh.useHomeFlow.getState()).toMatchObject({ arrival: "off", phase: "open" });
    } finally {
      window.sessionStorage.removeItem("aspirants:intro");
    }
  });
});

describe("whenHomePhase", () => {
  it("resolves when the phase is reached, and at once when it already is", async () => {
    let reached = false;
    void whenHomePhase("tap").then(() => {
      reached = true;
    });
    await tick();
    expect(reached).toBe(false);
    useHomeFlow.getState().advance("boot");
    await tick();
    expect(reached).toBe(false);
    useHomeFlow.getState().advance("tap");
    await tick();
    expect(reached).toBe(true);
    await expect(whenHomePhase("boot")).resolves.toBeUndefined();
  });
});

describe("the press", () => {
  it("unlocks the sound and moves on only at the tap gate", () => {
    tapToContinue();
    expect(unlock).not.toHaveBeenCalled();
    expect(useHomeFlow.getState().phase).toBe("cover");
    useHomeFlow.getState().advance("tap");
    tapToContinue();
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(useHomeFlow.getState().phase).toBe("intro");
    tapToContinue();
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it("answers a click that began after the gate appeared, Enter and Space", () => {
    useHomeFlow.getState().advance("tap");
    const stop = listenForTap();
    // A click with no press before it (a press that was down when the files arrived) does nothing.
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(useHomeFlow.getState().phase).toBe("tap");
    window.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(useHomeFlow.getState().phase).toBe("intro");
    expect(unlock).toHaveBeenCalledTimes(1);
    stop();

    for (const key of ["Enter", " "]) {
      reset("document", "tap");
      const off = listenForTap();
      const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      window.dispatchEvent(e);
      expect(useHomeFlow.getState().phase).toBe("intro");
      expect(e.defaultPrevented).toBe(true);
      off();
    }
  });

  it("ignores other keys, modified Enter and a held key, and stops listening when told", () => {
    reset("document", "tap");
    const stop = listenForTap();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true }),
    );
    expect(useHomeFlow.getState().phase).toBe("tap");
    stop();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(useHomeFlow.getState().phase).toBe("tap");
  });
});

describe("runHomeFlow", () => {
  function fakes() {
    const order: string[] = [];
    let finishLoad: () => void = () => undefined;
    let finishReady: () => void = () => undefined;
    const deps = {
      load: (report: (p: PreloadProgress) => void) =>
        new Promise<void>((resolve) => {
          report(progress(0.5));
          finishLoad = resolve;
        }),
      ready: () =>
        new Promise<void>((resolve) => {
          order.push("ready");
          finishReady = resolve;
        }),
      dropCover: () => order.push("dropCover"),
      loaded: () => order.push("loaded"),
      listen: () => {
        order.push("listen");
        return () => order.push("unlisten");
      },
    };
    return { order, deps, finishLoad: () => finishLoad(), finishReady: () => finishReady() };
  }

  it("goes from the cover to open, each step waiting for the real thing", async () => {
    const f = fakes();
    let done = false;
    void runHomeFlow(f.deps).then(() => {
      done = true;
    });
    await tick();
    // Nothing moves while the cover stands, and the real progress is published.
    expect(useHomeFlow.getState().phase).toBe("cover");
    expect(useHomeFlow.getState().progress?.progress).toBe(0.5);
    expect(f.order).toEqual([]);

    // The loading screen drew its first frame: the cover goes, the list is still loading.
    useHomeFlow.getState().advance("boot");
    await tick();
    expect(f.order).toEqual(["dropCover"]);
    expect(useHomeFlow.getState().phase).toBe("boot");

    // A press before the list is done does nothing.
    tapToContinue();
    expect(useHomeFlow.getState().phase).toBe("boot");

    f.finishLoad();
    await tick();
    expect(f.order).toEqual(["dropCover", "loaded", "ready"]);
    expect(useHomeFlow.getState().phase).toBe("boot");

    f.finishReady();
    await tick();
    expect(useHomeFlow.getState().phase).toBe("tap");
    expect(f.order).toContain("listen");

    tapToContinue();
    await tick();
    expect(useHomeFlow.getState().phase).toBe("intro");
    expect(f.order.at(-1)).toBe("unlisten");
    expect(done).toBe(false);

    useHomeFlow.getState().finishIntro();
    await tick();
    expect(done).toBe(true);
    expect(useHomeFlow.getState().phase).toBe("open");
  });

  it("drops the cover when the first frame is drawn, even if the list has already arrived", async () => {
    const f = fakes();
    void runHomeFlow(f.deps);
    f.finishLoad();
    await tick();
    // The list is in, but the cover stays until the loading screen has drawn: no timer lets it go.
    expect(f.order).toContain("loaded");
    expect(f.order).not.toContain("dropCover");
    expect(f.order).not.toContain("ready");
    useHomeFlow.getState().advance("boot");
    await tick();
    expect(f.order).toContain("dropCover");
    expect(f.order).toContain("ready");
    expect(f.order.indexOf("dropCover")).toBeLessThan(f.order.indexOf("ready"));
  });

  it("opens at once on abort, without dropping the cover itself or asking for a press", async () => {
    const f = fakes();
    let done = false;
    void runHomeFlow(f.deps).then(() => {
      done = true;
    });
    await tick();
    useHomeFlow.getState().abort();
    await tick();
    expect(done).toBe(true);
    expect(f.order).not.toContain("dropCover");
    expect(f.order).not.toContain("listen");
  });

  it("can be aborted at the tap gate and stops listening", async () => {
    const f = fakes();
    let done = false;
    void runHomeFlow(f.deps).then(() => {
      done = true;
    });
    useHomeFlow.getState().advance("boot");
    f.finishLoad();
    await tick();
    f.finishReady();
    await tick();
    expect(useHomeFlow.getState().phase).toBe("tap");
    useHomeFlow.getState().abort();
    await tick();
    expect(done).toBe(true);
    expect(f.order.at(-1)).toBe("unlisten");
  });
});

describe("the shown progress", () => {
  it("closes on the real fraction, never passes it and never goes back", () => {
    let shown = 0;
    for (let i = 0; i < 400; i += 1) {
      const next = stepShown(shown, 0.6, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(shown);
      expect(next).toBeLessThanOrEqual(0.6);
      shown = next;
    }
    expect(shown).toBeGreaterThan(0.59);
    // The real fraction falls (a new item joined): what is shown stays.
    expect(stepShown(shown, 0.3, 1 / 60)).toBe(shown);
  });

  it("lags the truth: one frame moves a part of the way", () => {
    const next = stepShown(0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(0.2);
    expect(stepShown(0.2, 1, 0)).toBe(0.2);
    expect(stepShown(0, 5, 10)).toBeLessThanOrEqual(1);
    expect(stepShown(0, -1, 1)).toBe(0);
  });

  it("writes whole percents, rounded down, never above the real one, 99 at most until done", () => {
    expect(shownPercent(0.456, 0.5, false)).toBe(45);
    expect(shownPercent(0.5, 0.456, false)).toBe(45);
    expect(shownPercent(0.999, 1, false)).toBe(99);
    expect(shownPercent(1, 1, false)).toBe(99);
    expect(shownPercent(0.2, 1, true)).toBe(100);
    expect(shownPercent(-1, 0, false)).toBe(0);
  });
});

describe("the labels and the bytes", () => {
  it("cycle the real pending labels and fall back to the heaviest", () => {
    expect(pickPending(["a", "b", "c"], "z", 0)).toBe("a");
    expect(pickPending(["a", "b", "c"], "z", 4)).toBe("b");
    expect(pickPending(["a"], "z", 9)).toBe("a");
    expect(pickPending([], "Loading the site", 3)).toBe("Loading the site");
    expect(pickPending(["a", "b"], "z", -3)).toBe("a");
  });

  it("say what has arrived, and the total only when it is final", () => {
    expect(bytesWords(undefined)).toBe("");
    expect(bytesWords({ received: 0, total: 100, partial: false })).toBe("");
    expect(bytesWords({ received: 3_200_000, total: 9_800_000, partial: false })).toBe(
      "3.2 MB of 9.8 MB",
    );
    expect(bytesWords({ received: 3_200_000, total: 9_800_000, partial: true })).toBe(
      "3.2 MB received",
    );
    expect(bytesWords({ received: 812_000, total: 0, partial: false })).toBe("812 KB received");
    expect(bytesWords({ received: 1_300_000_000, total: 2_000_000_000, partial: false })).toBe(
      "1.3 GB of 2.0 GB",
    );
  });
});
