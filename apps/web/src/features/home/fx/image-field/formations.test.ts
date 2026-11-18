import { describe, expect, it } from "vitest";

import {
  blendFormations,
  blendLens,
  buildFormations,
  lensOf,
  poseOf,
  rankCards,
  RING_P,
  staggered,
  storyProgress,
} from "./formations";
import { TAU, qRotate, type V3 } from "./math";
import { BASE_DISTANCE, cardQuad, pointInQuad, project } from "./project";
import { logoBox, scatterLayout } from "./scatter";
import {
  TIMELINE,
  ringPoint,
  ringQuat,
  ringTurn,
  ringTurnAccel,
  ringTurnRate,
  storyAt,
  storyLens,
} from "./story";
import { makePose, type Quad, type Vp } from "./types";
import { WALL_DISTANCE, rowWay, wallFrame, wallGeom, wallSlotPose, wrapAround } from "./wall";

const WIDE: Vp = { w: 1440, h: 900 };
const TALL: Vp = { w: 390, h: 844 };
const N = 20;

describe("scatter", () => {
  for (const vp of [WIDE, TALL]) {
    const name = `${vp.w}x${vp.h}`;
    it(`is the same on every load (${name})`, () => {
      const a = scatterLayout(N, vp);
      const b = scatterLayout(N, vp);
      expect(a.map((p) => [p.x, p.y, p.z])).toEqual(b.map((p) => [p.x, p.y, p.z]));
    });

    it(`keeps the cards out of the logo's box and puts some above and some below (${name})`, () => {
      const box = logoBox(vp);
      let above = 0;
      let below = 0;
      for (const p of scatterLayout(N, vp)) {
        const s = BASE_DISTANCE / (BASE_DISTANCE - p.z);
        const sx = p.x * s;
        const sy = p.y * s;
        const inside = Math.abs(sx) < box.hw * 0.8 && Math.abs(sy) < box.hh * 0.8;
        expect(inside).toBe(false);
        if (sy > 0) above += 1;
        else below += 1;
      }
      expect(above).toBeGreaterThanOrEqual(5);
      expect(below).toBeGreaterThanOrEqual(5);
    });

    it(`has varied sizes that never exceed 1.2 of the base card (${name})`, () => {
      const hs = scatterLayout(N, vp).map((p) => p.h * (BASE_DISTANCE / (BASE_DISTANCE - p.z)));
      expect(Math.max(...hs)).toBeGreaterThan(Math.min(...hs) * 1.5);
    });
  }

  it("makes the logo's box 70 percent of the width", () => {
    const box = logoBox(WIDE);
    expect(box.hw * 2).toBeCloseTo(1008, 5);
    expect(box.hw / box.hh).toBeCloseTo(4.013, 5);
  });
});

describe("the ring's turn", () => {
  it("is half a turn by the end of the gather, and its derivatives are continuous", () => {
    expect(ringTurn(TIMELINE.freeze)).toBe(0);
    expect(ringTurn(TIMELINE.gatherEnd)).toBeCloseTo(Math.PI, 6);
    const edge = TIMELINE.freeze + 0.2 * (TIMELINE.gatherEnd - TIMELINE.freeze);
    expect(ringTurnRate(edge - 1e-9)).toBeCloseTo(ringTurnRate(edge + 1e-9), 4);
    expect(ringTurnAccel(0.1)).toBeGreaterThan(0);
    expect(ringTurnAccel(0.2)).toBe(0);
    // The numeric derivative agrees with the analytic one.
    const d = (ringTurn(0.2 + 1e-5) - ringTurn(0.2 - 1e-5)) / 2e-5;
    expect(d).toBeCloseTo(ringTurnRate(0.2), 3);
  });
});

