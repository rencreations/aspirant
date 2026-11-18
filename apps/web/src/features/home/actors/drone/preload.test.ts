import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DRONE_MODEL, DRONE_MODEL_BYTES, FACES_A, FACES_B, MARKS } from "./model";
import { droneItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("the drone's loading list", () => {
  it("lists the script, the model, the two pages of faces and the icons, each once", () => {
    const items = droneItems();
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "chunk:home-drone",
      `media:${DRONE_MODEL}`,
      `media:${FACES_A}`,
      `media:${FACES_B}`,
      `media:${MARKS}`,
    ]);
  });

  it("is deferred with a priority by default and waited for when a section asks", () => {
    expect(droneItems().every((item) => item.deferred === true && item.priority === 10)).toBe(true);
    expect(droneItems({ priority: 3 }).every((item) => item.priority === 3)).toBe(true);
    expect(droneItems({ deferred: false }).some((item) => item.deferred)).toBe(false);
  });

  it("gives the model's real size, so the bar is true", () => {
    expect(statSync(path.join(PUBLIC, DRONE_MODEL)).size).toBe(DRONE_MODEL_BYTES);
  });
});
