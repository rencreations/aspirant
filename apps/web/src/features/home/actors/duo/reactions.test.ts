import { describe, expect, it } from "vitest";

import { TAU } from "@/features/about/choreo/ease";

import { seeded } from "./curves";

import { floatGoal, type Ctx } from "./goals";
import { newGoal, type DroneGoal, type DuoMarkKind, type GloveGoal } from "./pose";
import {
  ANSWERS,
  hoverGoal,
  isGesture,
  nextAmbient,
  react,
  SECONDS,
  startMove,
  type Reaction,
} from "./reactions";

const KINDS = Object.keys(SECONDS) as Reaction[];

function ctxFor(who: 0 | 1, cues: DuoMarkKind[] = []): Ctx {
  const home = { x: who === 0 ? -200 : 200, y: 0 };
  const other = { x: who === 0 ? 200 : -200, y: 0 };
  return {
    who,
    t: 3,
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
    cue: (kind) => cues.push(kind),
  };
}

function base(who: 0 | 1): DroneGoal {
  const g = newGoal();
  floatGoal(g, ctxFor(who));
  return g;
}

const glove = (g: GloveGoal) => [g.x, g.y, g.z, g.rx, g.ry, g.rz, g.size];

/** The numbers of a goal that must be the same when a move is not in it. */
function numbers(g: DroneGoal): number[] {
  return [
    g.x,
    g.y,
    g.z,
    g.radius,
    g.yaw,
    g.pitch,
    g.roll,
    g.squash,
    g.earL.splay,
    g.earL.fold,
    g.earR.splay,
    g.earR.fold,
    g.lid,
    g.winkL,
    g.winkR,
    ...glove(g.gl),
    ...glove(g.gr),
  ];
}

/** Play a move for a time and return the goal at that time. */
function at(kind: Reaction, who: 0 | 1, t: number, was = t - 1 / 60): DroneGoal {
  const g = base(who);
  const m = startMove(kind);
  m.t = t;
  m.was = was;
  react(g, ctxFor(who), m);
  return g;
}

describe("every one-shot move", () => {
  it("is a move with a length", () => {
    for (const kind of KINDS) {
      expect(SECONDS[kind], kind).toBeGreaterThan(0.5);
      expect(startMove(kind).seconds).toBe(SECONDS[kind]);
    }
  });

  it("ends at rest: on its last frame the goal is the one without it", () => {
    for (const kind of KINDS) {
      for (const who of [0, 1] as const) {
        const rest = numbers(base(who));
        const end = numbers(at(kind, who, SECONDS[kind]));
        end.forEach((v, i) => {
          expect(v, `${kind} ${who} number ${i}`).toBeCloseTo(rest[i] ?? 0, 6);
        });
      }
    }
  });

  it("the spin ends on a whole number of turns", () => {
    for (const kind of KINDS) {
      for (const who of [0, 1] as const) {
        const turn = at(kind, who, SECONDS[kind]).spin / TAU;
        expect(Math.abs(turn - Math.round(turn)), `${kind} ${who}`).toBeLessThan(1e-6);
      }
    }
  });

  it("begins at rest too: nothing jumps in its first frame", () => {
    for (const kind of KINDS) {
      for (const who of [0, 1] as const) {
        const rest = numbers(base(who));
        const start = numbers(at(kind, who, 0, -1));
        start.forEach((v, i) => {
          expect(v, `${kind} ${who} number ${i}`).toBeCloseTo(rest[i] ?? 0, 6);
        });
      }
    }
  });

  it("stays finite from start to end", () => {
    for (const kind of KINDS) {
      for (let t = 0; t <= SECONDS[kind]; t += 0.05) {
        const g = at(kind, 0, t);
        for (const v of numbers(g)) expect(Number.isFinite(v), `${kind} ${t}`).toBe(true);
      }
    }
  });
});