describe("the gather is a spiral about the ring's axis", () => {
  for (const vp of [WIDE, TALL]) {
    it(`sweeps the angle toward the slot while the radius shrinks (${vp.w}x${vp.h})`, () => {
      const set = buildFormations(N, vp);
      const L = set.story;
      const out = makePose();
      const point: V3 = [0, 0, 0];
      let checked = 0;
      for (let i = 0; i < N; i++) {
        const start = L.scatter[i]!;
        const u = L.pick[i]!;
        // The card's cylindrical coordinates about the ring axis at three moments of its flight.
        const sample = (o: number) => {
          storyAt(L, u + TIMELINE.flight * o, i, 0, out);
          const dx = out.x - L.ring.cx;
          const dy = out.y - L.ring.cy;
          const dz = out.z;
          const f = dx * L.ring.front[0] + dy * L.ring.front[1] + dz * L.ring.front[2];
          const s = dx * L.ring.side[0] + dy * L.ring.side[1] + dz * L.ring.side[2];
          const up = dx * L.ring.axis[0] + dy * L.ring.axis[1] + dz * L.ring.axis[2];
          return { angle: Math.atan2(s, f), radius: Math.hypot(f, s), up };
        };
        const a = sample(0.001);
        const m = sample(0.3);
        const b = sample(1);
        // The end is on the ring: radius 0.75 R, height 0.
        expect(b.radius).toBeCloseTo(L.ring.slotRadius, 3);
        expect(b.up).toBeCloseTo(0, 3);
        ringPoint(
          L.ring,
          (TAU * L.slot[i]!) / N + ringTurn(u + TIMELINE.flight),
          L.ring.slotRadius,
          0,
          point,
        );
        expect(out.x).toBeCloseTo(point[0], 3);
        expect(out.y).toBeCloseTo(point[1], 3);
        // Mid flight: the radius is between the start and the end (shrinking toward it)...
        const lo = Math.min(a.radius, b.radius) - 1e-6;
        const hi = Math.max(a.radius, b.radius) + 1e-6;
        expect(m.radius).toBeGreaterThanOrEqual(lo);
        expect(m.radius).toBeLessThanOrEqual(hi);
        // ...and the angle has moved: a straight line in x, y, z would not turn about the axis. The
        // card takes the nearest way round, so its unwrapped travel is under one turn and a half.
        const wrap = (x: number) => x - TAU * Math.round(x / TAU);
        const total = Math.abs(wrap(b.angle - a.angle));
        const part = Math.abs(wrap(m.angle - a.angle));
        if (total > 0.5 && Math.abs(a.radius - b.radius) > 20) {
          checked += 1;
          expect(part).toBeGreaterThan(0);
          let travel = 0;
          let prev = sample(0.001).angle;
          for (let o = 0.05; o <= 1.0001; o += 0.05) {
            const next = sample(o).angle;
            travel += wrap(next - prev);
            prev = next;
          }
          expect(Math.abs(travel)).toBeLessThan(TAU * 1.5);
        }
        expect(start.h).toBeGreaterThan(0);
      }
      expect(checked).toBeGreaterThan(3);
    });
  }

  it("is continuous across the whole story, per card", () => {
    const set = buildFormations(N, WIDE);
    const a = makePose();
    const b = makePose();
    for (let i = 0; i < N; i++) {
      poseOf(set, "story", 0, i, 0, a);
      for (let p = 0.001; p <= 1; p += 0.001) {
        poseOf(set, "story", p, i, 0, b);
        // No step bigger than 90 pixels between two samples a thousandth of the story apart.
        expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(90);
        poseOf(set, "story", p, i, 0, a);
      }
    }
  });

  it("starts as the scatter and ends as the wall", () => {
    const set = buildFormations(N, WIDE);
    const a = makePose();
    const b = makePose();
    for (let i = 0; i < N; i++) {
      poseOf(set, "story", 0, i, 0, a);
      poseOf(set, "scatter", 0, i, 0, b);
      expect(a.x).toBeCloseTo(b.x, 6);
      expect(a.q[3]).toBeCloseTo(b.q[3], 6);
      poseOf(set, "story", 1, i, 17, a);
      poseOf(set, "wall", 0, i, 17, b);
      expect(a.x).toBeCloseTo(b.x, 6);
      expect(a.y).toBeCloseTo(b.y, 6);
      expect(a.shape).toBe(1);
    }
  });

  it("stands as a ring of portrait cards at the end of the hold", () => {
    const set = buildFormations(N, WIDE);
    const p = makePose();
    for (let i = 0; i < N; i++) {
      poseOf(set, "ring", 0, i, 0, p);
      expect(p.aspect).toBeCloseTo(0.8, 6);
      expect(p.shape).toBe(0);
      expect(p.h).toBeCloseTo(set.story.ring.cardH, 6);
    }
    expect(RING_P).toBeGreaterThan(TIMELINE.gatherEnd);
    expect(RING_P).toBeLessThan(TIMELINE.leaveStart);
  });

  it("sends the cards highest on the screen first", () => {
    const set = buildFormations(N, WIDE);
    const L = set.story;
    const ys = Array.from({ length: N }, (_, i) => {
      const s = L.scatter[i]!;
      return { y: s.y * (BASE_DISTANCE / (BASE_DISTANCE - s.z)), pick: L.pick[i]! };
    }).sort((a, b) => a.pick - b.pick);
    for (let k = 1; k < ys.length; k++) expect(ys[k]!.y).toBeLessThanOrEqual(ys[k - 1]!.y + 1e-9);
  });

  it("gives every card its own ring slot and its own wall slot", () => {
    const L = buildFormations(N, TALL).story;
    expect(new Set(Array.from(L.slot)).size).toBe(N);
    expect(new Set(Array.from(L.wallSlot)).size).toBe(N);
    expect(Array.from(L.slot).every((s) => s >= 0 && s < N)).toBe(true);
  });

  it("starts the land with the ring's own velocity", () => {
    const L = buildFormations(N, WIDE).story;
    const a = makePose();
    const b = makePose();
    for (let i = 0; i < N; i += 5) {
      const t = L.leave[i]!;
      storyAt(L, t - 1e-4, i, 0, a);
      storyAt(L, t + 1e-4, i, 0, b);
      // The position does not jump where the card leaves the ring.
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(2);
    }
  });

  it("lets a card with a key take the wall slot with the same key", () => {
    const cardKeys = Array.from({ length: N }, (_, i) => (i < 10 ? `c${i}` : null));
    const slotKeys = Array.from({ length: N }, (_, i) => (i % 2 === 0 ? `c${i / 2}` : null));
    const L = buildFormations(N, WIDE, { cardKeys, slotKeys }).story;
    for (let i = 0; i < 10; i++) expect(slotKeys[L.wallSlot[i]!]).toBe(`c${i}`);
  });
});

