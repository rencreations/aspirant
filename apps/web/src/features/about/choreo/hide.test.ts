import { describe, expect, it } from "vitest";

import { springTo, type Sprung } from "./ease";
import {
  clearOf,
  covered,
  createVisit,
  doorOf,
  dollSpan,
  dollWanted,
  insideSize,
  offScreen,
  stepVisit,
  type HideBox,
} from "./hide";

const VW = 1440;
const VH = 900;
const HIDES: HideBox[] = [
  { id: "pickup", x: 1080, y: 6000, w: 286, h: 400 },
  { id: "drop", x: 72, y: 8400, w: 525, h: 295 },
];
/** Where the drone's path keeps it on the screen when it is not on a visit. */
const STATION = { x: 620, y: 400, size: 140 };

describe("the doll's span", () => {
  it("runs from her window to her art, with marks that suit the way the page goes", () => {
    const span = dollSpan(HIDES, VH);
    expect(span).not.toBeNull();
    const [from, to] = span ?? [0, 0];
    expect(from).toBeLessThan(to);
    expect(dollWanted(from - 1, HIDES, VH, 1)).toBe(false);
    expect(dollWanted(to + 1, HIDES, VH, -1)).toBe(false);
    // Going down: her window takes her as soon as it is well up the screen, her art before it is.
    expect(dollWanted(from + 1, HIDES, VH, 1)).toBe(true);
    expect(dollWanted(to - 1, HIDES, VH, 1)).toBe(false);
    // Going up: her art gives her back once it has come down from the top, her window takes her.
    expect(dollWanted(to - 1, HIDES, VH, -1)).toBe(true);
    expect(dollWanted(from + 1, HIDES, VH, -1)).toBe(false);
    // In the middle she rides whichever way the page goes; at rest the last answer holds.
    const mid = (from + to) / 2;
    expect(dollWanted(mid, HIDES, VH, 1)).toBe(true);
    expect(dollWanted(mid, HIDES, VH, -1)).toBe(true);
    expect(dollWanted(from + 1, HIDES, VH, 0, true)).toBe(true);
  });

  it("is empty without both pictures", () => {
    expect(dollWanted(7000, [HIDES[0]!], VH)).toBe(false);
    expect(dollSpan([], VH)).toBeNull();
  });
});

describe("the boxes", () => {
  it("fits the drone behind a picture, and the door is clear of it", () => {
    for (const h of HIDES) {
      const size = insideSize(h, 160);
      const inside = { x: h.x + h.w / 2, y: h.y + h.h / 2, size };
      expect(covered(inside, h)).toBe(true);
      const door = doorOf(h, h.id, 160);
      expect(clearOf(door, h)).toBe(true);
      expect(door.size).toBe(size);
    }
  });

  it("knows when the drone is off the screen", () => {
    expect(offScreen({ x: -200, y: 300, size: 100 }, VW, VH)).toBe(true);
    expect(offScreen({ x: 20, y: 300, size: 100 }, VW, VH)).toBe(false);
  });
});

interface Run {
  swaps: number;
  carrying: boolean;
  under: boolean;
  breaches: string[];
  stages: Set<string>;
}

/**
 * Fly a drone through a scroll trace: it follows the visit's goal (or its station) on a spring, as
 * the director does, and every frame the two rules are checked on the drone as it is drawn.
 */
function fly(trace: readonly number[], dt: number, painted = true): Run {
  const visit = createVisit();
  const x: Sprung = { x: STATION.x, v: 0 };
  const y: Sprung = { x: STATION.y, v: 0 };
  const size: Sprung = { x: STATION.size, v: 0 };
  let carrying = false;
  let under = false;
  let swaps = 0;
  let dir = 1;
  let wanted = false;
  const breaches: string[] = [];
  const stages = new Set<string>();
  trace.forEach((scroll, k) => {
    const pose = { x: x.x, y: y.x, size: size.x };
    const step = scroll - (trace[k - 1] ?? scroll);
    if (step > 0.5) dir = 1;
    else if (step < -0.5) dir = -1;
    wanted = dollWanted(scroll, HIDES, VH, dir, wanted);
    const out = stepVisit(visit, {
      dt,
      scroll,
      vw: VW,
      vh: VH,
      wanted,
      carrying,
      pose,
      size: STATION.size,
      hides: HIDES,
      painted: () => painted,
      free: true,
    });
    stages.add(visit.stage);
    // On a visit the drone rides with the page, as the director has it.
    const moved = scroll - (trace[k - 1] ?? scroll);
    const behind = visit.stage === "dive" || visit.stage === "hold" || visit.stage === "rise";
    if (
      behind ||
      (visit.stage !== "idle" && visit.stage !== "edge" && Math.abs(moved) < 0.25 * VH)
    ) {
      y.x -= moved;
    }
    const goal = out.goal ?? STATION;
    springTo(x, goal.x, 7.2, dt);
    springTo(y, goal.y, 7.2, dt);
    springTo(size, goal.size, 6.4, dt);
    // The drone as it is drawn this frame, after its step.
    const drawn = { x: x.x, y: y.x, size: size.x };
    const box = HIDES.find((h) => h.id === (visit.box ?? ""));
    const onBox = box ? { ...box, y: box.y - scroll } : null;
    if (out.swap) {
      swaps += 1;
      carrying = !carrying;
      const hidden =
        offScreen(pose, VW, VH) ||
        offScreen(drawn, VW, VH) ||
        (out.under && onBox !== null && covered(drawn, onBox));
      if (!hidden) breaches.push(`${k}: the doll changed in sight`);
    }
    if (out.under !== under) {
      const anyBox = HIDES.map((h) => ({ ...h, y: h.y - scroll }));
      const clear = anyBox.every((b) => clearOf(drawn, b) || offScreen(drawn, VW, VH));
      if (!clear)
        breaches.push(
          `${k}: the layer changed over a picture (${out.under}, ${visit.stage}, ${JSON.stringify(pose)} -> ${JSON.stringify(drawn)})`,
        );
      under = out.under;
    }
  });
  return { swaps, carrying, under, breaches, stages };
}

