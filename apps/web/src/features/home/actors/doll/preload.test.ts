import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DOLL_MODEL_BYTES, DOLL_MODEL_PATH, dollItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("dollItems", () => {
  it("names the file that is really there, with its real size", () => {
    expect(DOLL_MODEL_PATH.startsWith("/")).toBe(true);
    expect(statSync(path.join(PUBLIC, DOLL_MODEL_PATH)).size).toBe(DOLL_MODEL_BYTES);
  });

  it("is deferred by default, with a priority, so the bar does not wait for her", () => {
    const [item, ...rest] = dollItems();
    expect(rest).toEqual([]);
    expect(item?.deferred).toBe(true);
    expect(item?.priority).toBe(40);
    expect(item?.id).toBe(`media:${DOLL_MODEL_PATH}`);
    expect(item?.weight).toBe(1);
  });

  it("is waited for when a section says she is on the first screen", () => {
    const [item] = dollItems({ deferred: false });
    expect(item?.deferred).toBeUndefined();
    expect(item?.priority).toBeUndefined();
  });

  it("takes the section's priority", () => {
    expect(dollItems({ priority: 12 })[0]?.priority).toBe(12);
  });
});