describe("the lens", () => {
  it("is the pixel lens in the hero and the long lens on the wall", () => {
    expect(storyLens(0)).toBe(BASE_DISTANCE);
    expect(storyLens(0.3)).toBe(BASE_DISTANCE);
    expect(storyLens(1)).toBe(WALL_DISTANCE);
    expect(lensOf("wall", 0)).toBe(WALL_DISTANCE);
    expect(lensOf("scatter", 0)).toBe(BASE_DISTANCE);
  });

  it("keeps the picture plane pixel-matched at both distances", () => {
    const out: [number, number] = [0, 0];
    for (const d of [BASE_DISTANCE, WALL_DISTANCE]) {
      expect(project(120, -80, 0, d, WIDE, out)).toBe(true);
      expect(out[0]).toBeCloseTo(720 + 120, 9);
      expect(out[1]).toBeCloseTo(450 + 80, 9);
    }
    // A point toward the camera grows, more at the pixel lens than at the long one.
    project(100, 0, 400, BASE_DISTANCE, WIDE, out);
    const near = out[0] - 720;
    project(100, 0, 400, WALL_DISTANCE, WIDE, out);
    expect(near).toBeGreaterThan(out[0] - 720);
    expect(project(0, 0, 1200, BASE_DISTANCE, WIDE, out)).toBe(false);
  });
});

