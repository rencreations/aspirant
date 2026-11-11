import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import marks from "@/content/marks.json";

import type { Mark } from "./marks";

/**
 * The marks of the story pages (`src/content/marks.json`, made by
 * `scripts/library/lore/codex/build_marks.py`) against the chapter text and the codex: every mark
 * names words that are in the paragraph (in one piece, once), an entry that exists, and says
 * something short and clean. The chapter text itself is never edited by a mark.
 */
const root = process.cwd();
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")) as unknown;

/** An en dash or an em dash (written as code points so that this file holds none). */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u");

const data = marks as unknown as Record<string, Mark[]>;
const codex = read("public/data/library/lore-codex.json") as {
  entries: Array<{ slug: string; first: number }>;
};
const entries = new Map(codex.entries.map((e) => [e.slug, e] as const));

interface Seg {
  t: string;
}
interface Block {
  t: string;
  i?: number;
  segs?: Seg[];
}

describe("marks", () => {
  const ids = Object.keys(data);

  it("are in known chapters, at most three each, one to a paragraph", () => {
    for (const id of ids) {
      expect(fs.existsSync(path.join(root, `public/data/story/${id}.json`)), id).toBe(true);
      const list = data[id] ?? [];
      expect(list.length, id).toBeLessThanOrEqual(3);
      expect(new Set(list.map((m) => m.p)).size, id).toBe(list.length);
    }
  });

  it("name words that are in one piece of their paragraph, exactly once", () => {
    for (const id of ids) {
      const chapter = read(`public/data/story/${id}.json`) as { blocks: Block[] };
      for (const m of data[id] ?? []) {
        const block = chapter.blocks.find((b) => b.t === "p" && b.i === m.p);
        expect(block, `${id} p${String(m.p)}`).toBeDefined();
        const segs = block?.segs ?? [];
        const whole = segs.map((s) => s.t).join("");
        expect(whole.split(m.phrase).length - 1, `${id} ${m.phrase}`).toBe(1);
        expect(
          segs.some((s) => s.t.includes(m.phrase)),
          `${id} ${m.phrase} is in one piece`,
        ).toBe(true);
      }
    }
  });

  it("open an entry that exists, not before the chapter that first shows it", () => {
    for (const id of ids) {
      const n = Number(id.slice(1));
      for (const m of data[id] ?? []) {
        const e = entries.get(m.slug);
        expect(e, `${id} ${m.slug}`).toBeDefined();
        expect(n, `${id} ${m.slug}`).toBeGreaterThanOrEqual(e?.first ?? 0);
      }
    }
  });

  it("carry a short plain tip, with no dash", () => {
    for (const id of ids) {
      for (const m of data[id] ?? []) {
        expect(m.tip.length, `${id} ${m.slug}`).toBeLessThanOrEqual(150);
        expect(m.tip, `${id} ${m.slug}`).not.toMatch(DASHES);
      }
    }
  });

  it("repeat an entry at most three times, six chapters apart", () => {
    const at = new Map<string, number[]>();
    for (const id of ids) {
      for (const m of data[id] ?? [])
        at.set(m.slug, [...(at.get(m.slug) ?? []), Number(id.slice(1))]);
    }
    for (const [slug, list] of at) {
      expect(list.length, slug).toBeLessThanOrEqual(3);
      const sorted = [...list].sort((a, b) => a - b);
      sorted.slice(1).forEach((n, i) => {
        expect(n - (sorted[i] ?? 0), slug).toBeGreaterThanOrEqual(6);
      });
    }
  });
});
