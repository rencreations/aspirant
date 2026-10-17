import { characters } from "@/content/characters";

import { mbtiAxes, mbtiMeaning } from "./mbti";
import { traitOf, traitsOf } from "./traits";

describe("trait chips", () => {
  it("cuts at a natural break and keeps the rest", () => {
    const t = traitOf("Proud, loud and quick to anger, with a soft heart she keeps out of sight.");
    expect(t.chip).toBe("Proud, loud and quick to anger");
    expect(t.rest).toBe("with a soft heart she keeps out of sight.");
  });

  it.each(characters.map((c) => [c.slug, c.sections.personality] as const))(
    "%s: every chip and remainder is a verbatim piece of its line",
    (_slug, lines) => {
      for (const trait of traitsOf(lines)) {
        expect(trait.chip.length).toBeGreaterThan(0);
        expect(trait.chip.length).toBeLessThanOrEqual(48);
        expect(trait.source.startsWith(trait.chip)).toBe(true);
        expect(trait.source).toContain(trait.rest);
      }
    },
  );
});

describe("mbti", () => {
  it("spells out the letters only", () => {
    expect(mbtiMeaning("ENTJ")).toBe("Extraverted, Intuitive, Thinking, Judging");
    expect(mbtiAxes("INFP").map((a) => a.pick)).toEqual(["right", "right", "right", "right"]);
  });

  it.each(characters.map((c) => [c.slug, c.mbti] as const))("%s has a valid code", (_s, code) => {
    expect(code).toMatch(/^[EI][SN][TF][JP]$/);
  });
});
