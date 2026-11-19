import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { alongPath, besidePoint, type PathPoint } from "./path";
import { BODY_HEIGHT_METRES, FACES_A_BYTES, FACES_B_BYTES, MARKS_BYTES } from "./model";
import { createShockLook, shockAt, SHOCK_SECONDS } from "./marks-anim";
import { BANG_CELL, CELL } from "./marks";
import {
  ANNOYED_AT,
  ANNOYED_MAX,
  createAnswer,
  createReactions,
  DIZZY_AT,
  press,
  PUZZLED_AT,
  stepReactions,
  WINDOW,
} from "./reactions";
import { createPoseLook, createPoseState, stepPose } from "./pose";
import {
  bowCurve,
  clearTrick,
  createTricks,
  createTrickPose,
  startTrick,
  stepTricks,
  trickPose,
  TRICK_SECONDS,
  type TrickKind,
} from "./tricks";

const KINDS = Object.keys(TRICK_SECONDS) as TrickKind[];

describe("the moves", () => {
  it("every move finishes in its own time, whatever else happens", () => {
    for (const kind of KINDS) {
      const tr = createTricks();
      expect(startTrick(tr, kind)).toBe(true);
      let t = 0;
      while (tr.kind && t < 5) {
        stepTricks(tr, 1 / 60);
        t += 1 / 60;
      }
      expect(tr.kind, kind).toBeNull();
      expect(t, kind).toBeCloseTo(TRICK_SECONDS[kind], 1);
    }
  });

  it("refuses a second move while one plays", () => {
    const tr = createTricks();
    expect(startTrick(tr, "hop")).toBe(true);
    expect(startTrick(tr, "roll")).toBe(false);
    clearTrick(tr);
    expect(startTrick(tr, "roll")).toBe(true);
  });

  it("starts and ends at rest: no move leaves the drone turned or moved", () => {
    const out = createTrickPose();
    for (const kind of KINDS) {
      const tr = createTricks();
      startTrick(tr, kind);
      trickPose(tr, out);
      const turn = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
      expect(turn(out.yaw), `${kind} start yaw`).toBeLessThan(0.05);
      expect(turn(out.pitch), `${kind} start pitch`).toBeLessThan(0.05);
      expect(turn(out.roll), `${kind} start roll`).toBeLessThan(0.05);
      tr.t = TRICK_SECONDS[kind] - 1e-6;
      trickPose(tr, out);
      // A whole turn ends where it began, and the others have died away.
      expect(turn(out.yaw), `${kind} end yaw`).toBeLessThan(0.05);
      expect(turn(out.pitch), `${kind} end pitch`).toBeLessThan(0.05);
      expect(turn(out.roll), `${kind} end roll`).toBeLessThan(0.05);
      expect(Math.abs(out.dx), `${kind} end dx`).toBeLessThan(0.02);
      expect(Math.abs(out.dy), `${kind} end dy`).toBeLessThan(0.02);
    }
  });

  it("gives nothing when no move plays", () => {
    const out = createTrickPose();
    out.yaw = 3;
    trickPose(createTricks(), out);
    expect(out.yaw).toBe(0);
    expect(out.face).toBeNull();
  });

  it("goes the other way for the other direction", () => {
    const a = createTricks();
    const b = createTricks();
    startTrick(a, "barrel", 1);
    startTrick(b, "barrel", -1);
    a.t = 0.3;
    b.t = 0.3;
    const pa = trickPose(a, createTrickPose());
    const pb = trickPose(b, createTrickPose());
    expect(Math.sign(pa.roll)).toBe(-Math.sign(pb.roll));
  });

  it("bows down, holds and comes up", () => {
    expect(bowCurve(0)).toBe(0);
    expect(bowCurve(0.4)).toBe(1);
    expect(bowCurve(1)).toBeCloseTo(0, 9);
    expect(bowCurve(0.15)).toBeGreaterThan(0.2);
    expect(bowCurve(0.15)).toBeLessThan(0.8);
  });
});

