import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHASE } from "../../content";
import { CARD_PICTURES } from "./covers";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

describe("the two comics beside Tetra", () => {
  it.each(["left", "right"] as const)("has the %s card's picture in the site's files", (side) => {
    expect(existsSync(path.join(PUBLIC, CARD_PICTURES[side]))).toBe(true);
  });

  it("is the pair the owner asked for: The Aspirants on the left, Vexana and Guinevere on the right", () => {
    expect(CHASE.left.href).toContain("the-aspirant");
    expect(CHASE.right.href).toContain("guinevere-and-vexana");
  });
});
