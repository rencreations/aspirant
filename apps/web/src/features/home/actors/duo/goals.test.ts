import { describe, expect, it } from "vitest";

import { TAU } from "@/features/about/choreo/ease";

import {
  buildGoal,
  carry,
  carryReach,
  crank,
  dance,
  DANCE_LOOP,
  distToEdge,
  floatGoal,
  haul,
  leave,
  pull,
  type CarryMemory,
  type Ctx,
  type PairMode,
} from "./goals";
import { gloveOffset, newGoal, type DroneGoal, type DuoMarkKind, type Vec2 } from "./pose";

const HOME: readonly [Vec2, Vec2] = [
  { x: -200, y: 0 },
  { x: 200, y: 0 },
];

interface Seen {
  kind: DuoMarkKind;
  x: number;
  y: number;
}

/** A context for one drone, with its marks collected. */
function ctxFor(who: 0 | 1, over: Partial<Ctx> = {}, seen: Seen[] = []): Ctx {
  const home = { ...HOME[who] };
  const other = { ...HOME[who === 0 ? 1 : 0] };
  return {
    who,
    t: 0,
    dt: 1 / 60,
    r: 100,
    home,
    other,
    now: { ...home },
    otherNow: { ...other },
    view: { w: 1440, h: 900 },
    pointer: null,
    w: 1,
    wPrev: 1,
    target: null,
    dir: { x: who === 0 ? -1 : 1, y: 0 },
    cue: (kind, x, y) => seen.push({ kind, x, y }),
    ...over,
  };
}

const mem = (): CarryMemory => ({ lift: 0, seen: false });

function goal(who: 0 | 1, pair: PairMode, over: Partial<Ctx> = {}, seen: Seen[] = []): DroneGoal {
  const g = newGoal();
  buildGoal(g, ctxFor(who, over, seen), pair, null, mem());
  return g;
}

const finite = (g: DroneGoal): boolean =>
  [g.x, g.y, g.z, g.radius, g.yaw, g.pitch, g.roll, g.spin, g.squash, g.gl.x, g.gl.y, g.gr.x].every(
    Number.isFinite,
  );

describe("the float", () => {
  it("stays within a fraction of a radius of its place, for ever", () => {
    for (const who of [0, 1] as const) {
      for (let t = 0; t < 60; t += 0.25) {
        const g = goal(who, { kind: "float" }, { t });
        expect(finite(g)).toBe(true);
        expect(Math.abs(g.x - HOME[who].x)).toBeLessThan(20);
        expect(Math.abs(g.y - HOME[who].y)).toBeLessThan(20);
      }
    }
  });

  it("looks at the pointer when it is near, else not at it", () => {
    const near = { x: HOME[0].x + 100, y: 40 };
    expect(goal(0, { kind: "float" }, { pointer: near }).look).toBe(near);
    const far = { x: 5000, y: 0 };
    expect(goal(0, { kind: "float" }, { pointer: far }).look).not.toBe(far);
  });

  it("the two drones do not move in step", () => {
    const a = goal(0, { kind: "float" }, { t: 3 });
    const b = goal(1, { kind: "float" }, { t: 3 });
    expect(a.y - HOME[0].y).not.toBeCloseTo(b.y - HOME[1].y, 3);
  });
});

describe("every simple pose", () => {
  const poses = [
    "float",
    "dance",
    "stare",
    "confused",
    "question",
    "wave",
    "bow",
    "leave",
  ] as const;

  it("makes finite goals for both drones at every time and weight", () => {
    for (const kind of poses) {
      for (const who of [0, 1] as const) {
        for (let t = 0; t < 30; t += 0.37) {
          for (const w of [0, 0.3, 1]) {
            const g = goal(who, { kind }, { t, w });
            expect(finite(g), `${kind} ${who} ${t} ${w}`).toBe(true);
          }
        }
      }
    }
  });

  it("weight 0 is the float, for every pose", () => {
    for (const kind of poses) {
      const t = 5.3;
      const base = goal(0, { kind: "float" }, { t });
      const g = goal(0, { kind }, { t, w: 0, wPrev: 0 });
      expect(g.x, kind).toBeCloseTo(base.x, 9);
      expect(g.y, kind).toBeCloseTo(base.y, 9);
      expect(g.roll, kind).toBeCloseTo(base.roll, 9);
      expect(g.gl.x, kind).toBeCloseTo(base.gl.x, 9);
    }
  });
});

