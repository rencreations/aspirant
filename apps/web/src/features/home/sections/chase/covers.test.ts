import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHASE } from "../../content";
import { COMIC_COVERS, coverUrl } from "./covers";

const REPO = path.resolve(import.meta.dirname, "../../../../../../..");

interface ComicRecord {
  slug: string;
  title: string;
  cover: { p: string };
}

const items = (
  JSON.parse(readFileSync(path.join(REPO, "apps/web/public/data/library/comic.json"), "utf8")) as {
    items: ComicRecord[];
  }
).items;

describe("the covers in Tetra's book", () => {
  it.each(["left", "right"] as const)(
    "names the %s cover by the key the collection's data gives",
    (side) => {
      const cover = COMIC_COVERS[side];
      const record = items.find((c) => c.slug === cover.slug);
      expect(record, cover.slug).toBeDefined();
      expect(record?.cover.p).toBe(cover.key);
    },
  );

  it("is the pair the owner asked for: The Aspirants on the left, Vexana and Guinevere on the right", () => {
    expect(CHASE.left.href).toContain(COMIC_COVERS.left.slug);
    expect(CHASE.right.href).toContain(COMIC_COVERS.right.slug);
    expect(items.find((c) => c.slug === COMIC_COVERS.left.slug)?.title).toBe("The Aspirant");
    expect(items.find((c) => c.slug === COMIC_COVERS.right.slug)?.title).toBe(
      "Guinevere and Vexana",
    );
  });

  it("makes the address of the library file", () => {
    expect(coverUrl("left")).toMatch(/\/library\/v1\/comic\/the-aspirant\/cover\/p\.webp$/);
    expect(coverUrl("right")).toMatch(/\/library\/v1\/comic\/guinevere-vexana\/cover\/p\.webp$/);
  });
});
