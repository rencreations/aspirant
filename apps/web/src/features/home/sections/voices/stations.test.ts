import { describe, expect, it } from "vitest";

import { DT_MAX } from "../../kernel/clock";
import { layoutSections } from "../../kernel/layout";
import { validatePlays, zoneValue } from "../../kernel/plays";
import { SECTIONS } from "../../kernel/sections";
import { SELENA_SPEED } from "../../kernel/speed";
import { STORY } from "../selena/stations";
import { beatsAt } from "../selena/timeline";

import { OUT_FROM } from "./choreo";
import {
  AUTO_REACH,
  ENTER_SECONDS,
  LENGTHS,
  PAST_WHITE,
  REST_V,
  VOICES_PLAYS,
  VOICES_SCREENS,
  VOICES_ZONES,
  WHITE_BEFORE,
} from "./stations";

/** What Selena's way out shows at a place on the page (screens from the top). */
function selenaAt(S: number) {
  const layout = layoutSections(SECTIONS);
  const selena = layout.placed.find((p) => p.id === "selena")!;
  const film = selena.def.plays![1]!;
  const s = (S - selena.start) / selena.def.screens;
  return beatsAt(Math.min(1, zoneValue(film, s)) * STORY);
}

describe("the voices stations", () => {
  it("are a valid table: the way in from 0 to the rest, the way out from the rest to 1", () => {
    expect(() => {
      validatePlays("voices", VOICES_PLAYS, -0.5 / VOICES_SCREENS);
    }).not.toThrow();
    expect(VOICES_PLAYS.map((p) => p.from)).toEqual([0, REST_V]);
    expect(VOICES_PLAYS.map((p) => p.to)).toEqual([REST_V, 1]);
  });

  it("come in on a clock (a trigger, on the picture) and go out by the scroll (a zone)", () => {
    const [enter, leave] = VOICES_PLAYS;
    expect(enter!.span).toBeUndefined();
    expect(enter!.drawn).toBe(true);
    expect(enter!.seconds).toBe(ENTER_SECONDS);
    expect(leave!.span).toBeGreaterThan(0);
    // The page is held while it runs: it is short, as the owner asked of every scene.
    expect(ENTER_SECONDS).toBeLessThanOrEqual(2.5);
  });

  it("fire the way in the moment Selena's white has covered the screen, in the lead", () => {
    const layout = layoutSections(SECTIONS);
    const voices = layout.placed.find((p) => p.id === "voices")!;
    const enter = VOICES_PLAYS[0]!;
    expect(enter.at * VOICES_SCREENS).toBeCloseTo(PAST_WHITE - WHITE_BEFORE, 9);
    expect(enter.at * VOICES_SCREENS).toBeGreaterThan(-voices.def.lead);
    const white = voices.start - WHITE_BEFORE;
    // The white is whole there, and not yet a hair before it.
    expect(selenaAt(white).white).toBe(1);
    expect(selenaAt(white).actors).toBe(false);
    expect(selenaAt(white - 0.002).white).toBe(0);
    // The way in fires a frame's move later at most (40 px), so the way back, which starts on the frame
    // that crosses it going up, still stands on the whole white.
    const at = voices.start + enter.at * voices.def.screens;
    expect(at - white).toBeCloseTo(PAST_WHITE, 9);
    expect(PAST_WHITE).toBeGreaterThan(SELENA_SPEED * DT_MAX);
    expect(PAST_WHITE).toBeLessThanOrEqual(0.05);
    expect(selenaAt(at - SELENA_SPEED * DT_MAX).white).toBe(1);
    // A visitor is carried on only from where the white covers all but a sliver.
    expect(selenaAt(at - AUTO_REACH).wipe).toBeGreaterThanOrEqual(0.98);
    expect(enter.auto).toBe(AUTO_REACH);
  });

  it("lay out in screens: a long rest, the way out ending at the section's end", () => {
    const [leave] = VOICES_ZONES;
    expect(leave!.from).toBeCloseTo(LENGTHS.rest, 9);
    expect(leave!.to).toBeCloseTo(VOICES_SCREENS, 9);
  });

  it("are short, and the rest is the long part (it is text and information)", () => {
    expect(LENGTHS.leave).toBeLessThanOrEqual(1);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(LENGTHS.leave);
    expect(LENGTHS.rest).toBeGreaterThanOrEqual(0.9);
  });

  it("begin the leave a little after the rest, so the rest is a true standing state", () => {
    expect(OUT_FROM).toBeGreaterThan(REST_V);
    expect(OUT_FROM - REST_V).toBeLessThan(0.1);
  });
});
