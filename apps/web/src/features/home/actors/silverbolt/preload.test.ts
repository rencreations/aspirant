import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SB_MODEL, SB_MODEL_BYTES } from "./facts";
import { silverboltItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("Silverbolt's loading list", () => {
  it("lists the script and the model, each once, under the ids the media store uses", () => {
    const ids = silverboltItems().map((item) => item.id);
    expect(ids).toEqual(["chunk:home-silverbolt", `media:${SB_MODEL}`]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deferred with a priority by default and waited for when a section asks", () => {
    expect(silverboltItems().every((item) => item.deferred === true && item.priority === 40)).toBe(
      true,
    );
    expect(silverboltItems({ priority: 7 }).every((item) => item.priority === 7)).toBe(true);
    expect(silverboltItems({ deferred: false }).some((item) => item.deferred)).toBe(false);
  });

  it("gives the model's real size, so the bar is true", () => {
    expect(statSync(path.join(PUBLIC, SB_MODEL)).size).toBe(SB_MODEL_BYTES);
  });
});
