import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BONE,
  CLIP,
  ELBOW,
  HAND_MODEL,
  HAND_MODEL_BYTES,
  PALM,
  REACH_SECONDS,
  BREATH_SECONDS,
} from "./constants";
import { FINGERS, fingerBones, flexAxis, spreadAxis } from "./fingers";
import { handItems } from "./preload";

const PUBLIC = path.resolve(import.meta.dirname, "../../../../../public");

interface Facts {
  skeleton: {
    hand: string;
    bracer: string;
    forearm: string;
    fingers: Record<
      string,
      { chain: string[]; flexAxisLocal: number[]; spreadAxisLocal: number[] }
    >;
  };
  palm: { offsetInBoneFrame: number[]; normal: number[]; spanAcross: number; spanAlong: number };
  clips: Record<string, { duration: number }>;
  view: { camera: { position: number[]; target: number[] } };
}

const facts = JSON.parse(
  readFileSync(path.join(PUBLIC, "models/home/hand.facts.json"), "utf8"),
) as Facts;

const three = (name: string): string => name.replaceAll(" ", "_");

describe("the constants agree with the model's facts", () => {
  it("the bones are the ones the model has, with the names three.js gives", () => {
    expect(BONE.hand).toBe(three(facts.skeleton.hand));
    expect(BONE.bracer).toBe(three(facts.skeleton.bracer));
    expect(BONE.forearm).toBe(three(facts.skeleton.forearm));
    for (const f of FINGERS) {
      const chain = facts.skeleton.fingers[f]!.chain.map(three);
      expect([...fingerBones(f)]).toEqual(chain);
      expect([...flexAxis(f)]).toEqual(facts.skeleton.fingers[f]!.flexAxisLocal);
      expect([...spreadAxis(f)]).toEqual(facts.skeleton.fingers[f]!.spreadAxisLocal);
    }
  });

  it("the palm is where the facts put it", () => {
    expect([...PALM.offset]).toEqual(facts.palm.offsetInBoneFrame);
    expect([...PALM.normal]).toEqual(facts.palm.normal);
    expect(PALM.span).toBe(facts.palm.spanAcross);
    expect(PALM.length).toBe(facts.palm.spanAlong);
  });

  it("the clips are the ones the model has, with their lengths", () => {
    expect(facts.clips[CLIP.reach]?.duration).toBe(REACH_SECONDS);
    expect(facts.clips[CLIP.breath]?.duration).toBe(BREATH_SECONDS);
  });

  it("the elbow camera is the one the notes asked the page to start from", () => {
    expect([...ELBOW.position]).toEqual(facts.view.camera.position);
    expect([...ELBOW.target]).toEqual(facts.view.camera.target);
  });
});

describe("handItems", () => {
  it("names the file that is really there, with its real size", () => {
    expect(HAND_MODEL.startsWith("/")).toBe(true);
    expect(statSync(path.join(PUBLIC, HAND_MODEL)).size).toBe(HAND_MODEL_BYTES);
  });

  it("is deferred by default, with a priority, so the bar does not wait for it", () => {
    const [item, ...rest] = handItems();
    expect(rest).toEqual([]);
    expect(item?.deferred).toBe(true);
    expect(item?.priority).toBe(40);
    expect(item?.id).toBe(`media:${HAND_MODEL}`);
  });

  it("is waited for when a section says the hand is on the first screen, and takes a priority", () => {
    const [item] = handItems({ deferred: false });
    expect(item?.deferred).toBeUndefined();
    expect(item?.priority).toBeUndefined();
    const [late] = handItems({ priority: 55 });
    expect(late?.priority).toBe(55);
  });
});
