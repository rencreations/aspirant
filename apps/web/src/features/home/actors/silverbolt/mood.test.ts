import { describe, expect, it } from "vitest";

import { ANNOY, AnnoyMeter, REACTION_LENGTH, Reactions, reactionValue } from "./mood";
import type { ReactionKind } from "./mood";

const KINDS = Object.keys(REACTION_LENGTH) as ReactionKind[];

describe("AnnoyMeter", () => {
  it("rises with pokes and enters the annoyed state when it is full", () => {
    const m = new AnnoyMeter();
    m.poke(0.3);
    m.poke(0.3);
    m.poke(0.3);
    expect(m.annoyed).toBe(false);
    expect(m.level).toBeCloseTo(0.9);
    expect(m.outbursts).toBe(0);
    m.poke(0.3);
    expect(m.annoyed).toBe(true);
    expect(m.outbursts).toBe(1);
    expect(m.left).toBe(ANNOY.hold);
  });

  it("drains when nobody pokes", () => {
    const m = new AnnoyMeter();
    m.poke(0.5);
    m.step(1);
    expect(m.level).toBeCloseTo(0.5 - ANNOY.decay);
    m.step(100);
    expect(m.level).toBe(0);
  });

  it("calms down after the hold and starts the next round low", () => {
    const m = new AnnoyMeter();
    m.poke(1);
    m.step(ANNOY.hold - 0.1);
    expect(m.annoyed).toBe(true);
    m.step(0.2);
    expect(m.annoyed).toBe(false);
    expect(m.level).toBe(ANNOY.after);
    expect(m.outbursts).toBe(1);
  });

  it("more pokes stretch the state, up to a limit", () => {
    const m = new AnnoyMeter();
    m.poke(1);
    m.poke(0.5);
    expect(m.left).toBeCloseTo(ANNOY.hold + 1);
    for (let i = 0; i < 50; i++) m.poke(0.5);
    expect(m.left).toBe(ANNOY.holdMax);
    expect(m.outbursts).toBe(1);
  });

  it("the face anger is half the meter, and all of it when annoyed", () => {
    const m = new AnnoyMeter();
    m.poke(0.6);
    expect(m.anger()).toBeCloseTo(0.3);
    m.poke(1);
    expect(m.anger()).toBe(1);
    m.reset();
    expect(m.anger()).toBe(0);
    expect(m.annoyed).toBe(false);
  });
});

describe("reactionValue", () => {
  it("is 0 before the start and after the end, and never exceeds 1", () => {
    for (const kind of KINDS) {
      expect(reactionValue(kind, -0.1)).toBe(0);
      expect(reactionValue(kind, REACTION_LENGTH[kind])).toBe(0);
      expect(reactionValue(kind, REACTION_LENGTH[kind] + 1)).toBe(0);
      for (let a = 0; a < REACTION_LENGTH[kind]; a += 0.01) {
        expect(Math.abs(reactionValue(kind, a))).toBeLessThanOrEqual(1);
      }
    }
  });

  it("the chomp closes again and the envelopes rise and fall", () => {
    expect(reactionValue("chomp", 0.1)).toBe(1);
    expect(reactionValue("chomp", 0.3)).toBeLessThan(0.3);
    expect(reactionValue("yelp", REACTION_LENGTH.yelp / 2)).toBeCloseTo(1);
    expect(reactionValue("flutter", 0.08)).toBeGreaterThan(0.8);
    expect(reactionValue("flutter", 1.7)).toBeLessThan(0.1);
  });
});

describe("Reactions", () => {
  it("runs a reaction and always lets it finish", () => {
    const r = new Reactions();
    expect(r.active("chomp")).toBe(false);
    r.trigger("chomp");
    expect(r.active("chomp")).toBe(true);
    r.step(0.1);
    expect(r.value("chomp")).toBe(1);
    r.step(0.5);
    expect(r.active("chomp")).toBe(false);
    expect(r.value("chomp")).toBe(0);
  });

  it("a new one restarts the same kind and carries its strength", () => {
    const r = new Reactions();
    r.trigger("chomp", 0.5);
    r.step(0.2);
    r.trigger("chomp", 0.5);
    r.step(0.1);
    expect(r.value("chomp")).toBeCloseTo(0.5);
  });

  it("remaining counts down from 1 to 0", () => {
    const r = new Reactions();
    expect(r.remaining("shake")).toBe(0);
    r.trigger("shake");
    expect(r.remaining("shake")).toBe(1);
    r.step(REACTION_LENGTH.shake / 2);
    expect(r.remaining("shake")).toBeCloseTo(0.5);
    r.clear();
    expect(r.remaining("shake")).toBe(0);
    expect(r.active("shake")).toBe(false);
  });
});
