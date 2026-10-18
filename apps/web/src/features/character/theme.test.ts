import { characters } from "@/content/characters";

import { ART } from "./art";
import { characterVars, contrast, mix, onColor, readable } from "./theme";

const SURFACES = {
  daybreak: ["#f4f6f9", "#e9edf2", "#ffffff"],
  storm: ["#05070c", "#0a0e16", "#0e141f"],
} as const;

describe("contrast", () => {
  it("matches the WCAG extremes", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("mixes in sRGB", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ff0000", "#0000ff", 0)).toBe("#ff0000");
  });
});

describe("readable", () => {
  it("keeps a colour that already reads", () => {
    expect(readable("#0b111c", "daybreak")).toBe("#0b111c");
  });

  it("darkens a pale colour on ceramic and lightens a dark one on void black", () => {
    const pale = readable("#A6DCFF", "daybreak");
    const navy = readable("#1E2A57", "storm");
    for (const s of SURFACES.daybreak) expect(contrast(pale, s)).toBeGreaterThanOrEqual(4.5);
    for (const s of SURFACES.storm) expect(contrast(navy, s)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("characterVars", () => {
  it.each(characters.map((c) => [c.slug, c] as const))(
    "%s: accents read at 4.5:1 on every surface, text on accent fills reads too",
    (_slug, character) => {
      const vars = characterVars(
        character.palette,
        character.side,
        ART[character.slug].accent,
      ) as Record<string, string>;
      const accent = vars["--accent"] ?? "";
      const accent2 = vars["--accent-2"] ?? "";
      for (const s of SURFACES[character.side]) {
        expect(contrast(accent, s)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent2, s)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(accent, onColor(accent))).toBeGreaterThanOrEqual(4.5);
      expect(vars["--on-accent"]).toBe(onColor(accent));
    },
  );
});
