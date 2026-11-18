import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { HERO_WALLS } from "../fx/image-field/picks-data";

import { PREVIEW_PICTURES } from "./pictures";

interface Picks {
  wall: {
    order: Array<{
      id: string;
      title: string;
      alt: string;
      chars: string[];
      lib: { p: string; f: string };
      f: { w: number; h: number; bytes: number };
    }>;
  };
}

const picks = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../../../public/data/home/picks.json"),
    "utf8",
  ),
) as Picks;

/** The en dash and the em dash, written as codes so this file has none. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, "u");

describe("the preview's pictures", () => {
  it("are the same as the media workstream's wall, in the same order", () => {
    expect(
      PREVIEW_PICTURES.map((p) => [
        p.id,
        p.title,
        p.alt,
        [...p.chars],
        p.p,
        p.f,
        p.w,
        p.h,
        p.bytes,
      ]),
    ).toEqual(
      picks.wall.order.map((p) => [
        p.id,
        p.title,
        p.alt,
        p.chars,
        p.lib.p,
        p.lib.f,
        p.f.w,
        p.f.h,
        p.f.bytes,
      ]),
    );
  });

  it("are the pictures of the field's wall, so a card finds its picture by id", () => {
    expect(PREVIEW_PICTURES.map((p) => p.id)).toEqual(HERO_WALLS.map((p) => p.id));
    expect(PREVIEW_PICTURES.map((p) => p.p)).toEqual(HERO_WALLS.map((p) => p.key));
  });

  it("are all official splash art (no picture made for this site)", () => {
    for (const p of PREVIEW_PICTURES) {
      expect(p.id.startsWith("arts-splash-")).toBe(true);
      expect(p.f.endsWith("/f.webp")).toBe(true);
    }
  });

  it("have no dash in the words", () => {
    for (const p of PREVIEW_PICTURES) {
      expect(`${p.title} ${p.alt}`).not.toMatch(DASHES);
    }
  });
});