describe("the dance", () => {
  /** What the dance adds to the float at a moment (the float's own drift is taken out). */
  function offset(who: 0 | 1, t: number): { x: number; y: number; roll: number; spin: number } {
    const d = goal(who, { kind: "dance" }, { t });
    const f = goal(who, { kind: "float" }, { t });
    return { x: d.x - f.x, y: d.y - f.y, roll: d.roll - f.roll, spin: d.spin - f.spin };
  }

  it("is the same after a whole loop, the spins counted in whole turns", () => {
    for (const who of [0, 1] as const) {
      for (const t of [0.2, 1.7, 3.9, 6.1, 9.4, 11.3]) {
        const a = offset(who, t);
        const b = offset(who, t + DANCE_LOOP);
        expect(b.x).toBeCloseTo(a.x, 6);
        expect(b.y).toBeCloseTo(a.y, 6);
        expect(b.roll).toBeCloseTo(a.roll, 6);
        const turn = (b.spin - a.spin) / TAU;
        expect(Math.abs(turn - Math.round(turn))).toBeLessThan(1e-6);
      }
    }
  });

  it("each phrase begins and ends with the drone at its place", () => {
    for (const who of [0, 1] as const) {
      for (let k = 0; k < 4; k += 1) {
        // Just after the start of a phrase and just before its end.
        for (const t of [k * 3 + 1e-6, (k + 1) * 3 - 1e-6]) {
          const o = offset(who, t);
          expect(Math.abs(o.x), `phrase ${k} x`).toBeLessThan(2);
          expect(Math.abs(o.y), `phrase ${k} y`).toBeLessThan(9);
          const turn = o.spin / TAU;
          expect(Math.abs(turn - Math.round(turn)), `phrase ${k} spin`).toBeLessThan(1e-3);
        }
      }
    }
  });

  it("the two mirror each other in the first phrase: they lean in together", () => {
    const t = 0.4;
    const a = goal(0, { kind: "dance" }, { t });
    const b = goal(1, { kind: "dance" }, { t });
    // Offsets from home are opposite in x: one leans toward the other and so does the other.
    expect(Math.sign(a.x - goal(0, { kind: "float" }, { t }).x)).toBe(
      -Math.sign(b.x - goal(1, { kind: "float" }, { t }).x),
    );
  });

  it("the bump reaches the middle between them and cues a spark", () => {
    const seen: Seen[] = [];
    const c0 = ctxFor(0, {}, seen);
    // Step through the third phrase.
    for (let t = 6; t < 9; t += 1 / 60) {
      c0.t = t;
      c0.dt = 1 / 60;
      const g = newGoal();
      floatGoal(g, c0);
      dance(g, c0);
    }
    expect(seen.some((s) => s.kind === "spark")).toBe(true);
  });
});

describe("leave", () => {
  it("at the end it is off the screen, whichever way it goes", () => {
    for (let a = 0; a < 12; a += 1) {
      const dir = { x: Math.cos((a / 12) * TAU), y: Math.sin((a / 12) * TAU) };
      const g = newGoal();
      const c = ctxFor(0, { w: 1, wPrev: 1, dir });
      floatGoal(g, c);
      const homeX = g.x;
      const homeY = g.y;
      leave(g, c);
      const outX = Math.abs(g.x) > 720 + 100;
      const outY = Math.abs(g.y) > 450 + 100;
      expect(outX || outY, `direction ${a}`).toBe(true);
      expect(Math.hypot(g.x - homeX, g.y - homeY)).toBeGreaterThan(100);
    }
  });

  it("at the start (weight 0) nothing has moved", () => {
    const g = newGoal();
    const c = ctxFor(0, { w: 0 });
    floatGoal(g, c);
    const x = g.x;
    leave(g, c);
    expect(g.x).toBe(x);
  });

  it("the distance to the edge is exact on the axes and 0 outside", () => {
    expect(distToEdge({ x: 0, y: 0 }, { x: 1, y: 0 }, { w: 1000, h: 600 })).toBe(500);
    expect(distToEdge({ x: 0, y: 0 }, { x: 0, y: -1 }, { w: 1000, h: 600 })).toBe(300);
    expect(distToEdge({ x: 900, y: 0 }, { x: 1, y: 0 }, { w: 1000, h: 600 })).toBe(0);
  });
});