describe("what they do", () => {
  it("the bold one's answers are a spin, a flex, jabs and a hop, the soft one's are shy", () => {
    expect(ANSWERS[0]).toEqual(["spin", "flex", "jabs", "hop"]);
    expect(ANSWERS[1]).toContain("shy");
    expect(ANSWERS[1]).toContain("giggle");
    // The hello belongs to the hover: a press does not repeat it.
    expect(ANSWERS[1]).not.toContain("hello");
  });

  it("a spin turns the ball a whole turn, in opposite ways for the two", () => {
    const a = at("spin", 0, 1.0);
    const b = at("spin", 1, 1.0);
    expect(Math.sign(a.spin)).toBe(-Math.sign(b.spin));
    expect(Math.abs(at("spin", 0, 1.1).spin)).toBeGreaterThan(5);
  });

  it("a hop lifts the ball and a cheer throws the gloves up", () => {
    expect(at("hop", 0, 0.4).y).toBeGreaterThan(base(0).y + 50);
    expect(at("cheer", 0, 0.8).gl.y).toBeGreaterThan(base(0).gl.y + 1);
  });

  it("a wink shuts one eye only, the one on its own side", () => {
    const a = at("wink", 0, 0.4);
    expect(a.winkR).toBeGreaterThan(0.9);
    expect(a.winkL).toBe(0);
    const b = at("wink", 1, 0.4);
    expect(b.winkL).toBeGreaterThan(0.9);
    expect(b.winkR).toBe(0);
  });

  it("dizzy turns into a swirl and stars, a pout turns its back", () => {
    const cues: DuoMarkKind[] = [];
    const c = ctxFor(0, cues);
    const g = base(0);
    const m = startMove("dizzy");
    m.t = 0.2;
    m.was = 0;
    react(g, c, m);
    m.t = 1;
    m.was = 0.8;
    react(g, c, m);
    expect(cues).toContain("swirl");
    expect(cues).toContain("star");
    expect(Math.abs(at("pout", 0, 0.8).yaw)).toBeGreaterThan(0.5);
  });

  it("each cue is made once, in the frame the move crosses it", () => {
    const cues: DuoMarkKind[] = [];
    const c = ctxFor(0, cues);
    const g = base(0);
    const m = startMove("spin");
    for (let t = 0; t <= m.seconds; t += 1 / 60) {
      m.was = m.t;
      m.t = t;
      react(g, c, m);
    }
    expect(cues.filter((k) => k === "spark")).toHaveLength(2);
    expect(cues.filter((k) => k === "puff")).toHaveLength(1);
  });

  it("gestures are what the other drone looks at; a jab, a wink and a giggle are not", () => {
    expect(isGesture("spin")).toBe(true);
    expect(isGesture("bump")).toBe(true);
    expect(isGesture("jabs")).toBe(false);
    expect(isGesture("wink")).toBe(false);
    expect(isGesture("giggle")).toBe(false);
  });
});

describe("the hover", () => {
  it("does nothing at 0 and squares the bold one up, shrinks the soft one", () => {
    for (const who of [0, 1] as const) {
      const g = base(who);
      const before = numbers(g);
      hoverGoal(g, who, 0);
      expect(numbers(g)).toEqual(before);
    }
    const a = base(0);
    hoverGoal(a, 0, 1);
    expect(a.radius).toBeGreaterThan(base(0).radius);
    expect(a.face).toBe("glad");
    const b = base(1);
    hoverGoal(b, 1, 1);
    expect(b.face).toBe("shy");
    expect(b.roll).toBeGreaterThan(base(1).roll);
  });
});

describe("the ambient life", () => {
  it("is calm: a move every six to twelve seconds, a real move, an answer a moment later", () => {
    const rand = seeded(11);
    let answered = 0;
    for (let i = 0; i < 200; i += 1) {
      const a = nextAmbient(rand);
      expect(a.wait).toBeGreaterThanOrEqual(6);
      expect(a.wait).toBeLessThanOrEqual(12);
      expect(KINDS).toContain(a.kind);
      expect(a.echoAfter).toBeGreaterThanOrEqual(0.45);
      expect(a.echoAfter).toBeLessThanOrEqual(0.85);
      if (a.echo) {
        answered += 1;
        expect(KINDS).toContain(a.echo);
      }
    }
    // Most of the time the other answers, not always.
    expect(answered).toBeGreaterThan(80);
    expect(answered).toBeLessThan(180);
  });

  it("is the same every run for the same seed", () => {
    expect(nextAmbient(seeded(5))).toEqual(nextAmbient(seeded(5)));
    expect(nextAmbient(seeded(5))).not.toEqual(nextAmbient(seeded(6)));
  });

  it("never asks for a move that needs the visitor: no bump, no dizzy, no sulk", () => {
    const rand = seeded(3);
    for (let i = 0; i < 300; i += 1) {
      const a = nextAmbient(rand);
      for (const kind of [a.kind, a.echo]) {
        expect(["bump", "dizzy", "fume", "pout", "cheer"]).not.toContain(kind);
      }
    }
  });
});