describe("the wall", () => {
  it("rows slide in opposite ways and wrap", () => {
    expect(rowWay(0)).toBe(1);
    expect(rowWay(1)).toBe(-1);
    expect(wrapAround(10, 100)).toBe(10);
    expect(wrapAround(60, 100)).toBe(-40);
    expect(wrapAround(-60, 100)).toBe(40);
    expect(wrapAround(-50, 100)).toBe(-50);
  });

  it("lays three rows on a plane that leans back and rises to the right", () => {
    const g = wallGeom(18, wallFrame(WIDE, "wall"));
    expect(g.rowCount).toEqual([6, 6, 6]);
    // The row's own axis rises to the right and leans away from the viewer.
    expect(g.right[0]).toBeGreaterThan(0.5);
    expect(g.right[1]).toBeGreaterThan(0);
    expect(g.right[2]).toBeLessThan(0);
    // The plane's up leans back (its top is farther away), so the top row is smaller than the bottom row.
    expect(g.up[2]).toBeLessThan(0);
    const top = makePose();
    const bottom = makePose();
    wallSlotPose(g, 0, 0, top);
    wallSlotPose(g, 12, 0, bottom);
    expect(top.y).toBeGreaterThan(bottom.y);
    const s = (z: number) => WALL_DISTANCE / (WALL_DISTANCE - z);
    expect(s(top.z)).toBeLessThan(s(bottom.z));
  });

  it("wraps each row far from the frame, so a card never pops in or out where it can be seen", () => {
    for (const vp of [WIDE, TALL]) {
      for (const kind of ["wall", "rows"] as const) {
        const set = buildFormations(18, vp);
        const g = kind === "wall" ? set.story.wall : set.rows;
        const frame = g.frame;
        const pose = makePose();
        const spot: [number, number] = [0, 0];
        const halfDiagonal = Math.hypot(frame.w, frame.h) / 2;
        for (let slot = 0; slot < 18; slot++) {
          const row = g.slotRow[slot]!;
          const count = g.rowCount[row]!;
          const len = count * g.pitch;
          const u0 = (g.slotCol[slot]! - (count - 1) / 2) * g.pitch;
          for (const end of [-1, 1]) {
            // A slide that puts the card half a pixel before the wrap, at either end of the row.
            const slide = rowWay(row) * (end * (len / 2 - 0.5) - u0);
            wallSlotPose(g, slot, slide, pose);
            project(pose.x, pose.y, pose.z, WALL_DISTANCE, vp, spot);
            const dist = Math.hypot(spot[0] - vp.w / 2 - frame.cx, spot[1] - vp.h / 2 + frame.cy);
            expect(dist).toBeGreaterThan(halfDiagonal);
          }
        }
      }
    }
  });

  it("covers the frame with cards at every slide (the wall) and the screen (the rows)", () => {
    for (const vp of [WIDE, TALL]) {
      for (const kind of ["wall", "rows"] as const) {
        const set = buildFormations(18, vp);
        const g = kind === "wall" ? set.story.wall : set.rows;
        const frame = g.frame;
        const quad: Quad = [0, 0, 0, 0, 0, 0, 0, 0];
        const pose = makePose();
        let inside = 0;
        let total = 0;
        for (const phase of [0, 0.17, 0.41, 0.73]) {
          const quads: Quad[] = [];
          for (let slot = 0; slot < 18; slot++) {
            const row = g.slotRow[slot]!;
            const slide = phase * g.rowCount[row]! * g.pitch * rowWay(row);
            wallSlotPose(g, slot, slide, pose);
            const ok = cardQuad(
              pose.x,
              pose.y,
              pose.z,
              pose.q,
              pose.h * pose.aspect,
              pose.h,
              WALL_DISTANCE,
              vp,
              quad,
            );
            if (ok) quads.push([...quad] as Quad);
          }
          for (let ix = 1; ix < 12; ix++) {
            for (let iy = 1; iy < 12; iy++) {
              const px = vp.w / 2 + frame.cx - frame.w / 2 + (frame.w * ix) / 12;
              const py = vp.h / 2 - frame.cy - frame.h / 2 + (frame.h * iy) / 12;
              total += 1;
              if (quads.some((q) => pointInQuad(q, px, py))) inside += 1;
            }
          }
        }
        // The gaps take a fifth of a full plane, and the slanted rows leave the frame's far corners thin.
        expect(inside / total).toBeGreaterThan(0.64);
      }
    }
  });
});

describe("blending", () => {
  it("staggers by rank and finishes every card at t = 1", () => {
    expect(staggered(0, 0, 0.5)).toBe(0);
    expect(staggered(1, 1, 0.5)).toBe(1);
    expect(staggered(0.25, 1, 0.5)).toBe(0);
    expect(staggered(0.25, 0, 0.5)).toBeCloseTo(0.5, 9);
    expect(staggered(0.4, 0.3, 0)).toBe(0.4);
  });

  it("blends the wall into the rows without a jump at either end", () => {
    const set = buildFormations(N, WIDE);
    const out = makePose();
    const a = makePose();
    const b = makePose();
    for (let i = 0; i < N; i += 3) {
      blendFormations(set, { name: "wall" }, { name: "rows" }, 0, 0.3, i / (N - 1), i, 5, out);
      poseOf(set, "wall", 0, i, 5, a);
      expect(out.x).toBeCloseTo(a.x, 6);
      blendFormations(set, { name: "wall" }, { name: "rows" }, 1, 0.3, i / (N - 1), i, 5, out);
      poseOf(set, "rows", 0, i, 5, b);
      expect(out.x).toBeCloseTo(b.x, 6);
      expect(out.h).toBeCloseTo(b.h, 6);
    }
  });
});

describe("the ring's cards face outward", () => {
  it("the front card faces the viewer and the side cards are edge on", () => {
    const L = buildFormations(N, WIDE).story;
    const q = makePose().q;
    const n: V3 = [0, 0, 0];
    ringQuat(L.ring, 0, q);
    qRotate(q, 0, 0, 1, n);
    expect(n[2]).toBeGreaterThan(0.9);
    ringQuat(L.ring, Math.PI / 2, q);
    qRotate(q, 0, 0, 1, n);
    expect(Math.abs(n[2])).toBeLessThan(0.05);
  });
});

