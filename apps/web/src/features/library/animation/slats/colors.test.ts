import { describe, expect, it } from "vitest";

import { deepen, fieldColors, saturate, slatsLook } from "../colors";
import { contrast } from "../room-math";

/** The palettes of `animation.json`, in the order of the ring. */
const PALETTES = {
  selena: { primary: "#A6DCFF", secondary: "#C7D0DD", glow: "#8B5CF6", ink: "#0D1424" },
  obsidia: { primary: "#B3122E", secondary: "#E2B04A", glow: "#FF5A86", ink: "#0B0709" },
  guinevere: { primary: "#F6B98A", secondary: "#E1322E", glow: "#2ED3C5", ink: "#24110E" },
  vexana: { primary: "#7A4FD6", secondary: "#E040A0", glow: "#D9D5F5", ink: "#140E26" },
  lesley: { primary: "#E4512B", secondary: "#F2C35B", glow: "#39D3E3", ink: "#1C0F0D" },
  change: { primary: "#FF8FC7", secondary: "#3FD3B8", glow: "#A6F7E6", ink: "#24132F" },
  ruby: { primary: "#1E2A57", secondary: "#E0388E", glow: "#F2B83B", ink: "#0A0F24" },
  angela: { primary: "#FFB28C", secondary: "#E23A92", glow: "#62E8F6", ink: "#2A1422" },
  layla: { primary: "#FF7F7A", secondary: "#14B3A6", glow: "#7DF7EC", ink: "#14222B" },
  fanny: { primary: "#F5862A", secondary: "#6A3FB5", glow: "#F2ECFF", ink: "#1E1430" },
} as const;

const looks = Object.entries(PALETTES).map(([slug, p]) => ({
  slug,
  look: slatsLook(slug, fieldColors(p)),
}));

/** Hue in degrees of a `#rrggbb` colour. */
function hue(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

describe("deepen", () => {
  it("darkens a tone until white type reads on it, keeping its hue", () => {
    for (const tone of ["#FF8FC7", "#E4512B", "#14B3A6", "#A6DCFF"]) {
      const deep = deepen(tone);
      expect(contrast(deep, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(deep, "#ffffff")).toBeLessThan(5);
      expect(Math.abs(hue(deep) - hue(tone))).toBeLessThan(3);
    }
  });

  it("leaves a dark tone as it is", () => {
    expect(deepen("#1E2A57")).toBe("#1E2A57");
  });
});

describe("saturate", () => {
  it("lifts the saturation at the same brightness", () => {
    expect(saturate("#7f7fff", 2)).toBe("#0000ff");
    expect(saturate("#336699", 1)).toBe("#336699");
  });
});

describe("the ten fields", () => {
  it("draw slats white type reads over, on a ground darker than the slats", () => {
    for (const { look } of looks) {
      expect(contrast(look.color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(look.ground, "#ffffff")).toBeGreaterThan(contrast(look.color, "#ffffff"));
    }
  });

  it("light their crests with a tone of the character's own palette", () => {
    for (const { slug, look } of looks) {
      const palette = Object.values(PALETTES[slug as keyof typeof PALETTES]).map((c) =>
        c.toLowerCase(),
      );
      expect(palette).toContain(look.glint.toLowerCase());
    }
  });

  it("are all different, and each pair shares its kind of sea", () => {
    const keys = looks.map(({ look }) => `${look.color}|${look.glint}|${look.slatWidth}`);
    expect(new Set(keys).size).toBe(10);
    const by = Object.fromEntries(looks.map(({ slug, look }) => [slug, look]));
    for (const [a, b] of [
      ["guinevere", "vexana"],
      ["ruby", "angela"],
      ["layla", "fanny"],
    ] as const) {
      expect(by[a]?.sea.perspective).toBe(by[b]?.sea.perspective);
      expect(by[a]?.color).not.toBe(by[b]?.color);
    }
  });

  it("falls back to a look for a character it does not know", () => {
    const look = slatsLook("nobody", { main: "#334455", deep: "#112233" });
    expect(contrast(look.color, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(hue(look.color) - hue("#334455"))).toBeLessThan(3);
    expect(look.slatWidth).toBeGreaterThan(0);
  });
});