describe("carry", () => {
  const params = (tension: number, struggle: number, lift: number) => ({
    x: 0,
    y: 0,
    width: 360,
    tension,
    struggle,
    lift,
  });

  function carryGoal(who: 0 | 1, p: ReturnType<typeof params>, t = 1, seen: Seen[] = []) {
    const g = newGoal();
    const c = ctxFor(who, { t }, seen);
    floatGoal(g, c);
    carry(g, c, p, mem());
    return g;
  }

  it("the inner glove lands on its end of the payload, however the ball is turned", () => {
    const at = { x: 0, y: 0, z: 0 };
    for (const tension of [0, 0.5, 1]) {
      for (const lift of [0, 0.6, -0.6]) {
        for (const who of [0, 1] as const) {
          const g = carryGoal(who, params(tension, 0, lift));
          const inner = who === 0 ? g.gl : g.gr;
          gloveOffset(at, inner.x, inner.y, inner.z, g.yaw, g.roll);
          expect(g.x + at.x * 100, `tension ${tension} lift ${lift}`).toBeCloseTo(
            who === 0 ? -180 : 180,
            6,
          );
          expect(g.y + at.y * 100, `tension ${tension} lift ${lift}`).toBeCloseTo(lift * 110, 6);
        }
      }
    }
  });

  it("the balls stand outside the ends, a reach away", () => {
    const a = carryGoal(0, params(0.5, 0, 0));
    const b = carryGoal(1, params(0.5, 0, 0));
    expect(a.x).toBeLessThan(-180 - 1.5 * 100);
    expect(b.x).toBeGreaterThan(180 + 1.5 * 100);
  });

  it("each holds its end with the glove that is on the payload's side of the ball", () => {
    const a = carryGoal(0, params(0.5, 0, 0));
    const b = carryGoal(1, params(0.5, 0, 0));
    // `a` is on the left: the glove on the RIGHT of the screen (the model's left) reaches in.
    expect(a.gl.x).toBeGreaterThan(1.5);
    expect(a.gl.omega).toBeGreaterThan(30);
    expect(b.gr.x).toBeLessThan(-1.5);
  });

  it("more tension reaches farther", () => {
    expect(carryReach(1)).toBeGreaterThan(carryReach(0));
  });

  it("their faces go with the cost", () => {
    expect(carryGoal(0, params(0.2, 0.1, 0.2)).face).toBe("bold");
    expect(carryGoal(0, params(0.5, 0.5, 0.2)).face).toBe("effort");
    expect(carryGoal(0, params(1, 0.9, 0.2)).face).toBe("strain");
    expect(carryGoal(0, params(1, 0.9, -0.9)).face).toBe("worry");
    expect(carryGoal(1, params(1, 0.9, -0.9)).face).toBe("surprise");
  });

  it("a drop of the payload is a jolt: a bang cue, and a rise is a heave with a spark", () => {
    const seen: Seen[] = [];
    const c = ctxFor(0, { t: 1 }, seen);
    const m = mem();
    const g = newGoal();
    floatGoal(g, c);
    carry(g, c, params(0.8, 0.8, 0.5), m);
    carry(g, c, params(0.8, 0.8, -0.5), m);
    expect(seen.some((s) => s.kind === "bang")).toBe(true);
    const seen2: Seen[] = [];
    const c2 = ctxFor(0, { t: 1 }, seen2);
    const m2 = mem();
    carry(g, c2, params(0.8, 0.8, -0.5), m2);
    carry(g, c2, params(0.8, 0.8, 0.5), m2);
    expect(seen2.some((s) => s.kind === "spark")).toBe(true);
  });

  it("a lift of the payload lifts the balls, a sag lowers them", () => {
    const up = carryGoal(0, params(0.5, 0, 1)).y;
    const down = carryGoal(0, params(0.5, 0, -1)).y;
    expect(up).toBeGreaterThan(down + 100);
  });

  it("the struggle makes the drones bob against each other", () => {
    const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
    const hard: number[] = [];
    const calm: number[] = [];
    for (let t = 0; t < 6; t += 0.05) {
      hard.push(carryGoal(0, params(0.9, 1, 0), t).y);
      calm.push(carryGoal(0, params(0.9, 0, 0), t).y);
    }
    expect(spread(hard)).toBeGreaterThan(20);
    expect(spread(calm)).toBeLessThan(1);
  });
});

describe("pull", () => {
  const rect = (w: number, h: number, strain = 0.5) => ({ cx: 0, cy: 0, w, h, strain });

  function pullGoal(who: 0 | 1, p: ReturnType<typeof rect>, t = 1): DroneGoal {
    const g = newGoal();
    const c = ctxFor(who, { t });
    floatGoal(g, c);
    pull(g, c, p);
    return g;
  }

  it("a holds the bottom left corner and b the top right, bodies outside", () => {
    const a = pullGoal(0, rect(600, 200));
    const b = pullGoal(1, rect(600, 200));
    expect(a.x).toBeLessThan(-300);
    expect(a.y).toBeLessThan(-100);
    expect(b.x).toBeGreaterThan(300);
    expect(b.y).toBeGreaterThan(100);
  });

  it("each pinned glove is on its corner, when the arm reaches", () => {
    const a = pullGoal(0, rect(600, 200));
    const pinned = a.gl.free ? a.gl : a.gr;
    expect(pinned.free).toBe(true);
    expect(pinned.hard).toBe(true);
    expect(pinned.fx).toBeCloseTo(-300, 6);
    expect(pinned.fy).toBeCloseTo(-100, 6);
  });

  it("a corner farther than an arm is held as far as the arm reaches", () => {
    const a = pullGoal(0, rect(2000, 800));
    const g = a.gl.free ? a.gl : a.gr;
    const reach = Math.hypot(g.fx - a.x, g.fy - a.y);
    expect(reach).toBeLessThanOrEqual(3.4 * 100 + 1e-6);
  });

  it("the body follows a growing payload outward", () => {
    const small = pullGoal(1, rect(300, 100));
    const big = pullGoal(1, rect(900, 300));
    expect(big.x).toBeGreaterThan(small.x + 250);
    expect(big.y).toBeGreaterThan(small.y + 80);
  });

  it("strain shows in the face", () => {
    expect(pullGoal(0, rect(600, 200, 0.1)).face).toBe("bold");
    expect(pullGoal(0, rect(600, 200, 0.5)).face).toBe("effort");
    expect(pullGoal(0, rect(600, 200, 0.9)).face).toBe("strain");
  });
});

