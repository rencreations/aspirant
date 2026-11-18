import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FACE_NAMES, FACES, isFaceName, moodOf } from "./faces";

const root = path.resolve(import.meta.dirname, "../../../../../public/img/home");

interface JsonFace {
  page: "A" | "B";
  blinks: boolean;
  uCell: [number, number];
}

const json = JSON.parse(readFileSync(path.join(root, "drone-faces.json"), "utf8")) as {
  faces: Record<string, JsonFace>;
};

describe("the table of faces", () => {
  it("has twenty-seven drawings: the nine of About and the eighteen of the home", () => {
    expect(FACE_NAMES).toHaveLength(27);
    expect(new Set(FACE_NAMES).size).toBe(27);
  });

  it("equals the file the script writes, for every face", () => {
    const extra = Object.keys(json.faces);
    expect(extra).toHaveLength(18);
    for (const name of extra) {
      expect(isFaceName(name), name).toBe(true);
      const face = json.faces[name];
      const mine = FACES[name as keyof typeof FACES];
      expect(mine.page, name).toBe(face?.page);
      expect([mine.u, mine.v], name).toEqual(face?.uCell);
      expect(mine.blinks, name).toBe(face?.blinks);
    }
  });

  it("never puts two drawings in one place of one page", () => {
    const seen = new Set<string>();
    for (const name of FACE_NAMES) {
      const face = FACES[name];
      const key = `${face.page}:${face.u}:${face.v}`;
      expect(seen.has(key), `${name} shares ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("keeps every cell inside the three by three of a page", () => {
    for (const name of FACE_NAMES) {
      const face = FACES[name];
      expect(face.u).toBeGreaterThanOrEqual(-1);
      expect(face.u).toBeLessThanOrEqual(1);
      expect(face.v).toBeGreaterThanOrEqual(-2);
      expect(face.v).toBeLessThanOrEqual(0);
    }
  });

  it("gives a mood from 0 to 1 and no mood for a plain face", () => {
    for (const name of FACE_NAMES) {
      const mood = moodOf(name);
      for (const value of [mood.happy, mood.flare, mood.droop]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
    expect(moodOf("normal")).toEqual({ happy: 0, flare: 0, droop: 0 });
    expect(moodOf("shocked").flare).toBeGreaterThan(0.8);
    expect(moodOf("sad").droop).toBe(1);
  });

  it("refuses a name that is not a face", () => {
    expect(isFaceName("normal")).toBe(true);
    expect(isFaceName("toString")).toBe(false);
    expect(isFaceName("furious")).toBe(false);
  });
});
