import { describe, expect, it } from "vitest";

import { createFace, stepFace, type FaceFrame } from "./face";
import { isClear, layerStep, nearestClear } from "./layering";
import { beatRate, createRig, stepRig, type RigInput, type RigPose } from "./rig";

const DT = 1 / 60;
const deg = (d: number) => (d * Math.PI) / 180;

const STILL: RigInput = { fast: 0, effort: 0, flare: 0, ax: 0, ay: 0, happy: 0, time: 0 };

/** Run the rig for a while and keep every pose. */
function run(input: RigInput, seconds: number, rig = createRig()): RigPose[] {
  const out: RigPose[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i += 1) {
    out.push(stepRig(rig, { ...input, time: i * DT }, DT));
  }
  return out;
}

const range = (values: number[]) => Math.max(...values) - Math.min(...values);

/** How many times a value changes direction: twice for every beat. */
function turns(values: number[]): number {
  let n = 0;
  for (let i = 2; i < values.length; i += 1) {
    const a = (values[i - 1] ?? 0) - (values[i - 2] ?? 0);
    const b = (values[i] ?? 0) - (values[i - 1] ?? 0);
    if (a * b < 0) n += 1;
  }
  return n;
}

describe("the rig", () => {
  it("breathes at rest and beats in flight: quicker and deeper the harder it works", () => {
    const rest = run(STILL, 6).slice(120);
    const flight = run({ ...STILL, fast: 1 }, 6).slice(120);
    const restRaise = rest.map((p) => p.wingRaiseL);
    const flightRaise = flight.map((p) => p.wingRaiseL);
    expect(range(restRaise)).toBeGreaterThan(deg(8));
    expect(range(restRaise)).toBeLessThan(deg(20));
    expect(range(flightRaise)).toBeGreaterThan(3 * range(restRaise));
    expect(turns(flightRaise)).toBeGreaterThan(5 * turns(restRaise));
    expect(beatRate(0)).toBeLessThan(0.6);
    expect(beatRate(1)).toBeGreaterThan(4);
    expect(beatRate(0.5)).toBeGreaterThan(beatRate(0.2));
  });

  it("moves both wings alike when nothing pushes it sideways", () => {
    for (const p of run({ ...STILL, fast: 0.6 }, 2)) {
      expect(p.wingRaiseL).toBeCloseTo(p.wingRaiseR, 9);
      expect(p.wingSpreadL).toBeCloseTo(p.wingSpreadR, 9);
      expect(p.finSplayL).toBeCloseTo(p.finSplayR, 9);
    }
  });

  it("opens its wings wide to brake", () => {
    const glide = run(STILL, 2).pop();
    const brake = run({ ...STILL, flare: 1 }, 2).pop();
    expect((brake?.wingSpreadL ?? 0) - (glide?.wingSpreadL ?? 0)).toBeGreaterThan(deg(15));
  });

  it("trails the body: a push shows in the wings and fins a moment later, then settles", () => {
    const rig = createRig();
    run(STILL, 2, rig);
    // A hard push to the right for a tenth of a second.
    const pushed = run({ ...STILL, ax: 4 }, 0.1, rig);
    const after = run(STILL, 3, rig);
    const lean = (p: RigPose | undefined) => (p?.wingRaiseL ?? 0) - (p?.wingRaiseR ?? 0);
    expect(Math.abs(lean(pushed[0]))).toBeLessThan(deg(2));
    expect(Math.max(...[...pushed, ...after.slice(0, 20)].map(lean))).toBeGreaterThan(deg(3));
    // It swings past and comes back: the lean changes sign before it dies away.
    expect(Math.min(...after.map(lean))).toBeLessThan(0);
    expect(Math.abs(lean(after[after.length - 1]))).toBeLessThan(deg(0.5));
    const splay = [...pushed, ...after].map((p) => p.finSplayL - p.finSplayR);
    expect(range(splay)).toBeGreaterThan(deg(2));
  });

  it("holds its fins up and out for joy", () => {
    const plain = run(STILL, 1.5).pop();
    const happy = run({ ...STILL, happy: 1 }, 1.5).pop();
    expect((happy?.finStandL ?? 0) - (plain?.finStandL ?? 0)).toBeGreaterThan(deg(8));
    expect((happy?.finSplayL ?? 0) - (plain?.finSplayL ?? 0)).toBeGreaterThan(deg(8));
  });

  it("stays inside what the model can do without tearing, whatever it is fed", () => {
    const wild: RigInput = { fast: 1, effort: 1, flare: 1, ax: 40, ay: -40, happy: 1, time: 0 };
    const rig = createRig();
    for (const input of [wild, { ...wild, ax: -40, ay: 40 }, STILL]) {
      for (const p of run(input, 2, rig)) {
        for (const raise of [p.wingRaiseL, p.wingRaiseR]) {
          expect(raise).toBeGreaterThanOrEqual(deg(-60));
          expect(raise).toBeLessThanOrEqual(deg(80));
        }
        for (const spread of [p.wingSpreadL, p.wingSpreadR]) {
          expect(spread).toBeGreaterThanOrEqual(0);
          expect(spread).toBeLessThanOrEqual(deg(100));
        }
        for (const stand of [p.finStandL, p.finStandR]) {
          expect(Math.abs(stand)).toBeLessThanOrEqual(deg(45));
        }
        for (const strip of [p.stripL, p.stripR])
          expect(Math.abs(strip)).toBeLessThanOrEqual(deg(22));
      }
    }
  });

  it("survives a long frame", () => {
    const rig = createRig();
    const p = stepRig(rig, { ...STILL, fast: 1, ax: 30, ay: 30 }, 0.5);
    for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("the face", () => {
  /** Run the face and write down when each blink starts. */
  function watch(seconds: number, seed = 7) {
    const face = createFace(seed);
    const starts: number[] = [];
    let shut = false;
    for (let i = 0; i < Math.round(seconds / DT); i += 1) {
      const f = stepFace(face, "normal", { x: 0, y: 0 }, DT);
      if (f.blink > 0.5 && !shut) starts.push(i * DT);
      shut = f.blink > 0.5;
    }
    return starts;
  }

  it("blinks at uneven intervals, sometimes twice", () => {
    const starts = watch(180);
    const gaps = starts.slice(1).map((t, i) => t - (starts[i] ?? 0));
    expect(starts.length).toBeGreaterThan(30);
    expect(Math.max(...gaps)).toBeGreaterThan(3);
    expect(gaps.filter((g) => g < 0.5).length).toBeGreaterThan(2);
    expect(new Set(gaps.map((g) => g.toFixed(1))).size).toBeGreaterThan(10);
    // The same every time, so a probe sees what a visitor sees.
    expect(watch(180)).toEqual(starts);
    expect(watch(180, 99)).not.toEqual(starts);
  });

  it("shuts its eyes all the way and opens them again", () => {
    const face = createFace();
    let most = 0;
    let last: FaceFrame | null = null;
    for (let i = 0; i < 600; i += 1) {
      last = stepFace(face, "normal", { x: 0, y: 0 }, DT);
      most = Math.max(most, last.blink);
      expect(last.blink).toBeGreaterThanOrEqual(0);
      expect(last.blink).toBeLessThanOrEqual(1);
    }
    expect(most).toBeGreaterThan(0.95);
  });

  it("changes one drawing for another only behind a blink", () => {
    const face = createFace();
    for (let i = 0; i < 30; i += 1) stepFace(face, "normal", { x: 0, y: 0 }, DT);
    let cell = "normal";
    let changed = 0;
    for (let i = 0; i < 60; i += 1) {
      const f = stepFace(face, "happy", { x: 0, y: 0 }, DT);
      if (f.cell !== cell) {
        // The frame the drawing changes on, the eyes are (nearly) shut.
        expect(f.blink).toBeGreaterThan(0.85);
        changed += 1;
        cell = f.cell;
      }
    }
    expect(changed).toBe(1);
    expect(cell).toBe("happy");
  });

  it("slides its eyes to look, a little, and never past the edge of the screen", () => {
    const face = createFace();
    let f = stepFace(face, "normal", { x: 0, y: 0 }, DT);
    for (let i = 0; i < 60; i += 1) f = stepFace(face, "normal", { x: 9, y: -9 }, DT);
    expect(f.lookX).toBeGreaterThan(0.05);
    expect(f.lookX).toBeLessThanOrEqual(0.1);
    expect(f.lookY).toBeLessThan(-0.03);
    expect(f.lookY).toBeGreaterThanOrEqual(-0.1);
  });
});

describe("the side of the film the drone is drawn on", () => {
  const screen = { vw: 1440, vh: 900, navH: 80 };
  const film = { x: 72, y: 230, w: 1296, h: 547 };
  const perch = { x: 1232, y: 194, size: 130 };
  const above = { x: 1232, y: 140, size: 110 };
  const middle = { x: 720, y: 500, size: 400 };

  it("stays where it is while the side is right", () => {
    expect(
      layerStep({
        wanted: "behind",
        actual: "behind",
        pose: middle,
        target: middle,
        film,
        ...screen,
      }),
    ).toEqual({ side: "behind", detour: null });
  });

  it("changes at once when there is no film on the screen, or the drone is clear of it", () => {
    const base = {
      wanted: "front",
      actual: "behind",
      pose: middle,
      target: middle,
      ...screen,
    } as const;
    expect(layerStep({ ...base, film: null }).side).toBe("front");
    expect(layerStep({ ...base, film: { ...film, y: -900 } }).side).toBe("front");
    expect(isClear(above, film)).toBe(true);
    expect(layerStep({ ...base, pose: above, film })).toEqual({ side: "front", detour: null });
  });

  it("waits, without a way round, when the drone is headed for a clear place anyway", () => {
    expect(
      layerStep({ wanted: "front", actual: "behind", pose: perch, target: above, film, ...screen }),
    ).toEqual({ side: "behind", detour: null });
  });

  it("goes to the nearest clear place first when it is headed for a place that is not clear", () => {
    const out = layerStep({
      wanted: "front",
      actual: "behind",
      pose: perch,
      target: middle,
      film,
      ...screen,
    });
    expect(out.side).toBe("behind");
    expect(out.detour).not.toBeNull();
    if (!out.detour) return;
    expect(isClear(out.detour, film)).toBe(true);
    // From the perch that is straight up: over the window's edge, under the bar.
    expect(out.detour.x).toBeCloseTo(perch.x, 3);
    expect(out.detour.y).toBeLessThan(perch.y);
    expect(out.detour.y - out.detour.size / 2).toBeGreaterThanOrEqual(screen.navH);
  });

  it("in a fast scroll changes at once from the perch, but never makes the drone vanish", () => {
    const base = { actual: "behind", target: middle, film, ...screen, hurry: true } as const;
    expect(layerStep({ ...base, wanted: "front", pose: perch }).side).toBe("front");
    // In front of the film's middle, asked to go behind it: it must go round.
    const out = layerStep({
      ...base,
      wanted: "behind",
      actual: "front",
      pose: middle,
      target: perch,
    });
    expect(out.side).toBe("front");
    expect(out.detour).not.toBeNull();
  });

  it("finds a clear place beside a film that fills the screen's height, or none at all", () => {
    const tall = { x: 300, y: 80, w: 800, h: 820 };
    const beside = nearestClear({ x: 400, y: 500, size: 120 }, tall, 1440, 900, 80);
    expect(beside && isClear(beside, tall)).toBe(true);
    expect(beside?.x ?? 999).toBeLessThan(300);
    expect(nearestClear(middle, { x: 0, y: 80, w: 1440, h: 820 }, 1440, 900, 80)).toBeNull();
  });
});
