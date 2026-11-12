import { describe, expect, it } from "vitest";

import { CONSENT_MAX_AGE_DAYS } from "@/lib/legal";

import { parseSaved } from "./consent";

const NOW = Date.UTC(2026, 10, 12);
const DAY = 86_400_000;

const saved = (choice: string, at: number) => JSON.stringify({ choice, at });

describe("parseSaved", () => {
  it("reads an accepted and a rejected choice", () => {
    expect(parseSaved(saved("accepted", NOW - DAY), NOW)).toEqual({
      choice: "accepted",
      at: NOW - DAY,
    });
    expect(parseSaved(saved("rejected", NOW), NOW)?.choice).toBe("rejected");
  });

  it("has nothing when nothing is saved", () => {
    expect(parseSaved(null, NOW)).toBeNull();
    expect(parseSaved("", NOW)).toBeNull();
  });

  it("ignores a value that is not a choice", () => {
    expect(parseSaved("not json", NOW)).toBeNull();
    expect(parseSaved("42", NOW)).toBeNull();
    expect(parseSaved("null", NOW)).toBeNull();
    expect(parseSaved(saved("maybe", NOW), NOW)).toBeNull();
    expect(parseSaved(JSON.stringify({ choice: "accepted" }), NOW)).toBeNull();
    expect(parseSaved(JSON.stringify({ choice: "accepted", at: "yesterday" }), NOW)).toBeNull();
  });

  it("asks again after a year, and not before", () => {
    const edge = CONSENT_MAX_AGE_DAYS * DAY;
    expect(parseSaved(saved("accepted", NOW - edge), NOW)).not.toBeNull();
    expect(parseSaved(saved("accepted", NOW - edge - 1), NOW)).toBeNull();
  });

  it("ignores a choice dated in the future", () => {
    expect(parseSaved(saved("accepted", NOW + 2 * DAY), NOW)).toBeNull();
  });
});
