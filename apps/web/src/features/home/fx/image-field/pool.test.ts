import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  apart,
  byCharacter,
  byGroup,
  firstScreen,
  orderProblems,
  ordered,
  parsePool,
  pickApart,
  poolSource,
  type Pool,
  type PoolPicture,
} from "./pool";

const PUBLIC = path.join(process.cwd(), "public");
const pool: Pool = parsePool(
  JSON.parse(readFileSync(path.join(PUBLIC, "data", "home", "wall.json"), "utf8")),
);

function pic(over: Partial<PoolPicture>): PoolPicture {
  return {
    id: "a",
    file: "/img/home/wall/a.webp",
    w: 640,
    h: 360,
    bytes: 30_000,
    character: "fanny",
    chars: ["fanny"],
    pair: null,
    hue: 10,
    dark: 0.5,
    group: "g000",
    room: "game",
    shape: "16:9",
    focus: { x: 0.5, y: 0.5 },
    title: "A",
    alt: "A picture.",
    lib: { p: "p", f: "f", w: 2560, h: 1440 },
    ...over,
  };
}

describe("the wall's pool, as written by scripts/home/media/pool.py", () => {
  it("holds at least 120 different pictures, every file present and small", () => {
    expect(pool.count).toBeGreaterThanOrEqual(120);
    for (const p of pool.items) {
      expect(existsSync(path.join(PUBLIC, p.file)), p.file).toBe(true);
      expect(p.bytes).toBeLessThan(64 * 1024);
      expect(p.w).toBeLessThanOrEqual(640);
      expect(p.h).toBeGreaterThan(200);
    }
  });

  it("is official art only, from the splash, game and scene rooms", () => {
    for (const p of pool.items) {
      expect(["splash", "game", "scene"], p.id).toContain(p.room);
      expect(p.id.startsWith(`arts-${p.room}-`), p.id).toBe(true);
    }
  });

  it("spreads over the ten Aspirants and the group pictures", () => {
    for (const c of [
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ] as const) {
      expect(byCharacter(pool, c).length, c).toBeGreaterThanOrEqual(10);
    }
    expect(byCharacter(pool, "group").length).toBeGreaterThanOrEqual(20);
  });

  it("keeps look-alikes apart in the cyclic order", () => {
    expect(orderProblems(pool)).toEqual([]);
    expect(ordered(pool)).toHaveLength(pool.count);
  });

  it("has a first screen of 24 pictures that shows every Aspirant", () => {
    const first = firstScreen(pool);
    expect(first).toHaveLength(pool.first);
    expect(new Set(first.map((p) => p.character)).size).toBeGreaterThanOrEqual(9);
  });

  it("gives every picture a group and no group more than two pictures", () => {
    const sizes = new Map<string, number>();
    for (const p of pool.items) sizes.set(p.group, (sizes.get(p.group) ?? 0) + 1);
    expect(Math.max(...sizes.values())).toBeLessThanOrEqual(2);
    const some = [...sizes.keys()][0]!;
    expect(byGroup(pool, some).length).toBeGreaterThan(0);
  });
});

describe("parsePool", () => {
  it("refuses data that is not a pool", () => {
    expect(() => parsePool({})).toThrow();
    expect(() => parsePool(null)).toThrow();
  });

  it("refuses an order that does not hold every picture once", () => {
    const raw = JSON.parse(
      readFileSync(path.join(PUBLIC, "data", "home", "wall.json"), "utf8"),
    ) as {
      order: string[];
    };
    raw.order = raw.order.slice(1);
    expect(() => parsePool(raw)).toThrow(/order/);
  });
});

describe("apart", () => {
  it("is false for the same picture, the same group or the same single Aspirant", () => {
    expect(apart(pic({}), pic({}))).toBe(false);
    expect(
      apart(pic({ id: "a", group: "g1" }), pic({ id: "b", group: "g1", character: "layla" })),
    ).toBe(false);
    expect(apart(pic({ id: "a", group: "g1" }), pic({ id: "b", group: "g2" }))).toBe(false);
  });

  it("is true for two Aspirants in two groups, and for group pictures of different Aspirants", () => {
    expect(
      apart(pic({ id: "a", group: "g1" }), pic({ id: "b", group: "g2", character: "layla" })),
    ).toBe(true);
    const a = pic({ id: "a", group: "g1", character: "group", chars: ["fanny", "layla"] });
    const b = pic({ id: "b", group: "g2", character: "group", chars: ["ruby", "angela"] });
    expect(apart(a, b)).toBe(true);
    expect(
      apart(a, pic({ id: "c", group: "g3", character: "group", chars: ["fanny", "layla"] })),
    ).toBe(false);
  });
});

describe("pickApart", () => {
  const rand = () => 0.5;

  it("never returns a picture that is not apart from the ones near it", () => {
    const near = ordered(pool).slice(0, 6);
    const used = new Map<string, number>();
    for (let i = 0; i < 40; i += 1) {
      const got = pickApart(pool, near, used, rand);
      expect(got).not.toBeNull();
      for (const n of near) expect(apart(got!, n)).toBe(true);
      used.set(got!.id, (used.get(got!.id) ?? 0) + 1);
    }
  });

  it("prefers the picture that was shown least", () => {
    const used = new Map<string, number>(pool.items.map((p) => [p.id, 3]));
    const rare = pool.items[7]!;
    used.set(rare.id, 0);
    expect(pickApart(pool, [], used, () => 0)?.id).toBe(rare.id);
  });

  it("returns null when every picture clashes", () => {
    expect(pickApart(pool, pool.items, new Map(), rand)).toBeNull();
  });
});

describe("poolSource", () => {
  it("is the whole file with its own aspect", () => {
    const p = pool.items[0]!;
    const src = poolSource(p);
    expect(src.id).toBe(`field:pool:${p.id}`);
    expect(src.crop).toBeNull();
    expect(src.aspect).toBeCloseTo(p.w / p.h, 5);
  });
});
