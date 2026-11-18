import { describe, expect, it } from "vitest";

import { type Channels, restChannels } from "./channels";
import { FACE_NAMES } from "./face";
import { type BendKind, type PoseName, POSE_FACE, composePose, createPoseInput } from "./poses";

const NAMES = Object.keys(POSE_FACE) as PoseName[];
const BENDS: BendKind[] = ["earth", "air", "water", "fire"];

const numbers = (o: object): number[] =>
  Object.values(o).filter((v: unknown): v is number => typeof v === "number");

/** Every number of a frame, in a fixed order. */
function flat(c: Channels): number[] {
  const out: number[] = [c.x, c.y, c.z, c.yaw, c.pitch, c.roll, c.squash, c.clipTime, c.clipWeight];
  for (const v of Object.values(c)) {
    if (typeof v === "object" && v !== null) out.push(...numbers(v));
  }
  return out;
}

describe("the poses", () => {
  it("every pose is finite over a minute, at any speed and in every stance", () => {
    const c = restChannels();
    for (const name of NAMES) {
      for (const kind of BENDS) {
        for (const speed of [0, 0.5, 1]) {
          const input = createPoseInput();
          input.bend.kind = kind;
          input.speed = speed;
          for (let t = 0; t < 60; t += 0.37) {
            input.time = t;
            input.phase = t * 3.1;
            input.bend.phase = t * 0.42;
            composePose(name, input, c);
            expect(flat(c).every(Number.isFinite)).toBe(true);
          }
        }
      }
    }
  });

  it("each pose names a real face", () => {
    for (const name of NAMES) expect(FACE_NAMES).toContain(POSE_FACE[name]);
  });

  it("composing clears what the last pose left", () => {
    const c = restChannels();
    const input = createPoseInput();
    composePose("kite", input, c);
    expect(c.reachL.w).toBe(1);
    composePose("idle", input, c);
    expect(c.reachL.w).toBe(0);
    expect(c.legL.z).toBeLessThan(0.1);
  });

  it("the kite pose holds the reel with both hands, leans back and looks up", () => {
    const c = restChannels();
    composePose("kite", createPoseInput(), c);
    expect(c.reachL.w).toBe(1);
    expect(c.reachR.w).toBe(1);
    expect(c.reachL.x).toBeGreaterThan(0);
    expect(c.reachR.x).toBeLessThan(0);
    expect(c.spine.x).toBeLessThan(0);
    expect(c.head.x).toBeLessThan(0);
  });

  it("the run alternates her legs and arms and bounces, harder with speed", () => {
    const c = restChannels();
    const input = createPoseInput();
    input.speed = 1;
    input.phase = 0.25;
    composePose("run", input, c);
    expect(Math.sign(c.legL.x)).toBe(-Math.sign(c.legR.x));
    expect(Math.sign(c.armL.x)).toBe(-Math.sign(c.armR.x));
    // The arm swings against the leg on its side.
    expect(Math.sign(c.armL.x)).toBe(-Math.sign(c.legL.x));
    let peak = 0;
    for (let p = 0; p < 1; p += 0.05) {
      input.phase = p;
      composePose("run", input, c);
      peak = Math.max(peak, c.y);
      expect(c.y).toBeGreaterThanOrEqual(0);
    }
    expect(peak).toBeGreaterThan(0.03);
    const slow = restChannels();
    input.speed = 0;
    input.phase = 0.25;
    composePose("run", input, slow);
    const fast = restChannels();
    input.speed = 1;
    composePose("run", input, fast);
    expect(Math.abs(slow.legL.x)).toBeLessThan(Math.abs(fast.legL.x));
  });

  it("the run is a cycle: the end of a turn is the start of the next", () => {
    const a = restChannels();
    const b = restChannels();
    const input = createPoseInput();
    input.phase = 0.3;
    composePose("run", input, a);
    input.phase = 1.3;
    composePose("run", input, b);
    const fb = flat(b);
    flat(a).forEach((v, i) => {
      expect(Math.abs(v - (fb[i] ?? 0))).toBeLessThan(1e-9);
    });
  });

  it("sitting lowers her to the ground, and standing is back at her feet", () => {
    const c = restChannels();
    composePose("sit", createPoseInput(), c);
    expect(c.y).toBeLessThan(-0.1);
    expect(c.legL.x).toBeLessThan(-1);
    composePose("stand", createPoseInput(), c);
    expect(c.y).toBeGreaterThan(-0.05);
  });

  it("reading holds the hands in front of her, panting is bent over", () => {
    const c = restChannels();
    composePose("read", createPoseInput(), c);
    expect(c.reachL.w).toBe(1);
    expect(c.reachR.z).toBeGreaterThan(0.1);
    composePose("pant", createPoseInput(), c);
    expect(c.spine.x).toBeGreaterThan(0.3);
    expect(c.reachL.y).toBeLessThan(0.3);
  });

  it("every stance is a loop: the end of the cycle is its start", () => {
    for (const kind of BENDS) {
      const a = restChannels();
      const b = restChannels();
      const input = createPoseInput();
      input.bend.kind = kind;
      input.bend.phase = 0;
      composePose("bend", input, a);
      input.bend.phase = 1;
      composePose("bend", input, b);
      const fb = flat(b);
      flat(a).forEach((v, i) => {
        expect(Math.abs(v - (fb[i] ?? 0))).toBeLessThan(1e-6);
      });
    }
  });

  it("the stances differ from one another, and keep her near the ground", () => {
    const seen = new Set<string>();
    for (const kind of BENDS) {
      const c = restChannels();
      const input = createPoseInput();
      input.bend.kind = kind;
      input.bend.phase = 0.45;
      composePose("bend", input, c);
      seen.add(JSON.stringify([c.armL, c.armR, c.spine, c.hips]));
      expect(c.y).toBeGreaterThan(-0.12);
      expect(c.y).toBeLessThan(0.1);
    }
    expect(seen.size).toBe(4);
  });

  it("the stances are aimed: the body turns to the side asked for", () => {
    const l = restChannels();
    const r = restChannels();
    const input = createPoseInput();
    input.bend.kind = "earth";
    input.bend.phase = 0.5;
    input.bend.aim = -1;
    composePose("bend", input, l);
    input.bend.aim = 1;
    composePose("bend", input, r);
    expect(l.yaw).toBeLessThan(0);
    expect(r.yaw).toBeGreaterThan(0);
  });

  it("a pat leans her head to the side it comes from", () => {
    const c = restChannels();
    const input = createPoseInput();
    input.pat = { side: -1, lean: 1 };
    composePose("pat", input, c);
    expect(c.head.z).toBeLessThan(-0.1);
    input.pat = { side: 1, lean: 1 };
    composePose("pat", input, c);
    expect(c.head.z).toBeGreaterThan(0.1);
    input.pat.lean = 0;
    composePose("pat", input, c);
    expect(Math.abs(c.head.x)).toBeLessThan(0.05);
  });

  it("a hug goes to the point asked for with both hands, either side of it", () => {
    const c = restChannels();
    const input = createPoseInput();
    input.hug = { x: 0.1, y: 0.3, z: 0.2 };
    composePose("hug", input, c);
    expect(c.reachL.w).toBe(1);
    expect(c.reachL.y).toBeCloseTo(0.3, 9);
    expect(c.reachL.x).toBeGreaterThan(c.reachR.x);
    expect((c.reachL.x + c.reachR.x) / 2).toBeCloseTo(0.1, 9);
  });

  it("a wave raises the hand of the side asked for", () => {
    const c = restChannels();
    const input = createPoseInput();
    input.side = 1;
    composePose("wave", input, c);
    expect(c.armL.z).toBeGreaterThan(0.8);
    input.side = -1;
    composePose("wave", input, c);
    expect(c.armR.z).toBeLessThan(-0.8);
  });
});
