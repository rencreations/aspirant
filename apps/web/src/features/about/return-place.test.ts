import { describe, expect, it } from "vitest";

import { placeLead, placeScroll, placeSelector, withoutPlace } from "./return-place";

describe("placeSelector", () => {
  it("finds a phase in the list of the phases", () => {
    expect(placeSelector("phase-1")).toBe('[data-about-section="phases"] li[data-phase="1"]');
    expect(placeSelector("phase-5")).toBe('[data-about-section="phases"] li[data-phase="5"]');
  });

  it("finds a section by its name", () => {
    expect(placeSelector("ledger")).toBe('[data-about-section="ledger"]');
    expect(placeSelector("phases")).toBe('[data-about-section="phases"]');
    expect(placeSelector("label")).toBe('[data-about-section="label"]');
  });
});

describe("placeLead", () => {
  it("keeps the bar's height above a phase and nothing above a section", () => {
    expect(placeLead("phase-3", 64)).toBe(64);
    expect(placeLead("ledger", 64)).toBe(0);
  });
});

describe("placeScroll", () => {
  it("is the top of the place less the room above it", () => {
    expect(placeScroll(5200.4, 64, 20000)).toBe(5136);
    expect(placeScroll(5200, 0, 20000)).toBe(5200);
  });

  it("stays inside the page", () => {
    expect(placeScroll(40, 64, 20000)).toBe(0);
    expect(placeScroll(19990, 0, 19000)).toBe(19000);
    expect(placeScroll(300, 0, -20)).toBe(0);
  });
});

describe("withoutPlace", () => {
  it("takes the place out and keeps the rest", () => {
    expect(withoutPlace("https://aspirant.cc/about/?at=phase-4")).toBe("/about/");
    expect(withoutPlace("https://aspirant.cc/about/?x=1&at=ledger&y=2#top")).toBe(
      "/about/?x=1&y=2#top",
    );
    expect(withoutPlace("http://localhost:3100/about/")).toBe("/about/");
  });
});
