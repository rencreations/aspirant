import { describe, expect, it } from "vitest";

import { BUNNY_TARGETS } from "../bunny/model";

import { createBunny, stepBunny } from "./bunny";
import { createCompanion, stepCompanion } from "./companion";
import {
  createDoll,
  DOLL_ACT_SECONDS,
  stepDoll,
  startAct,
  type DollAct,
  type DollInput,
} from "./doll";
import { DOLL_POSE_NAMES } from "./doll-poses";
import type { FriendBit, Gesture, Mood } from "./routines";

const GESTURES: Gesture[] = ["wave", "bow", "cheer", "jab", "punch", "hide", "bounce", "flex"];
const MOODS: Mood[] = [
  "happy",
  "love",
  "shy",
  "wide",
  "squint",
  "dizzy",
  "sad",
  "glad",
  "angry",
  "bold",
];

function bit(gesture: Gesture | null, mood: Mood | null, at: number): FriendBit {
  return {
    w: 1,
    x: 1.4,
    y: 0,
    lift: 0,
    scale: 1,
    front: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    spin: 0,
    squash: 1,
    mood,
    gesture,
    at,
    side: 1,
  };
}

const finite = (v: unknown): boolean => {
  if (typeof v === "number") return Number.isFinite(v);
  if (v instanceof Float32Array) return Array.from(v).every(Number.isFinite);
  if (Array.isArray(v)) return v.every(finite);
  if (v && typeof v === "object") return Object.values(v).every(finite);
  return true;
};

describe("Guinevere's drones", () => {
  it("snap to their place on the first frame, then follow it on springs", () => {
    const body = createCompanion(0);
    const first = stepCompanion(body, {
      dt: 1 / 60,
      x: 300,
      y: 200,
      radius: 24,
      z: 0,
      bit: null,
      look: null,
      snap: false,
    });
    expect(first.x).toBe(300);
    expect(first.y).toBe(200);
    const next = stepCompanion(body, {
      dt: 1 / 60,
      x: 400,
      y: 200,
      radius: 24,
      z: 0,
      bit: null,
      look: null,
      snap: false,
    });
    expect(next.x).toBeGreaterThan(300);
    expect(next.x).toBeLessThan(400);
  });

  it("play every gesture and wear every mood without a step or a bad number", () => {
    for (const who of [0, 1] as const) {
      for (const g of GESTURES) {
        const body = createCompanion(who);
        let gloveX = Number.NaN;
        for (let k = 0; k <= 90; k += 1) {
          const pose = stepCompanion(body, {
            dt: 1 / 60,
            x: 300,
            y: 200,
            radius: 24,
            z: 0,
            bit: bit(g, MOODS[k % MOODS.length] ?? null, k / 90),
            look: { x: 500, y: 300 },
            snap: false,
          });
          expect(finite(pose)).toBe(true);
          if (!Number.isNaN(gloveX)) expect(Math.abs(pose.gloveL.x - gloveX)).toBeLessThan(0.8);
          gloveX = pose.gloveL.x;
        }
      }
    }
  });
});

describe("Mr. Bunny", () => {
  it("keeps every shape between 0 and 1 and every number whole, through every gesture and mood", () => {
    for (const g of GESTURES) {
      const body = createBunny();
      for (let k = 0; k <= 120; k += 1) {
        const pose = stepBunny(body, {
          dt: 1 / 60,
          x: 300 + Math.sin(k / 9) * 200,
          y: 200,
          size: 90,
          z: 60,
          bit: bit(g, MOODS[k % MOODS.length] ?? null, k / 120),
          look: { x: 600, y: 300 },
        });
        expect(finite(pose)).toBe(true);
        expect(pose.targets.length).toBe(BUNNY_TARGETS.length);
        for (const w of pose.targets) {
          expect(w).toBeGreaterThanOrEqual(0);
          expect(w).toBeLessThanOrEqual(1);
        }
        // The README's ranges for the hinge.
        for (const ear of [pose.earL, pose.earR]) {
          expect(Math.abs(ear.twist)).toBeLessThanOrEqual((45 * Math.PI) / 180 + 1e-9);
          expect(ear.fold).toBeGreaterThanOrEqual((-60 * Math.PI) / 180 - 1e-9);
          expect(ear.splay).toBeLessThanOrEqual((60 * Math.PI) / 180 + 1e-9);
        }
      }
    }
  });
});

function ride(over: Partial<DollInput> = {}): DollInput {
  return {
    dt: 1 / 60,
    vx: 0,
    vy: 0,
    speed: 0,
    ax: 0,
    ay: 0,
    trick: null,
    atRest: true,
    look: null,
    pressed: false,
    arrived: false,
    homeward: false,
    ...over,
  };
}

describe("the doll", () => {
  it("plays every act to its end, with weights that ease and a face that changes", () => {
    for (const kind of Object.keys(DOLL_ACT_SECONDS) as DollAct[]) {
      const doll = createDoll();
      startAct(doll, kind);
      const faces = new Set<string>();
      let was: Record<string, number> | null = null;
      const frames = Math.ceil((DOLL_ACT_SECONDS[kind] + 0.5) * 60);
      for (let k = 0; k < frames; k += 1) {
        const f = stepDoll(doll, ride());
        expect(finite(f.turns)).toBe(true);
        faces.add(f.face.b);
        for (const name of DOLL_POSE_NAMES) {
          const w = f.weights[name];
          expect(w).toBeGreaterThanOrEqual(0);
          expect(w).toBeLessThanOrEqual(1);
          if (was) expect(Math.abs(w - (was[name] ?? 0))).toBeLessThan(0.25);
        }
        was = { ...f.weights };
      }
      expect(faces.size).toBeGreaterThan(0);
      expect(doll.act?.kind === kind).toBe(false);
    }
  });

  it("holds on in a fast flight, throws her arms up on a dive, and screams in a loop", () => {
    const doll = createDoll();
    let f = stepDoll(doll, ride());
    for (let k = 0; k < 60; k += 1)
      f = stepDoll(doll, ride({ speed: 1.2, vx: 1.2, atRest: false }));
    expect(f.weights.hold).toBeGreaterThan(0.6);
    for (let k = 0; k < 60; k += 1)
      f = stepDoll(doll, ride({ speed: 1.3, vy: 1.3, atRest: false }));
    expect(f.weights.wheee).toBeGreaterThan(0.6);
    for (let k = 0; k < 30; k += 1) {
      f = stepDoll(doll, ride({ trick: { kind: "loop", p: k / 30 }, atRest: false }));
    }
    expect(f.face.b).toBe("scream");
    // And a dizzy spell after it.
    f = stepDoll(doll, ride());
    expect(doll.act?.kind).toBe("dizzy");
  });

  it("jumps when the drone is pressed, cheers when she is picked up, waves on the way home", () => {
    const doll = createDoll();
    stepDoll(doll, ride({ pressed: true }));
    expect(doll.act?.kind).toBe("startle");
    stepDoll(doll, ride({ arrived: true }));
    expect(doll.act?.kind).toBe("cheer");
    stepDoll(doll, ride({ homeward: true }));
    expect(doll.act?.kind).toBe("bye");
  });

  it("plays her acts at rest in turn", () => {
    const doll = createDoll();
    const seen = new Set<string>();
    for (let k = 0; k < 60 * 60; k += 1) {
      stepDoll(doll, ride());
      if (doll.act) seen.add(doll.act.kind);
    }
    expect(seen.size).toBeGreaterThan(6);
  });
});
