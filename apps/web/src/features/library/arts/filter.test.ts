import { describe, expect, it } from "vitest";

import {
  facetCounts,
  filterArts,
  firstScreenKeys,
  matchesText,
  NO_FILTERS,
  restKeys,
  splashRibbon,
  summaryLine,
  words,
} from "./filter";
import type { ArtItem, ArtKind } from "./types";

function art(
  slug: string,
  kind: ArtKind,
  chars: ArtItem["chars"],
  pair: ArtItem["pair"],
  title = slug,
): ArtItem {
  return {
    id: `arts-official-${slug}`,
    title,
    collection: "arts",
    chars,
    pair,
    canon: "official",
    tags: [kind],
    kind,
    alt: `${title} alt`,
    img: {
      t: `${slug}/t.webp`,
      p: `${slug}/p.webp`,
      f: `${slug}/f.webp`,
      w: 1600,
      h: 900,
      c: "#000000",
    },
    download: { key: `${slug}/o.jpg`, name: `${slug}.jpg` },
  };
}

const items: ArtItem[] = [
  art("selena-splash", "splash", ["selena"], "selena-obsidia", "Selena, splash art"),
  art("layla-splash", "splash", ["layla"], "fanny-layla", "Layla, splash art"),
  art("fanny-splash", "splash", ["fanny"], "fanny-layla", "Fanny, splash art"),
  art("together", "pair", ["fanny", "layla"], "fanny-layla", "Fanny and Layla, fighting together"),
  art("chart", "lore", ["fanny", "layla", "selena"], null, "The Aspirants, relationship chart"),
  art("ruby-father", "official", ["ruby"], "ruby-angela", "Ruby's father"),
];

describe("search", () => {
  it("splits the box into lower case words", () => {
    expect(words("  Layla  SPLASH ")).toEqual(["layla", "splash"]);
    expect(words("")).toEqual([]);
  });

  it("needs every word, and matches names, kinds and pairs", () => {
    const layla = items[1]!;
    expect(matchesText(layla, "")).toBe(true);
    expect(matchesText(layla, "layla splash")).toBe(true);
    expect(matchesText(layla, "layla ruby")).toBe(false);
    expect(matchesText(layla, "fanny and layla")).toBe(true); // the pair's name
    expect(matchesText(layla, "splash art")).toBe(true); // the kind's label
  });
});

describe("filters", () => {
  it("filters by character, kind and pair together", () => {
    expect(filterArts(items, { ...NO_FILTERS, who: "layla" }).map((i) => i.id)).toEqual([
      "arts-official-layla-splash",
      "arts-official-together",
      "arts-official-chart",
    ]);
    expect(filterArts(items, { ...NO_FILTERS, who: "layla", kind: "pair" })).toHaveLength(1);
    expect(filterArts(items, { ...NO_FILTERS, pair: "selena-obsidia" })).toHaveLength(1);
    expect(filterArts(items, { ...NO_FILTERS, q: "father" })).toHaveLength(1);
    expect(filterArts(items, NO_FILTERS)).toHaveLength(items.length);
  });

  it("counts each chip with the other filters kept", () => {
    const c = facetCounts(items, { ...NO_FILTERS, kind: "splash" });
    // The character chips count splash art only.
    expect(c.who.layla).toBe(1);
    expect(c.who.ruby).toBe(0);
    // The kind chips ignore the kind filter itself, so another kind can still be chosen.
    expect(c.kind.splash).toBe(3);
    expect(c.kind.pair).toBe(1);
    expect(c.pair["fanny-layla"]).toBe(2);
  });
});

describe("ribbon and first screen", () => {
  it("lists the splash arts in roster order", () => {
    expect(splashRibbon(items).map((i) => i.id)).toEqual([
      "arts-official-fanny-splash",
      "arts-official-layla-splash",
      "arts-official-selena-splash",
    ]);
  });

  it("puts the ribbon's previews first, then thumbnails, and never repeats a file", () => {
    const keys = firstScreenKeys(items, 5);
    expect(keys).toEqual([
      "fanny-splash/p.webp",
      "layla-splash/p.webp",
      "selena-splash/p.webp",
      "selena-splash/t.webp",
      "layla-splash/t.webp",
    ]);
    // Everything not in the first screen is left for the background.
    expect(restKeys(items, 5)).toEqual([
      "fanny-splash/t.webp",
      "together/t.webp",
      "chart/t.webp",
      "ruby-father/t.webp",
    ]);
  });
});

describe("summary line", () => {
  it("says what is left", () => {
    expect(summaryLine(6, 6, NO_FILTERS)).toBe("6 pictures");
    expect(summaryLine(2, 6, { ...NO_FILTERS, who: "layla" })).toBe("2 of 6 pictures");
    expect(summaryLine(0, 6, { ...NO_FILTERS, q: "zzz" })).toBe("No picture matches");
  });
});
