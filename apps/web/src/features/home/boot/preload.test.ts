import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PreloadItem } from "@/lib/preload";

vi.mock("@/lib/audio", () => ({ audio: { unlock: vi.fn() } }));

const { useHomeFlow } = await import("@/lib/home-flow");
const { homeItems } = await import("../preload-items");
const { afterTheDrone, bootItems, droneTier, introTier, resetOpeningGate } =
  await import("./preload");

function setFlow(arrival: "document" | "site" | "off", phase: "cover" | "open") {
  useHomeFlow.setState({ arrival, phase });
}

const noop = () => undefined;

function item(id: string, run: () => Promise<unknown>, deferred = false): PreloadItem {
  return { id, label: id, run, deferred };
}

describe("what the opening needs", () => {
  it("is all waited for: the intro never stalls for a file after the press", () => {
    for (const it of bootItems()) {
      expect(it.deferred, it.id).toBeFalsy();
    }
  });

  it("tier one is the drone: its script, its model, its faces and its icons, then the scene", () => {
    const ids = droneTier().map((i) => i.id);
    expect(ids[0]).toBe("chunk:home-drone");
    expect(ids[1]).toMatch(/drone\.glb/);
    expect(ids).toContain("chunk:home-boot");
    expect(ids.some((id) => /home-(duo|logo)/.test(id))).toBe(false);
  });

  it("tier two is the pair and the logo the intro carries in", () => {
    const ids = introTier().map((i) => i.id);
    expect(ids.some((id) => id.includes("home-duo"))).toBe(true);
    expect(ids.some((id) => id.includes("home-logo"))).toBe(true);
    expect(ids.some((id) => id.includes("drone.glb"))).toBe(false);
  });

  it("has unique ids", () => {
    const ids = bootItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the drone's files come before the rest", () => {
  beforeEach(() => {
    resetOpeningGate();
  });

  it("holds the waited items of the second tier until every item of the first has finished", async () => {
    const order: string[] = [];
    let finishA: () => void = noop;
    let finishB: () => void = noop;
    const a = item("a", () => new Promise<void>((r) => (finishA = r)).then(() => order.push("a")));
    const b = item("b", () => new Promise<void>((r) => (finishB = r)).then(() => order.push("b")));
    const c = item("c", () => Promise.resolve(order.push("c")));
    const list = afterTheDrone([a, b], [c]);
    expect(list.map((i) => i.id)).toEqual(["a", "b", "c"]);
    const running = list.map((i) => i.run(noop, { background: false }));
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    finishA();
    await running[0];
    await Promise.resolve();
    expect(order).toEqual(["a"]);
    finishB();
    await Promise.all(running);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("opens the gate when a first item ends in an error (a file that is gone is skipped)", async () => {
    const a = item("a", () => Promise.reject(new Error("gone")));
    const c = item("c", () => Promise.resolve("c"));
    const list = afterTheDrone([a], [c]);
    const first = list[0]!.run(noop, { background: false });
    await expect(first).rejects.toThrow("gone");
    await expect(list[1]!.run(noop, { background: false })).resolves.toBe("c");
  });

  it("leaves deferred items alone and passes a held item's progress through unchanged", async () => {
    const a = item("a", () => Promise.resolve());
    const later = item("later", () => Promise.resolve(), true);
    const progressive: PreloadItem = {
      id: "p",
      label: "p",
      run: (report) => {
        report(0.5);
        return Promise.resolve();
      },
    };
    const list = afterTheDrone([a], [later, progressive]);
    expect(list[1]).toBe(later);
    await list[0]!.run(noop, { background: false });
    const reports: number[] = [];
    await list[2]!.run((f) => reports.push(f), { background: false });
    expect(reports).toEqual([0.5]);
  });
});

describe("the home's list for each way in", () => {
  beforeEach(() => {
    setFlow("site", "open");
    resetOpeningGate();
  });

  it("puts the drone's items first and the engine with them on a document load", () => {
    setFlow("document", "cover");
    const items = homeItems();
    const ids = items.map((i) => i.id);
    const first = [...droneTier().map((i) => i.id), "chunk:home-engine"];
    expect(ids.slice(0, first.length)).toEqual(first);
    for (const it of items.slice(0, first.length)) expect(it.deferred).toBeFalsy();
    expect(new Set(ids).size).toBe(ids.length);
    // The pair and the logo come right after the drone's tier.
    expect(ids.slice(first.length, first.length + 3).some((id) => id.includes("home-duo"))).toBe(
      true,
    );
  });

  it("keeps a drone item waited when a section lists it deferred (the opening's copy wins)", () => {
    setFlow("document", "cover");
    const items = homeItems();
    for (const id of bootItems().map((i) => i.id)) {
      const found = items.filter((i) => i.id === id);
      expect(found).toHaveLength(1);
      expect(found[0]?.deferred).toBeFalsy();
    }
  });

  it("leaves them out when there is no opening (the curtain, intro off, a later visit)", () => {
    for (const [arrival, phase] of [
      ["site", "open"],
      ["off", "open"],
      ["document", "open"],
    ] as const) {
      setFlow(arrival, phase);
      const ids = homeItems().map((i) => i.id);
      expect(ids[0]).toBe("chunk:home-engine");
      expect(ids).not.toContain("chunk:home-boot");
    }
  });
});
