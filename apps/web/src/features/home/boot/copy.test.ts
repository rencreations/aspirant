import { describe, expect, it } from "vitest";

import {
  COMPANY,
  COMPANY_AFTER,
  COMPANY_EVERY,
  GROUPS,
  TAP_WORDS,
  companyLine,
  groupOf,
  groupStates,
} from "./copy";

describe("the groups of the loading list", () => {
  it("puts the labels the home uses in the right group", () => {
    expect(groupOf("Waking the drone")).toBe("drone");
    expect(groupOf("Loading the two drones")).toBe("drone");
    expect(groupOf("Preparing the two drones")).toBe("drone");
    expect(groupOf("Hanging the art")).toBe("art");
    expect(groupOf("Loading the hero art")).toBe("art");
    expect(groupOf("Loading the splash art")).toBe("art");
    expect(groupOf("Hanging the wall")).toBe("art");
    expect(groupOf("Loading type")).toBe("type");
    expect(groupOf("Starting the stage")).toBe("stage");
    expect(groupOf("Drawing the logo")).toBe("stage");
    // The two logo pictures of the first screen are art, not the stage.
    expect(groupOf("Loading the logos")).toBe("art");
    expect(groupOf("Waking Silverbolt")).toBe("models");
    expect(groupOf("Loading the doll")).toBe("models");
    expect(groupOf("Loading Selena's hand")).toBe("models");
    expect(groupOf("Waking Tetra")).toBe("models");
    expect(groupOf("Loading the trailer")).toBe("films");
    expect(groupOf("Sleeving the records")).toBe("sound");
    expect(groupOf("Winding up the gramophone")).toBe("sound");
  });

  it("leaves a label that fits no group out of the groups (it is still in the bar)", () => {
    expect(groupOf("Mixing something else")).toBeNull();
  });

  it("every group has a name and a distinct id", () => {
    const ids = GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GROUPS) expect(g.name.length).toBeGreaterThan(2);
  });
});

describe("which groups are done", () => {
  const all = [
    "Loading type",
    "Starting the stage",
    "Waking the drone",
    "Loading the two drones",
    "Hanging the art",
  ];

  it("shows only the groups the list has, in a fixed order", () => {
    const states = groupStates(all, all);
    expect(states.map((s) => s.id)).toEqual(["type", "stage", "drone", "art"]);
  });

  it("a group is done when none of its downloads is still running", () => {
    const states = groupStates(all, ["Loading the two drones", "Hanging the art"]);
    const byId = Object.fromEntries(states.map((s) => [s.id, s.done]));
    expect(byId).toEqual({ type: true, stage: true, drone: false, art: false });
  });

  it("everything is done when nothing runs", () => {
    expect(groupStates(all, []).every((s) => s.done)).toBe(true);
  });

  it("has no groups for an empty list", () => {
    expect(groupStates([], [])).toEqual([]);
  });
});

describe("the line of company", () => {
  const base = { progress: 0.3, offline: false, retrying: false, done: false };

  it("is quiet at first", () => {
    expect(companyLine({ ...base, elapsed: 0 })).toBe("");
    expect(companyLine({ ...base, elapsed: COMPANY_AFTER - 0.1 })).toBe("");
  });

  it("changes every few seconds while the wait goes on", () => {
    const seen = new Set<string>();
    for (let i = 0; i < COMPANY.length; i += 1) {
      seen.add(companyLine({ ...base, elapsed: COMPANY_AFTER + i * COMPANY_EVERY + 0.1 }));
    }
    expect(seen.size).toBe(COMPANY.length);
    expect(seen.has("")).toBe(false);
  });

  it("cycles", () => {
    const a = companyLine({ ...base, elapsed: COMPANY_AFTER + 0.1 });
    const b = companyLine({
      ...base,
      elapsed: COMPANY_AFTER + COMPANY.length * COMPANY_EVERY + 0.1,
    });
    expect(a).toBe(b);
  });

  it("says nearly there only past 90 percent of the real progress", () => {
    expect(companyLine({ ...base, progress: 0.89, elapsed: 40 })).not.toBe("Nearly there.");
    expect(companyLine({ ...base, progress: 0.9, elapsed: 0 })).toBe("Nearly there.");
    for (const line of COMPANY) expect(line.toLowerCase()).not.toContain("nearly");
  });

  it("stays quiet offline, while a download is retried and when everything is in", () => {
    expect(companyLine({ ...base, elapsed: 30, offline: true })).toBe("");
    expect(companyLine({ ...base, elapsed: 30, retrying: true })).toBe("");
    expect(companyLine({ ...base, elapsed: 30, done: true })).toBe("");
  });

  it("uses no dash and no digit", () => {
    for (const line of [...COMPANY, TAP_WORDS]) {
      expect(line).not.toMatch(/[\u2013\u2014]/);
      expect(line).not.toMatch(/\d/);
    }
  });
});