describe("crank and haul", () => {
  it("a crank pins the nearer glove to the handle and looks at it", () => {
    const g = newGoal();
    const c = ctxFor(0, { t: 2 });
    floatGoal(g, c);
    crank(g, c, { handle: { x: 400, y: -50 }, speed: 1, phase: 1 });
    const pinned = g.gl.free ? g.gl : g.gr;
    expect(pinned.free).toBe(true);
    expect(pinned.fx).toBe(400);
    expect(pinned.fy).toBe(-50);
    expect(g.look).toEqual({ x: 400, y: -50 });
  });

  it("a crank with no handle changes the face and nothing else", () => {
    const g = newGoal();
    const c = ctxFor(0, { t: 2 });
    floatGoal(g, c);
    const x = g.x;
    crank(g, c, { handle: null, speed: 1.5, phase: 0 });
    expect(g.x).toBe(x);
    expect(g.face).toBe("effort");
  });

  it("the face goes from glad to squeezed to effort as the crank speeds up", () => {
    const faces = [0.3, 1, 1.5].map((speed) => {
      const g = newGoal();
      const c = ctxFor(0);
      crank(g, c, { handle: null, speed, phase: 0 });
      return g.face;
    });
    expect(faces).toEqual(["glad", "squeeze", "effort"]);
  });

  it("a haul puts the drone ahead of the handle along the pull", () => {
    const g = newGoal();
    const c = ctxFor(0, { t: 1 });
    floatGoal(g, c);
    haul(g, c, {
      handle: { x: 300, y: 0 },
      vel: { x: -200, y: 0 },
      dir: { x: -1, y: 0 },
      strain: 0.5,
    });
    expect(g.x).toBeLessThan(300 - 150);
    const pinned = g.gl.free ? g.gl : g.gr;
    expect(pinned.fx).toBe(300);
  });

  it("a haul with no handle does nothing", () => {
    const g = newGoal();
    const c = ctxFor(0, { t: 1 });
    floatGoal(g, c);
    const x = g.x;
    haul(g, c, { handle: null, vel: { x: 0, y: 0 }, dir: { x: -1, y: 0 }, strain: 1 });
    expect(g.x).toBe(x);
  });
});

describe("confusion and the question", () => {
  it("the confusion asks with a question mark every couple of seconds", () => {
    const seen: Seen[] = [];
    const c = ctxFor(0, {}, seen);
    for (let t = 0; t < 8; t += 1 / 60) {
      c.t = t;
      const g = newGoal();
      floatGoal(g, c);
      buildGoal(g, c, { kind: "confused" }, null, mem());
    }
    expect(seen.filter((s) => s.kind === "ask").length).toBeGreaterThanOrEqual(3);
  });

  it("with a target they look at it, without one the eyes search", () => {
    const target = { x: 500, y: 100 };
    expect(goal(0, { kind: "confused" }, { target }).look).toBe(target);
    const searching = goal(0, { kind: "confused" }, { t: 1 }).look;
    expect(searching).not.toBeNull();
    expect(searching).not.toBe(target);
  });

  it("in the question one speaks while the other shrugs, and they swap", () => {
    const first = goal(0, { kind: "question" }, { t: 1 }).face;
    const second = goal(1, { kind: "question" }, { t: 1 }).face;
    expect([first, second].sort()).toEqual(["confused", "worry"]);
    const later0 = goal(0, { kind: "question" }, { t: 3.5 }).face;
    expect(later0).not.toBe(first);
  });

  it("the stare keeps the face to the visitor: the turn is small", () => {
    const g = goal(0, { kind: "stare" }, { target: { x: 900, y: 0 }, t: 2 });
    expect(Math.abs(g.yaw)).toBeLessThan(0.45);
    expect(g.face).toBe("wide");
  });
});