/** Scroll from `a` to `b` at `step` pixels a frame, then hold for `hold` frames. */
function ramp(a: number, b: number, step: number, hold = 240): number[] {
  const out: number[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / step));
  for (let i = 0; i <= n; i += 1) out.push(a + ((b - a) * i) / n);
  for (let i = 0; i < hold; i += 1) out.push(b);
  return out;
}

describe("the visit", () => {
  const span = dollSpan(HIDES, VH) ?? [0, 0];

  for (const dt of [1 / 60, 0.05]) {
    it(`fetches her from behind her window in a slow scroll (dt ${dt.toFixed(3)})`, () => {
      const run = fly(ramp(span[0] - 400, span[0] + 60, 3, Math.round(6 / dt / 60) * 60), dt);
      expect(run.breaches).toEqual([]);
      expect(run.carrying).toBe(true);
      expect(run.under).toBe(false);
      expect(run.stages.has("hold")).toBe(true);
    });

    it(`takes her home behind her art, and back out again on the way up (dt ${dt.toFixed(3)})`, () => {
      const down = ramp(span[0] + 60, span[1] + 40, 6, Math.round(5 / dt));
      const up = ramp(span[1] + 40, span[1] - 120, 4, Math.round(5 / dt));
      const back = ramp(span[1] - 120, span[0] - 200, 8, Math.round(6 / dt));
      const run = fly(
        [...ramp(span[0] - 300, span[0] + 60, 3, Math.round(5 / dt)), ...down, ...up, ...back],
        dt,
      );
      expect(run.breaches).toEqual([]);
      expect(run.carrying).toBe(false);
      expect(run.under).toBe(false);
      expect(run.swaps).toBe(4);
    });

    it(`gives her back behind her window in a slow scroll back up (dt ${dt.toFixed(3)})`, () => {
      // Down past both pictures slowly, then back up slowly the whole way.
      const run = fly(
        [
          ...ramp(span[0] - 400, span[0] + 200, 3, Math.round(5 / dt)),
          ...ramp(span[0] + 200, span[1] + 600, 6, Math.round(5 / dt)),
          ...ramp(span[1] + 600, span[0] - 900, 4, Math.round(6 / dt)),
        ],
        dt,
      );
      expect(run.breaches).toEqual([]);
      expect(run.carrying).toBe(false);
      expect(run.swaps).toBe(4);
      expect(run.stages.has("edge")).toBe(false);
    });

    it(`holds both rules in flicks, reversals and jumps (dt ${dt.toFixed(3)})`, () => {
      const trace = [
        ...ramp(span[0] - 900, span[1] + 900, 140, 20),
        ...ramp(span[1] + 900, span[0] + 100, 160, 8),
        ...ramp(span[0] + 100, span[0] - 50, 40, 6),
        ...ramp(span[0] - 50, span[0] + 30, 12, 30),
        span[1] + 2000,
        span[1] + 2000,
        span[0] + 300,
        ...ramp(span[0] + 300, span[0] + 300, 1, Math.round(6 / dt)),
        ...ramp(span[0] + 300, span[0] - 1500, 220, Math.round(6 / dt)),
      ];
      const run = fly(trace, dt);
      expect(run.breaches).toEqual([]);
      // At rest at the end, the doll is where the scroll says and the layer is up.
      expect(run.carrying).toBe(false);
      expect(run.under).toBe(false);
    });
  }

  it("goes out past the edge when the picture is not painted", () => {
    const run = fly(ramp(span[0] - 400, span[0] + 60, 6, 400), 1 / 60, false);
    expect(run.breaches).toEqual([]);
    expect(run.carrying).toBe(true);
    expect(run.stages.has("edge")).toBe(true);
    expect(run.stages.has("hold")).toBe(false);
  });

  it("waits at the door while the canvas is not free, then goes out past the edge", () => {
    const visit = createVisit();
    const box = HIDES[0]!;
    const scroll = span[0] + 60;
    const door = doorOf({ ...box, y: box.y - scroll }, box.id, STATION.size);
    let out = stepVisit(visit, {
      dt: 1 / 60,
      scroll,
      vw: VW,
      vh: VH,
      wanted: true,
      carrying: false,
      pose: door,
      size: STATION.size,
      hides: HIDES,
      painted: () => true,
      free: false,
    });
    expect(out.under).toBe(false);
    for (let i = 0; i < 240 && visit.stage === "approach"; i += 1) {
      out = stepVisit(visit, {
        dt: 1 / 60,
        scroll,
        vw: VW,
        vh: VH,
        wanted: true,
        carrying: false,
        pose: door,
        size: STATION.size,
        hides: HIDES,
        painted: () => true,
        free: false,
      });
      expect(out.under).toBe(false);
    }
    expect(visit.stage).toBe("edge");
  });
});
