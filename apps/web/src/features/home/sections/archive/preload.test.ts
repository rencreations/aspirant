import { describe, expect, it } from "vitest";

import { COLLECTIONS } from "@/features/library/registry";
import { libUrl } from "@/lib/library";

import { preload as footerPreload } from "../footer/preload";
import { PRIORITY, coverItem, preload } from "./preload";

describe("the archive's loading list", () => {
  const items = preload();

  it("is all deferred: nothing of the archive shows when the page opens", () => {
    for (const item of items) expect(item.deferred, item.id).toBe(true);
  });

  it("lists the ten covers, once each, in the order the bend section's files are done", () => {
    const covers = items.filter((i) => i.id.startsWith("archive-cover:"));
    expect(covers).toHaveLength(COLLECTIONS.length);
    expect(new Set(covers.map((i) => i.id)).size).toBe(10);
    for (const cover of covers) expect(cover.priority).toBeGreaterThan(66);
    expect(PRIORITY).toBeGreaterThan(66);
  });

  it("asks for a cover at the address the page's own image uses", () => {
    const first = COLLECTIONS[0]!;
    const item = coverItem(first.cover, "Loading the Arts cover", PRIORITY + 1);
    expect(item.id).toBe(`archive-cover:${first.cover}`);
    expect(libUrl(first.cover)).toMatch(/^https:\/\/.+\/library\/v1\/covers\/arts\.webp$/u);
  });

  it("brings its own code and the actors it drives", () => {
    const ids = items.map((i) => i.id);
    expect(ids).toContain("chunk:home-archive");
    expect(ids).toContain("chunk:home-drone");
    expect(ids).toContain("chunk:home-tetra");
  });

  it("is listed after the archive by the footer, which is all deferred too", () => {
    const foot = footerPreload();
    expect(foot.map((i) => i.id)).toContain("chunk:home-footer");
    for (const item of foot) expect(item.deferred, item.id).toBe(true);
    const own = foot.find((i) => i.id === "chunk:home-footer");
    expect(own?.priority).toBeGreaterThan(PRIORITY);
  });
});
