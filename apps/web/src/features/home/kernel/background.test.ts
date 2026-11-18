import { describe, expect, it } from "vitest";

import { Background, GROUND_FADE, STORM_HEX, groundAt, mixHex } from "./background";
import { layoutSections } from "./layout";
import type { GroundName, HomeSection } from "./types";

function fake(id: string, screens: number, bg: GroundName) {
  return {
    id,
    screens,
    lead: 0,
    tail: 0,
    bg,
    nav: { theme: "daybreak" },
    dom: "fixed",
    preload: () => [],
    mount: () => ({ update: () => undefined, dispose: () => undefined }),
  } as unknown as HomeSection;
}

const layout = layoutSections([
  fake("a", 4, "daybreak"),
  fake("b", 4, "storm"),
  fake("c", 4, "#07130f"),
  fake("d", 4, "#07130f"),
  fake("e", 4, "daybreak"),
]);

describe("groundAt", () => {
  it("is the section's own ground inside it", () => {
    expect(groundAt(layout, 1)).toEqual({ daybreak: 1, storm: 0, colour: 0, colourHex: STORM_HEX });
    expect(groundAt(layout, 6)).toEqual({ daybreak: 0, storm: 1, colour: 0, colourHex: STORM_HEX });
    const c = groundAt(layout, 10);
    expect(c.colour).toBe(1);
    expect(c.colourHex).toBe("#07130f");
  });

  it("is half and half exactly at a joint: the lower layer stays whole, the upper is at half", () => {
    const m = groundAt(layout, 4);
    expect(m.daybreak).toBeCloseTo(1);
    expect(m.storm).toBeCloseTo(0.5);
  });

  it("crosses over GROUND_FADE screens centred on the joint, in both directions", () => {
    const half = GROUND_FADE / 2;
    expect(groundAt(layout, 4 - half).storm).toBeCloseTo(0);
    expect(groundAt(layout, 4 + half).storm).toBeCloseTo(1);
    expect(groundAt(layout, 4 - half / 2).storm).toBeCloseTo(0.25);
    expect(groundAt(layout, 4 + half / 2).storm).toBeCloseTo(0.75);
  });

  it("never lets the page show through: the lowest layer in use stays whole", () => {
    for (let S = -1; S < 21; S += 0.07) {
      const m = groundAt(layout, S);
      const lowest = m.daybreak > 0 ? m.daybreak : m.storm > 0 ? m.storm : m.colour;
      expect(lowest).toBeCloseTo(1, 9);
    }
  });

  it("does not move between two sections that share a ground", () => {
    const m = groundAt(layout, 12);
    expect(m.colour).toBe(1);
    expect(m.colourHex).toBe("#07130f");
  });

  it("mixes the colour in while the colour ground comes in", () => {
    const m = groundAt(layout, 8);
    expect(m.storm).toBeCloseTo(1);
    expect(m.colour).toBeCloseTo(0.5);
    expect(m.colourHex).toBe("#07130f");
  });
});

describe("mixHex", () => {
  it("mixes two colours linearly", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });
});

describe("Background", () => {
  function layers() {
    return {
      daybreak: document.createElement("div"),
      storm: document.createElement("div"),
      colour: document.createElement("div"),
    };
  }

  it("writes the opacities and the colour to its three layers only", () => {
    const l = layers();
    const bg = new Background(l);
    bg.apply({ daybreak: 0.25, storm: 0.5, colour: 0.25, colourHex: "#07130f" });
    expect(l.daybreak.style.opacity).toBe("0.25");
    expect(l.storm.style.opacity).toBe("0.5");
    expect(l.colour.style.opacity).toBe("0.25");
    expect(l.colour.style.backgroundColor).toBe("rgb(7, 19, 15)");
    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(document.body.getAttribute("style")).toBeNull();
  });

  it("does not write again for a change too small to see", () => {
    const l = layers();
    const bg = new Background(l);
    bg.apply({ daybreak: 0.5, storm: 0.5, colour: 0, colourHex: STORM_HEX });
    l.daybreak.style.opacity = "0.9"; // a mark of the test, to see whether the layer is written
    bg.apply({ daybreak: 0.5005, storm: 0.4995, colour: 0, colourHex: STORM_HEX });
    expect(l.daybreak.style.opacity).toBe("0.9");
    bg.apply({ daybreak: 0.6, storm: 0.4, colour: 0, colourHex: STORM_HEX });
    expect(l.daybreak.style.opacity).toBe("0.6");
  });

  it("writes a layer that went to nothing", () => {
    const l = layers();
    const bg = new Background(l);
    bg.apply({ daybreak: 0.001, storm: 0.999, colour: 0, colourHex: STORM_HEX });
    bg.apply({ daybreak: 0, storm: 1, colour: 0, colourHex: STORM_HEX });
    expect(l.daybreak.style.opacity).toBe("0");
  });
});
