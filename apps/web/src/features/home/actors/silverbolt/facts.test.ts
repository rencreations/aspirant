import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BLADE_LENGTH,
  BLADES,
  BONE,
  CLIP,
  CLIP_DURATION,
  CLIP_LOOPS,
  CLIP_SCALE,
  DOLL_SOCKET_M,
  HINGE,
  JAW_ANGLE,
  JAW_AXIS,
  JAW_GAP,
  TAIL,
  TAIL_LENGTHS,
  TAIL_PITCH_AXIS,
  TAIL_YAW_AXIS,
  TONGUE_AXIS,
  type ClipName,
} from "./facts";

type Axis = [number, number, number];

interface Facts {
  jaw: {
    bone: string;
    axisLocal: Axis;
    closedAngle: number;
    restAngle: number;
    openMax: number;
    gaps: Record<string, number>;
  };
  tail: {
    chain: string[];
    segmentLengths: number[];
    pitchAxisLocal: Axis;
    yawAxisLocal: Axis;
  };
  eyes: { bones: string[] };
  tongue: Record<string, { curl: { axisLocal: Axis } }>;
  wings: {
    pairs: string[][];
    root: string;
    cheekBlades: string[];
    crest: string;
    bones: Record<
      string,
      { raise: { axisLocal: Axis; length: number }; spread: { axisLocal: Axis } }
    >;
  };
  head: { bone: string };
  root: { bone: string };
  clips: Record<string, { duration: number; loop: boolean }>;
  bones: Record<string, unknown>;
}

const MODELS = path.resolve(import.meta.dirname, "../../../../../public/models/home");
const facts = JSON.parse(readFileSync(path.join(MODELS, "silverbolt.facts.json"), "utf8")) as Facts;

describe("facts.ts agrees with the model's own facts file", () => {
  it("the bones are all in the model", () => {
    const names = [...Object.values(BONE), ...BLADES, ...TAIL, "Bone02_She_19", "Bone02_She_20"];
    for (const name of names) expect(facts.bones, name).toHaveProperty(name);
    expect(facts.head.bone).toBe(BONE.head);
    expect(facts.root.bone).toBe(BONE.root);
    expect(facts.jaw.bone).toBe(BONE.jaw);
    expect(facts.eyes.bones).toEqual([BONE.eyeL, BONE.eyeR]);
    expect(facts.wings.root).toBe(BONE.wingRoot);
    expect(facts.wings.cheekBlades).toEqual([BONE.cheekL, BONE.cheekR]);
    expect(facts.wings.crest).toBe(BONE.crest);
  });

  it("the jaw", () => {
    expect([...JAW_AXIS]).toEqual(facts.jaw.axisLocal);
    expect(JAW_ANGLE.closed).toBe(facts.jaw.closedAngle);
    expect(JAW_ANGLE.rest).toBe(facts.jaw.restAngle);
    expect(JAW_ANGLE.wide).toBe(facts.jaw.openMax);
    for (const [angle, gap] of Object.entries(JAW_GAP)) expect(facts.jaw.gaps[angle]).toBe(gap);
  });

  it("the tail chain, its lengths and its axes", () => {
    expect([...TAIL]).toEqual(facts.tail.chain);
    expect(TAIL_LENGTHS.length).toBe(facts.tail.segmentLengths.length);
    TAIL_LENGTHS.forEach((length, i) =>
      expect(length).toBeCloseTo(facts.tail.segmentLengths[i]!, 4),
    );
    expect([...TAIL_PITCH_AXIS]).toEqual(facts.tail.pitchAxisLocal);
    expect([...TAIL_YAW_AXIS]).toEqual(facts.tail.yawAxisLocal);
  });

  it("the tongue curls about the model's axes", () => {
    expect([...TONGUE_AXIS.tongue0]).toEqual(facts.tongue.Bone02_She_19!.curl.axisLocal);
    expect([...TONGUE_AXIS.tongue1]).toEqual(facts.tongue.Bone02_She_20!.curl.axisLocal);
  });

  it("the six blades are the three pairs, left first", () => {
    expect([...BLADES]).toEqual(facts.wings.pairs.flat());
  });

  it("every hinge axis and blade length", () => {
    for (const [name, hinge] of Object.entries(HINGE)) {
      const fact = facts.wings.bones[name]!;
      expect(fact, name).toBeDefined();
      expect([...hinge.raise]).toEqual(fact.raise.axisLocal);
      expect([...hinge.spread]).toEqual(fact.spread.axisLocal);
      // The crest has no length of its own in the table.
      if (name in BLADE_LENGTH) expect(BLADE_LENGTH[name]).toBeCloseTo(fact.raise.length, 3);
    }
  });

  it("the clips: names, lengths and which of them loop", () => {
    for (const name of Object.values(CLIP) as ClipName[]) {
      const fact = facts.clips[name]!;
      expect(fact, name).toBeDefined();
      expect(CLIP_DURATION[name]).toBeCloseTo(fact.duration, 5);
      expect(CLIP_LOOPS[name]).toBe(fact.loop);
    }
  });

  it("a doll in a socket is as tall as the doll beside the 1.4 m dragon", () => {
    expect(DOLL_SOCKET_M * CLIP_SCALE).toBeCloseTo(0.12, 6);
  });
});