describe("the answers to a press", () => {
  it("answers the first presses kindly, each with its own move and never a mark", () => {
    const r = createReactions();
    const out = createAnswer();
    const seen: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      press(r, 10 + i * 5, out);
      expect(out.fired).toBe(true);
      expect(out.face).toBe("happy");
      expect(out.shock).toBe(false);
      seen.push(`${out.trick}`);
    }
    press(r, 100, out);
    expect(out.shock).toBe(false);
    seen.push(`${out.trick}`);
    expect(new Set(seen).size).toBe(3);
  });

  it("goes dizzy at the third quick press, puzzled at the fourth, annoyed at the fifth", () => {
    const r = createReactions();
    const out = createAnswer();
    const log: string[] = [];
    for (let i = 1; i <= ANNOYED_AT; i += 1) {
      press(r, i * 0.3, out);
      log.push(`${out.trick}|${out.shock}|${out.face}`);
    }
    expect(log[DIZZY_AT - 1]).toBe("dizzy|false|null");
    expect(log[PUZZLED_AT - 1]).toBe("null|false|confused");
    expect(log[ANNOYED_AT - 1]).toBe("shake|true|angry");
    expect(r.mood).toBe("annoyed");
  });

  it("does not hold it against a visitor who waits between presses", () => {
    const r = createReactions();
    const out = createAnswer();
    for (let i = 0; i < 12; i += 1) {
      press(r, i * (WINDOW + 0.5), out);
      expect(out.face).toBe("happy");
    }
    expect(r.mood).toBe("calm");
  });

  it("stays annoyed while pressed, but not for ever", () => {
    const r = createReactions();
    const out = createAnswer();
    for (let i = 0; i < ANNOYED_AT; i += 1) press(r, i * 0.2, out);
    const started = r.started;
    for (let i = 0; i < 40; i += 1) press(r, started + i * 0.4, out);
    expect(r.until).toBeLessThanOrEqual(started + ANNOYED_MAX + 1e-9);
    expect(out.shock).toBe(true);
  });

  it("forgives when the visitor stops, once, and then is calm again", () => {
    const r = createReactions();
    const out = createAnswer();
    for (let i = 0; i < ANNOYED_AT; i += 1) press(r, i * 0.2, out);
    let forgiven = 0;
    let now = 1;
    for (let i = 0; i < 600; i += 1) {
      now += 1 / 60;
      stepReactions(r, now, out);
      if (out.fired) {
        forgiven += 1;
        expect(out.shock).toBe(false);
        expect(out.face).toBe("thanks");
      }
    }
    expect(forgiven).toBe(1);
    expect(r.mood).toBe("calm");
    press(r, now + 1, out);
    expect(out.face).toBe("happy");
  });
});

describe("the named poses", () => {
  const run = (wanted: "peek" | "thanks" | null, seconds: number, dir = 1) => {
    const s = createPoseState();
    const out = createPoseLook();
    for (let i = 0; i < seconds * 60; i += 1) stepPose(s, wanted, dir, 1 / 60, out);
    return { s, out };
  };

  it("peeks toward the side of the thing: the face, the eyes and the lean go that way", () => {
    const right = run("peek", 2, 1).out;
    const left = run("peek", 2, -1).out;
    expect(right.yaw).toBeGreaterThan(0.4);
    expect(left.yaw).toBeLessThan(-0.4);
    expect(right.eyeX).toBeGreaterThan(0.8);
    // To lean to the right is clockwise, which is a negative roll.
    expect(right.roll).toBeLessThan(0);
    expect(left.roll).toBeGreaterThan(0);
    expect(right.scale).toBeLessThan(1);
  });

  it("bows once for a thank you, with the kind face, then stands upright", () => {
    const { s, out } = run("thanks", 3);
    expect(out.face).toBe("thanks");
    expect(out.pitch).toBeCloseTo(0, 2);
    expect(s.t).toBeGreaterThan(2.9);
  });

  it("is at the bottom of the bow part way through", () => {
    const s = createPoseState();
    const out = createPoseLook();
    let deepest = 0;
    for (let i = 0; i < 90; i += 1) {
      stepPose(s, "thanks", 1, 1 / 60, out);
      deepest = Math.max(deepest, out.pitch);
    }
    expect(deepest).toBeGreaterThan(0.4);
  });

  it("blends out when it is no longer wanted and leaves nothing behind", () => {
    const s = createPoseState();
    const out = createPoseLook();
    for (let i = 0; i < 120; i += 1) stepPose(s, "peek", 1, 1 / 60, out);
    for (let i = 0; i < 300; i += 1) stepPose(s, null, 1, 1 / 60, out);
    expect(s.current).toBeNull();
    expect(out.yaw).toBe(0);
    expect(out.scale).toBe(1);
  });
});

describe("the icons", () => {
  it("keep the bang where the file says", () => {
    const root = path.resolve(import.meta.dirname, "../../../../../public/img/home");
    const json = JSON.parse(readFileSync(path.join(root, "marks.json"), "utf8")) as {
      cell: number;
      icons: Record<string, { x: number; y: number }>;
    };
    expect(json.cell).toBe(CELL);
    expect(BANG_CELL.col * json.cell).toBe(json.icons.bang?.x);
    expect(BANG_CELL.row * json.cell).toBe(json.icons.bang?.y);
  });

  it("have the sizes the loading list says", () => {
    const root = path.resolve(import.meta.dirname, "../../../../../public/img/home");
    expect(readFileSync(path.join(root, "drone-faces.webp")).length).toBe(FACES_A_BYTES);
    expect(readFileSync(path.join(root, "drone-faces-2.webp")).length).toBe(FACES_B_BYTES);
    expect(readFileSync(path.join(root, "marks.webp")).length).toBe(MARKS_BYTES);
  });
});