describe("the named windows of the story", () => {
  it("joins scatter, gather, ring, land and wall end to end", () => {
    const set = buildFormations(N, WIDE);
    const a = makePose();
    const b = makePose();
    const same = (
      n1: Parameters<typeof poseOf>[1],
      t1: number,
      n2: Parameters<typeof poseOf>[1],
      t2: number,
    ) => {
      for (let i = 0; i < N; i++) {
        poseOf(set, n1, t1, i, 9, a);
        poseOf(set, n2, t2, i, 9, b);
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-6);
        expect(a.h).toBeCloseTo(b.h, 6);
      }
    };
    same("gather", 0, "scatter", 0);
    same("gather", 1, "ring", 0);
    same("land", 0, "ring", 0);
    same("land", 1, "wall", 0);
    expect(storyProgress("gather", 0)).toBe(TIMELINE.freeze);
    expect(storyProgress("land", 1)).toBe(1);
  });

  it("sends the upper cards first and gathers the mass in the lower half", () => {
    const set = buildFormations(N, WIDE);
    const pose = makePose();
    const ring = makePose();
    const screenY = (p: typeof pose) => p.y * (BASE_DISTANCE / (BASE_DISTANCE - p.z));
    // Early in the gather the cards that have moved are the ones that were highest.
    const moved: number[] = [];
    const rest: number[] = [];
    for (let i = 0; i < N; i++) {
      const start = set.story.scatter[i]!;
      poseOf(set, "gather", 0.3, i, 0, pose);
      const d = Math.hypot(pose.x - start.x, pose.y - start.y, pose.z - start.z);
      (d > 1 ? moved : rest).push(screenY(start));
    }
    expect(moved.length).toBeGreaterThan(2);
    expect(rest.length).toBeGreaterThan(2);
    expect(Math.min(...moved)).toBeGreaterThan(Math.max(...rest) - 1);
    // At the end the ring's cards sit around a centre below the middle of the screen.
    let sum = 0;
    for (let i = 0; i < N; i++) {
      poseOf(set, "gather", 1, i, 0, ring);
      sum += screenY(ring);
    }
    expect(sum / N).toBeLessThan(-20);
  });
});

describe("rows against the wall at any slide", () => {
  for (const slide of [0, 40, 30000, 123456]) {
    it(`blends wall into rows without crossing the screen (slide ${slide})`, () => {
      const set = buildFormations(18, WIDE);
      const a = makePose();
      const b = makePose();
      for (let i = 0; i < 18; i++) {
        poseOf(set, "wall", 0, i, slide, a);
        poseOf(set, "rows", 0, i, slide, b);
        // The same card at the same phase of its row: only the plane's scale and place differ.
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(900);
      }
    });
  }

  it("slides the rows by the same row phase as the wall", () => {
    const set = buildFormations(18, WIDE);
    const w0 = makePose();
    const w1 = makePose();
    const r0 = makePose();
    const r1 = makePose();
    const rowLen = set.story.wall.rowCount[0]! * set.story.wall.pitch;
    for (const slide of [0.13 * rowLen, 0.29 * rowLen]) {
      poseOf(set, "wall", 0, 0, 0, w0);
      poseOf(set, "wall", 0, 0, slide, w1);
      poseOf(set, "rows", 0, 0, 0, r0);
      poseOf(set, "rows", 0, 0, slide, r1);
      const dw = Math.hypot(w1.x - w0.x, w1.y - w0.y);
      const dr = Math.hypot(r1.x - r0.x, r1.y - r0.y);
      // The two planes move by their own row length times the same phase.
      expect(dr / dw).toBeCloseTo(set.rowsPerWall, 1);
    }
  });
});

describe("the lens of a blend and the order of a stagger", () => {
  it("mixes the two lenses by the blend's progress", () => {
    expect(blendLens(1000, 2000, 0)).toBe(1000);
    expect(blendLens(1000, 2000, 1)).toBe(2000);
    expect(blendLens(1000, 2000, 0.5)).toBeCloseTo(1500, 9);
  });

  it("ranks the highest card first for top and the card order for index", () => {
    const set = buildFormations(N, WIDE);
    const ranks = rankCards(set, { name: "scatter" }, "top", 0, new Float64Array(N));
    let top = 0;
    let topY = -Infinity;
    for (let i = 0; i < N; i++) {
      const s = set.story.scatter[i]!;
      const y = s.y * (BASE_DISTANCE / (BASE_DISTANCE - s.z));
      if (y > topY) {
        topY = y;
        top = i;
      }
    }
    expect(ranks[top]).toBe(0);
    expect(Math.max(...Array.from(ranks))).toBe(1);
    const byIndex = rankCards(set, { name: "scatter" }, "index", 0, new Float64Array(N));
    expect(byIndex[0]).toBe(0);
    expect(byIndex[N - 1]).toBe(1);
  });
});
