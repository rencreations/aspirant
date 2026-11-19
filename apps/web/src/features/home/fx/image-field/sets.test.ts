import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildFormations } from "./formations";
import { assignPictures, cardCountOf, cardKeys, poolGroups, poolKeys } from "./pictures";
import { HERO_PORTRAITS, HERO_WALLS } from "./picks-data";
import { focusInWindow, poolOf, portraitSource, setDef, wideCrop, wideSource } from "./sets";

interface Picks {
  hero: {
    portrait: Array<{
      id: string;
      chars: string[];
      repo: string;
      w: number;
      h: number;
      bytes: number;
    }>;
  };
  wall: {
    order: Array<{
      id: string;
      chars: string[];
      lib: { p: string };
      p: { w: number; h: number; bytes: number };
      clean: { x: number; y: number; w: number; h: number };
    }>;
  };
}

const picks = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../../public/data/home/picks.json"),
    "utf8",
  ),
) as Picks;

describe("the hero set", () => {
  it("is the same as the media workstream's picks, in the same order", () => {
    expect(HERO_PORTRAITS.map((p) => [p.id, p.path, p.w, p.h, p.bytes])).toEqual(
      picks.hero.portrait.map((p) => [p.id, p.repo, p.w, p.h, p.bytes]),
    );
    expect(HERO_WALLS.map((p) => [p.id, p.key, p.w, p.h, p.bytes])).toEqual(
      picks.wall.order.map((p) => [p.id, p.lib.p, p.p.w, p.p.h, p.p.bytes]),
    );
    HERO_WALLS.forEach((p, i) => {
      const c = picks.wall.order[i]!.clean;
      expect(p.clean.x).toBeCloseTo(c.x, 3);
      expect(p.clean.w).toBeCloseTo(c.w, 3);
      expect(p.chars).toEqual(picks.wall.order[i]!.chars);
    });
  });

  it("has eighteen portraits of 4:5, all different, and eighteen wide pictures", () => {
    const def = setDef("hero");
    expect(def.portraits).toHaveLength(18);
    // The hero draws one card for each wall picture: no portrait is used twice (the owner's call on duplicates).
    expect(cardCountOf(def)).toBeLessThanOrEqual(def.portraits.length);
    expect(new Set(def.portraits.map((p) => p.id)).size).toBe(def.portraits.length);
    expect(new Set(def.portraits.map((p) => p.path)).size).toBe(def.portraits.length);
    expect(def.walls).toHaveLength(18);
    expect(cardCountOf(def)).toBe(18);
    for (const p of def.portraits) expect(portraitSource(p).aspect).toBeCloseTo(0.8, 6);
  });

  it("cuts every wide picture to a 16:9 window inside the picture", () => {
    for (const p of HERO_WALLS) {
      const c = wideCrop(p);
      expect(c.sx + c.sw).toBeLessThanOrEqual(p.w);
      expect(c.sy + c.sh).toBeLessThanOrEqual(p.h);
      expect(wideSource(p).aspect).toBeCloseTo(16 / 9, 2);
    }
  });

  it("keeps the corner mark out of a marked picture's window", () => {
    const marked = HERO_WALLS.find((p) => p.clean.x > 0.1)!;
    expect(wideCrop(marked).sx).toBeGreaterThan(0.125 * marked.w - 2);
  });

  it("finds the subject inside the window, never outside it", () => {
    for (const p of HERO_WALLS) {
      const f = focusInWindow(p);
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(1);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("which picture each card shows", () => {
  const def = setDef("hero");
  const n = cardCountOf(def);

  it("cycles the portraits and gives every cell the picture of the slot it stands in", () => {
    const set = buildFormations(
      n,
      { w: 1440, h: 900 },
      { cardKeys: cardKeys(def, n), poolKeys: poolKeys(def), poolGroups: poolGroups(def) },
    );
    const pics = assignPictures(def, set);
    expect(pics).toHaveLength(set.total);
    expect(pics[0]!.portrait).toBe(0);
    expect(pics[11]!.portrait).toBe(11 % def.portraits.length);
    expect(pics[3]!.wide).toBe(set.slotPic[set.story.wallSlot[3]!]);
    expect(pics[n + 2]!.wide).toBe(set.slotPic[set.extraSlot[2]!]);
    const pool = poolOf(def).length;
    expect(pics.every((p) => p.portrait < def.portraits.length && p.wide < pool)).toBe(true);
    // The pool is larger than the plane has cells (round three): every cell has a picture of its own.
    expect(pool).toBeGreaterThanOrEqual(100);
    expect(new Set(pics.map((p) => p.wide)).size).toBe(Math.min(pool, set.total));
  });

  it("keys a card by its portrait's character and a picture by its single character", () => {
    const keys = cardKeys(def, n);
    expect(keys).toHaveLength(n);
    expect(keys[0]).toBe(def.portraits[0]!.chars[0]);
    expect(keys[10]).toBe(keys[0]);
    const pk = poolKeys(def);
    expect(pk).toHaveLength(poolOf(def).length);
    expect(pk.filter((k) => k !== null)).toHaveLength(
      poolOf(def).filter((w) => w.chars.length === 1).length,
    );
  });
});
