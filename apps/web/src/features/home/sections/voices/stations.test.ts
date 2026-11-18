import { describe, expect, it } from "vitest";

import { validatePlays } from "../../kernel/plays";

import { OUT_FROM } from "./choreo";
import { AT_ENTER, AT_LEAVE, REST_V, SECONDS, VOICES_PLAYS } from "./stations";

describe("the voices plays", () => {
  it("are a valid table: white at the start, the rest in the middle, the corners at the end", () => {
    expect(() => {
      validatePlays("voices", VOICES_PLAYS);
    }).not.toThrow();
    expect(VOICES_PLAYS.map((p) => p.from)).toEqual([0, REST_V]);
    expect(VOICES_PLAYS.map((p) => p.to)).toEqual([REST_V, 1]);
    expect(AT_ENTER).toBeLessThan(AT_LEAVE);
  });

  it("are short: an entrance of about a second and a leave under a second", () => {
    expect(SECONDS.enter).toBeLessThanOrEqual(1.2);
    expect(SECONDS.leave).toBeLessThanOrEqual(1);
  });

  it("leave a long rest before the leave begins (the list is read and played there)", () => {
    // The leave starts a little after the rest, so the rest is a true standing state.
    expect(OUT_FROM).toBeGreaterThan(REST_V);
    expect(OUT_FROM - REST_V).toBeLessThan(0.1);
  });

  it("fire the leave at least a third of a screen before the end, out of the music's lead", () => {
    // `screens` is 1.5 in `index.ts`: 1.5 * (1 - 0.78) = 0.33 screen of calm before the music.
    expect(1 - AT_LEAVE).toBeGreaterThan(0.2);
    expect(AT_ENTER).toBeLessThan(0.1);
  });
});