describe("the marks' timing", () => {
  it("bursts the lines out fast and is gone at its end", () => {
    const out = createShockLook();
    expect(shockAt(0.4, out).burst).toBeGreaterThan(0.99);
    expect(shockAt(0.05, out).burst).toBeLessThan(shockAt(0.2, out).burst);
    let peak = 0;
    for (let t = 0; t < 0.4; t += 1 / 60) peak = Math.max(peak, shockAt(t, out).bang);
    expect(peak).toBeGreaterThan(1.05);
    expect(shockAt(SHOCK_SECONDS, out)).toEqual({
      bang: 0,
      bangRot: 0,
      bangAlpha: 0,
      burst: 0,
      lineAlpha: 0,
    });
    expect(shockAt(0.9, out).lineAlpha).toBe(0);
  });
});

describe("the placing helpers", () => {
  it("stands beside a point and looks at it", () => {
    const out = { x: 0, y: 0, height: 0 };
    const left = besidePoint({ x: 100, y: 50 }, "left", 120, out);
    expect(left.x).toBeLessThan(100);
    expect(left.y).toBe(50);
    expect(left.yaw).toBeGreaterThan(0);
    const right = besidePoint({ x: 100, y: 50 }, "right", 120, { ...out });
    expect(100 - left.x).toBeCloseTo(right.x - 100, 9);
    expect(right.yaw).toBeCloseTo(-(left.yaw ?? 0), 9);
    const above = besidePoint({ x: 0, y: 0 }, "above", 100, { ...out });
    expect(above.y).toBeGreaterThan(50);
    expect(above.pitch).toBeGreaterThan(0);
    const below = besidePoint({ x: 0, y: 0 }, "below", 100, { ...out });
    expect(below.y).toBeLessThan(-50);
  });

  it("leaves a larger gap for a larger drone, and none of the drone on the point", () => {
    const out = { x: 0, y: 0, height: 0 };
    const near = besidePoint({ x: 0, y: 0 }, "right", 100, out, 0.1).x;
    const far = besidePoint({ x: 0, y: 0 }, "right", 200, { ...out }, 0.1).x;
    expect(far).toBeGreaterThan(near * 1.9);
    expect(near).toBeGreaterThan(50);
  });

  const points: PathPoint[] = [
    { x: -400, y: -300, height: 100 },
    { x: 0, y: 100, height: 200 },
    { x: 500, y: 0, height: 120 },
  ];

  it("flies along a path through its points, and stays at the ends outside 0 to 1", () => {
    const out: PathPoint = { x: 0, y: 0, height: 0 };
    expect(alongPath(points, 0, out)).toEqual(points[0]);
    expect(alongPath(points, 1, out)).toEqual(points[2]);
    expect(alongPath(points, -3, out)).toEqual(points[0]);
    expect(alongPath(points, 3, out)).toEqual(points[2]);
    // The middle point is passed at the share of the length it sits at.
    const l1 = Math.hypot(400, 400);
    const l2 = Math.hypot(500, 100);
    const at = alongPath(points, l1 / (l1 + l2), out);
    expect(at.x).toBeCloseTo(0, 3);
    expect(at.y).toBeCloseTo(100, 3);
    expect(at.height).toBeCloseTo(200, 3);
  });

  it("moves without a jump along it", () => {
    const out: PathPoint = { x: 0, y: 0, height: 0 };
    let last = { ...alongPath(points, 0, out) };
    let worst = 0;
    for (let i = 1; i <= 400; i += 1) {
      const p = alongPath(points, i / 400, out);
      worst = Math.max(worst, Math.hypot(p.x - last.x, p.y - last.y));
      last = { ...p };
    }
    // The line is about 1500 px long: no step of 1/400 of it is more than a few times its share.
    expect(worst).toBeLessThan(12);
  });

  it("makes a straight line from two points and copes with none and with one", () => {
    const out: PathPoint = { x: 0, y: 0, height: 0 };
    const mid = alongPath(
      [
        { x: 0, y: 0, height: 100 },
        { x: 100, y: 200, height: 300 },
      ],
      0.5,
      out,
    );
    expect(mid.x).toBeCloseTo(50, 6);
    expect(mid.y).toBeCloseTo(100, 6);
    expect(mid.height).toBeCloseTo(200, 6);
    expect(alongPath([], 0.5, out).height).toBe(100);
    expect(alongPath([{ x: 7, y: 8, height: 9 }], 0.5, out)).toEqual({ x: 7, y: 8, height: 9 });
  });
});

describe("the model's numbers", () => {
  it("has the height the file's own bounds give", () => {
    const file = readFileSync(
      path.resolve(import.meta.dirname, "../../../../../public/models/about/drone.glb"),
    );
    const jsonLength = file.readUInt32LE(12);
    const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8")) as {
      accessors: Array<{ min?: number[]; max?: number[] }>;
      meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
    };
    const position = json.meshes[0]?.primitives[0]?.attributes.POSITION ?? 0;
    const accessor = json.accessors[position];
    const height = (accessor?.max?.[1] ?? 0) - (accessor?.min?.[1] ?? 0);
    expect(height).toBeCloseTo(BODY_HEIGHT_METRES, 4);
  });
});
