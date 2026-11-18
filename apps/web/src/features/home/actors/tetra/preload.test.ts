import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  KITE,
  KITE_BOWS,
  KITE_BOWS_BYTES,
  KITE_BYTES,
  TETRA_MODEL,
  TETRA_MODEL_BYTES,
} from "./model";
import { tetraItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("Tetra's loading list", () => {
  it("lists the script, the model and the kite's two pictures, each once, under the media store's ids", () => {
    const ids = tetraItems().map((item) => item.id);
    expect(ids).toEqual([
      "chunk:home-tetra",
      `media:${TETRA_MODEL}`,
      `media:${KITE}`,
      `media:${KITE_BOWS}`,
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves the kite out when a section does not show it", () => {
    expect(tetraItems({ kite: false }).map((item) => item.id)).toEqual([
      "chunk:home-tetra",
      `media:${TETRA_MODEL}`,
    ]);
  });

  it("is deferred with a priority by default and waited for when a section asks", () => {
    expect(tetraItems().every((item) => item.deferred === true && item.priority === 60)).toBe(true);
    expect(tetraItems({ priority: 3 }).every((item) => item.priority === 3)).toBe(true);
    expect(tetraItems({ deferred: false }).some((item) => item.deferred)).toBe(false);
  });

  it("gives the real sizes of the files, so the bar is true", () => {
    expect(statSync(path.join(PUBLIC, TETRA_MODEL)).size).toBe(TETRA_MODEL_BYTES);
    expect(statSync(path.join(PUBLIC, KITE)).size).toBe(KITE_BYTES);
    expect(statSync(path.join(PUBLIC, KITE_BOWS)).size).toBe(KITE_BOWS_BYTES);
  });
});
