import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TETRA_MODEL, TETRA_MODEL_BYTES } from "./model";
import { tetraItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("Tetra's loading list", () => {
  it("lists the script and the model, each once, under the media store's ids", () => {
    const ids = tetraItems().map((item) => item.id);
    expect(ids).toEqual(["chunk:home-tetra", `media:${TETRA_MODEL}`]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deferred with a priority by default and waited for when a section asks", () => {
    expect(tetraItems().every((item) => item.deferred === true && item.priority === 60)).toBe(true);
    expect(tetraItems({ priority: 3 }).every((item) => item.priority === 3)).toBe(true);
    expect(tetraItems({ deferred: false }).some((item) => item.deferred)).toBe(false);
  });

  it("gives the real size of the model, so the bar is true", () => {
    expect(statSync(path.join(PUBLIC, TETRA_MODEL)).size).toBe(TETRA_MODEL_BYTES);
  });
});
