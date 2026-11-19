import { describe, expect, it } from "vitest";

import { layoutSections } from "./layout";
import type { HomePlay } from "./plays";
import {
  FLICK_ENGAGE,
  FLICK_MAX_LEAD,
  FLICK_STEP,
  FLICK_WINDOW_MS,
  FlickLimiter,
  JointSnap,
  SNAP_GRACE_MS,
  SNAP_IDLE_MS,
  SNAP_SECONDS,
  THRESHOLD_MARGIN,
  ZONE_INSET,
  jointZones,
  playThresholds,
  restFor,
  zoneIndexAt,
  type FlickFrame,
  type SnapFrame,
} from "./snap";
import type { HomeSection } from "./types";

const play = (at: number, from: number, to: number): HomePlay => ({
  at,
  from,
  to,
  seconds: 1,
  ease: "linear",
});

interface Def {
  id: string;
  screens: number;
  lead?: number;
  tail?: number;
  bg?: string;
  plays?: HomePlay[] | null;
  restOutside?: boolean;
  dom?: "fixed" | "flow";
}

function sec(d: Def): HomeSection {
  return {
    id: d.id,
    screens: d.screens,
    lead: d.lead ?? 0,
    tail: d.tail ?? 0,
    bg: d.bg ?? "daybreak",
    nav: { theme: "daybreak" },
    dom: d.dom ?? "fixed",
    plays: d.plays === null ? undefined : (d.plays ?? [play(0.5, 0, 1)]),
    restOutside: d.restOutside,
    preload: () => [],
    mount: () => ({ update: () => undefined, dispose: () => undefined }),
  } as unknown as HomeSection;
}

/**
 * a: 0 to 3 (play at 1.5). b: 3 to 6, lead 0.6 (2.4 to 3), a's tail 0.4 (3 to 3.4), plays at 3.9 and 5.
 * c: 6 to 8, lead 0.5, no tail on b.
 */
function page(extra: Def[] = []) {
  return layoutSections([
    sec({ id: "a", screens: 3, tail: 0.4, plays: [play(0.5, 0, 1)] }),
    sec({
      id: "b",
      screens: 3,
      lead: 0.6,
      plays: [play(0.3, 0, 1), play(0.6667, 1, 2)],
    }),
    sec({ id: "c", screens: 2, lead: 0.5, plays: [play(0.5, 0, 1)] }),
    ...extra.map(sec),
  ]);
}

describe("jointZones", () => {
  it("has a joint where a tail and the next lead are on screen together", () => {
    const zones = jointZones(page());
    // a's tail (3 to 3.4) and b's lead (2.4 to 3) are one joint; c's lead (5.5 to 6) another
    expect(zones).toHaveLength(2);
    expect(zones[0]!.from).toBeCloseTo(2.4);
    expect(zones[0]!.to).toBeCloseTo(3.4);
    expect(zones[1]!.from).toBeCloseTo(5.5);
    expect(zones[1]!.to).toBeCloseTo(6);
  });

  it("has none for a section that rests in its lead and tail", () => {
    const layout = layoutSections([
      sec({ id: "a", screens: 3, tail: 0.4, restOutside: true }),
      sec({ id: "b", screens: 3, lead: 0.6, restOutside: true }),
    ]);
    expect(jointZones(layout)).toEqual([]);
  });

  it("drops a joint that touches a section with no plays (it follows the scroll everywhere)", () => {
    const layout = layoutSections([
      sec({ id: "a", screens: 3, tail: 0.4 }),
      sec({ id: "b", screens: 2, lead: 0.5, plays: null, dom: "flow" }),
    ]);
    expect(jointZones(layout)).toEqual([]);
  });

  it("adds the ground cross-fade of a pair whose grounds follow the scroll", () => {
    const layout = layoutSections([
      sec({ id: "a", screens: 3, bg: "daybreak" }),
      sec({ id: "b", screens: 3, bg: "#e8ecf4" }),
    ]);
    const zones = jointZones(layout);
    expect(zones).toHaveLength(1);
    expect(zones[0]!.from).toBeCloseTo(2.75);
    expect(zones[0]!.to).toBeCloseTo(3.25);
  });

  it("leaves the ground of a pair out when one section rests outside its range", () => {
    const layout = layoutSections([
      sec({ id: "a", screens: 3, bg: "daybreak", restOutside: true }),
      sec({ id: "b", screens: 3, bg: "#e8ecf4" }),
    ]);
    expect(jointZones(layout)).toEqual([]);
  });

  it("returns joints in order that never overlap", () => {
    const zones = jointZones(page());
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i]!.from).toBeGreaterThan(zones[i - 1]!.to);
    }
  });
});

describe("playThresholds", () => {
  it("lists every threshold in screens from the top, ascending", () => {
    const t = playThresholds(page());
    expect(t).toHaveLength(4);
    expect(t[0]).toBeCloseTo(1.5);
    expect(t[1]).toBeCloseTo(3.9);
    expect(t[2]).toBeCloseTo(5);
    expect(t[3]).toBeCloseTo(7);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });
});

describe("zoneIndexAt", () => {
  const zones = jointZones(page());
  it("is the joint the position is inside, and -1 in a dwell", () => {
    expect(zoneIndexAt(zones, 3)).toBe(0);
    expect(zoneIndexAt(zones, 5.75)).toBe(1);
    expect(zoneIndexAt(zones, 4.5)).toBe(-1);
    expect(zoneIndexAt(zones, 0)).toBe(-1);
    expect(zoneIndexAt(zones, 9)).toBe(-1);
  });

  it("counts the edges as outside, so a landing a pixel off is a rest", () => {
    expect(zoneIndexAt(zones, 2.4)).toBe(-1);
    expect(zoneIndexAt(zones, 2.4 + ZONE_INSET - 0.001)).toBe(-1);
    expect(zoneIndexAt(zones, 3.4)).toBe(-1);
    expect(zoneIndexAt(zones, 3.4 - ZONE_INSET + 0.001)).toBe(-1);
    expect(zoneIndexAt(zones, 2.4 + ZONE_INSET + 0.01)).toBe(0);
  });
});

describe("restFor", () => {
  const layout = page();
  const zones = jointZones(layout);
  const thresholds = playThresholds(layout);

  it("runs to the nearer end of the joint", () => {
    // joint 2.4 to 3.4, thresholds 1.5 and 3.9: 2.6 is near the start, 3.2 near the end
    expect(restFor(zones[0]!, thresholds, 2.6)).toBeCloseTo(2.4);
    expect(restFor(zones[0]!, thresholds, 3.2)).toBeCloseTo(3.4);
  });

  it("goes the way the visitor was going when the two are as near", () => {
    expect(restFor(zones[0]!, thresholds, 2.9, true)).toBeCloseTo(3.4);
    expect(restFor(zones[0]!, thresholds, 2.9, false)).toBeCloseTo(2.4);
  });

  it("takes the rest in the way of travel when the last input was a key, even if the other is nearer", () => {
    // 2.5 is near the start of the joint 2.4 to 3.4: a wheel would go back, a key goes on
    expect(restFor(zones[0]!, thresholds, 2.5, true, false)).toBeCloseTo(2.4);
    expect(restFor(zones[0]!, thresholds, 2.5, true, true)).toBeCloseTo(3.4);
    expect(restFor(zones[0]!, thresholds, 3.3, false, true)).toBeCloseTo(2.4);
    // and falls back to the other side when the way of travel is shut
    expect(restFor({ from: 2.4, to: 4.2 }, thresholds, 3.0, true, true)).toBeCloseTo(2.4);
  });

  it("never rests where a play would fire: going on stops short of the next threshold", () => {
    const z = { from: 2.4, to: 4.2 };
    // the threshold at 3.9 is inside this joint, so going on cannot leave it: only the way back is open
    expect(restFor(z, thresholds, 3.0)).toBeCloseTo(2.4);
    // a joint that ends just past a threshold stops short of it
    const z2 = { from: 3.0, to: 3.9 };
    expect(restFor(z2, thresholds, 3.5)).toBeCloseTo(3.9 - THRESHOLD_MARGIN);
  });

  it("never rests before a threshold that has fired: going back stops above it", () => {
    // joint 2.4 to 3.4 with a threshold at 2.8 behind the visitor (3.1): the way back would un-fire it
    const withIn = [1.5, 2.8, 3.9];
    expect(restFor({ from: 2.4, to: 3.4 }, withIn, 3.1)).toBeCloseTo(3.4);
    // but a threshold at the very start of the joint is kept just above
    expect(restFor({ from: 2.4, to: 3.4 }, [2.4], 2.6)).toBeCloseTo(2.4 + THRESHOLD_MARGIN);
  });

  it("is NaN when neither side leaves the joint without a play", () => {
    const z = { from: 2.4, to: 4.2 };
    expect(restFor(z, [2.8, 3.9], 3.3)).toBeNaN();
  });

  it("always lands outside the interior of every joint, for any position", () => {
    for (const z of zones) {
      for (let s = z.from + ZONE_INSET + 0.001; s < z.to - ZONE_INSET; s += 0.013) {
        const target = restFor(z, thresholds, s);
        if (Number.isNaN(target)) continue;
        expect(zoneIndexAt(zones, target), `from ${s}`).toBe(-1);
        // and it does not cross a threshold on the way
        const lo = Math.min(s, target);
        const hi = Math.max(s, target);
        for (const t of thresholds) {
          expect(
            t > lo + 1e-9 && t <= hi + 1e-9 && t !== target,
            `${t} between ${s} and ${target}`,
          ).toBe(false);
        }
      }
    }
  });
});

function frame(over: Partial<SnapFrame> = {}): SnapFrame {
  return {
    now: 10_000,
    real: 2.9,
    unit: 900,
    open: true,
    frozen: false,
    pushAt: 9000,
    keyAt: 0,
    touching: false,
    holds: 0,
    playing: false,
    chasing: false,
    scripted: false,
    ...over,
  };
}

describe("JointSnap", () => {
  function rig() {
    const moves: Array<[number, number]> = [];
    let stops = 0;
    const snap = new JointSnap(
      {
        layout: page(),
        move: (s, sec) => moves.push([s, sec]),
        stop: () => stops++,
      },
      1000,
    );
    /** Hold a position still from `from` to `to` ms, one frame every 16 ms. */
    const hold = (real: number, from: number, to: number, over: Partial<SnapFrame> = {}) => {
      for (let t = from; t <= to; t += 16) snap.step(frame({ real, now: t, ...over }));
    };
    return { snap, moves, hold, stops: () => stops };
  }

  it("runs to the nearer rest in half a second once the page has been still for 180 ms", () => {
    const { snap, moves, hold } = rig();
    hold(2.6, 9000, 9000 + SNAP_IDLE_MS - 20);
    expect(moves).toHaveLength(0);
    hold(2.6, 9000 + SNAP_IDLE_MS - 20, 9000 + SNAP_IDLE_MS + 60);
    expect(moves).toHaveLength(1);
    expect(moves[0]![0]).toBeCloseTo(2.4);
    expect(moves[0]![1]).toBe(SNAP_SECONDS);
    expect(snap.moving).toBe(true);
  });

  it("makes one move, not one a frame", () => {
    const { moves, hold } = rig();
    hold(2.6, 9000, 10_000);
    expect(moves).toHaveLength(1);
  });

  it("never snaps inside a dwell", () => {
    const { moves, hold, snap } = rig();
    hold(4.5, 9000, 11_000);
    expect(moves).toHaveLength(0);
    expect(snap.report().blocked).toBe("outside");
  });

  it("waits while the scroll still moves, and for the idle time after it stopped", () => {
    const { moves, snap } = rig();
    let real = 2.6;
    for (let t = 9000; t < 9400; t += 16) {
      real += 0.004;
      snap.step(frame({ real, now: t }));
    }
    expect(moves).toHaveLength(0);
    expect(snap.report().blocked).toBe("input");
    for (let t = 9400; t < 9400 + SNAP_IDLE_MS + 40; t += 16) snap.step(frame({ real, now: t }));
    expect(moves).toHaveLength(1);
  });

  it("goes the way the visitor was going when the two rests are as near", () => {
    const { moves, snap } = rig();
    // 2.8 to 3.0 going down, then a stop at 3.0: the joint is 2.4 to 3.4, so 3.0 is 0.6 and 0.4
    let real = 2.8;
    for (let t = 9000; t < 9200; t += 16) {
      real += 0.01;
      snap.step(frame({ real, now: t }));
    }
    for (let t = 9200; t < 9600; t += 16) snap.step(frame({ real, now: t }));
    expect(moves).toHaveLength(1);
    expect(moves[0]![0]).toBeCloseTo(3.4);
  });

  const blockers: Array<[string, Partial<SnapFrame>, string]> = [
    ["a play runs", { playing: true }, "play"],
    ["a scroll hold is on (a preview, a viewer, the music)", { holds: 1 }, "hold"],
    ["the scene is catching up with a flick", { chasing: true }, "chase"],
    ["a finger is on the screen", { touching: true }, "touch"],
    ["a script moves the page", { scripted: true }, "script"],
    ["the scene is frozen by a probe", { frozen: true }, "frozen"],
    ["the opening is not over", { open: false }, "closed"],
    ["the wheel was used within the idle time", { pushAt: 9990 }, "input"],
    ["a key was pressed within the idle time", { keyAt: 9990 }, "input"],
  ];
  for (const [name, over, why] of blockers) {
    it(`does not snap while ${name}`, () => {
      const { snap, moves, hold } = rig();
      hold(2.6, 9000, 10_000, over);
      expect(moves).toHaveLength(0);
      expect(snap.report().blocked).toBe(why);
    });
  }

  it("after a key it goes on the way the page was going, not back to where it started", () => {
    const { moves, snap } = rig();
    let real = 2.5;
    for (let t = 9000; t < 9060; t += 16) {
      real += 0.02;
      snap.step(frame({ real, now: t, pushAt: 0, keyAt: t }));
    }
    for (let t = 9060; t < 9500; t += 16)
      snap.step(frame({ real, now: t, pushAt: 0, keyAt: 9050 }));
    expect(moves).toHaveLength(1);
    expect(moves[0]![0]).toBeCloseTo(3.4);
  });

  it("does not snap before the visitor has pushed the page since the load or a seek", () => {
    const { snap, moves, hold } = rig();
    hold(2.6, 5000, 8000, { pushAt: 0 });
    expect(moves).toHaveLength(0);
    expect(snap.report().armed).toBe(false);
    expect(snap.report().blocked).toBe("unarmed");
    // a push that came before the seek does not count
    snap.noteJump(9500);
    hold(2.6, 9600, 12_000, { pushAt: 9000 });
    expect(moves).toHaveLength(0);
    // a push after it does, once the grace has passed
    hold(2.6, 12_000, 12_000 + SNAP_GRACE_MS + 400, { pushAt: 12_000 - 300 });
    expect(moves).toHaveLength(1);
  });

  it("waits out the grace after a seek, a jump or the load", () => {
    const { snap, moves, hold } = rig();
    snap.noteJump(9000);
    hold(2.6, 9100, 9000 + SNAP_GRACE_MS - 20, { pushAt: 9050 });
    expect(moves).toHaveLength(0);
    expect(snap.report().blocked).toBe("grace");
    hold(2.6, 9000 + SNAP_GRACE_MS, 9000 + SNAP_GRACE_MS + 300, { pushAt: 9050 });
    expect(moves).toHaveLength(1);
  });

  it("is over when the visitor pushes again: cancel clears the move, a key also stops the smooth scroller", () => {
    const { snap, hold, stops } = rig();
    hold(2.6, 9000, 9600);
    expect(snap.moving).toBe(true);
    snap.cancel(false);
    expect(snap.moving).toBe(false);
    expect(stops()).toBe(0);
    hold(2.6, 9700, 10_400);
    expect(snap.moving).toBe(true);
    snap.cancel(true);
    expect(snap.moving).toBe(false);
    expect(stops()).toBe(1);
    // nothing to stop when no move is on its way
    snap.cancel(true);
    expect(stops()).toBe(1);
  });

  it("ends its move when the page arrives, and does not snap again from the rest", () => {
    const { snap, moves, hold } = rig();
    hold(2.6, 9000, 9600);
    expect(moves).toHaveLength(1);
    // the page lands on the target (a pixel off) and stays
    hold(2.4 + 0.001, 9700, 11_000);
    expect(snap.moving).toBe(false);
    expect(moves).toHaveLength(1);
  });

  it("ends a move that never arrives after its time, and makes a new one from where the page is", () => {
    const { snap, moves, hold } = rig();
    hold(2.6, 9000, 9600);
    expect(snap.moving).toBe(true);
    expect(moves).toHaveLength(1);
    hold(2.6, 9600, 9600 + SNAP_SECONDS * 1000 + 900);
    expect(moves.length).toBeGreaterThanOrEqual(2);
  });

  it("does not move for less than a hundredth of a screen", () => {
    const moves: number[] = [];
    // a play at the very start of the joint (2.4): the rest is kept just above it
    const layout = layoutSections([
      sec({ id: "a", screens: 3, tail: 0.4, plays: [play(0.8, 0, 1)] }),
      sec({ id: "b", screens: 3, lead: 0.6, plays: [play(0.3, 0, 1)] }),
    ]);
    const snap = new JointSnap({ layout, move: (s) => moves.push(s), stop: () => undefined }, 1000);
    for (let t = 9000; t <= 10_000; t += 16) snap.step(frame({ real: 2.4215, now: t }));
    expect(moves).toHaveLength(0);
    expect(snap.report().blocked).toBe("no-rest");
  });

  it("reports for the probe", () => {
    const { snap, hold } = rig();
    hold(2.6, 9000, 9100);
    const r = snap.report();
    expect(r.zones).toBe(2);
    expect(r.zone?.from).toBeCloseTo(2.4);
    expect(r.target).toBeCloseTo(2.4);
    expect(r.armed).toBe(true);
    expect(r.blocked).toBe("input");
  });
});

describe("FlickLimiter", () => {
  function rig() {
    const flick = new FlickLimiter();
    let now = 10_000;
    const base: FlickFrame = {
      real: 0,
      now,
      forced: false,
      holding: false,
      pushAt: 9_950,
      keyAt: 0,
    };
    const step = (real: number, over: Partial<FlickFrame> = {}) => {
      now += 16;
      return flick.step({ ...base, real, now, pushAt: now - 50, ...over });
    };
    return { flick, step };
  }

  it("follows the page exactly when the steps are small", () => {
    const { flick, step } = rig();
    expect(step(1)).toBe(1);
    expect(step(1.7)).toBe(1.7);
    expect(step(2.6)).toBe(2.6);
    expect(flick.engaged).toBe(false);
    expect(Number.isNaN(flick.pull)).toBe(true);
  });

  it("takes a step of more than a screen after a wheel one screen a frame", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(5.2)).toBeCloseTo(3 + FLICK_STEP);
    expect(flick.engaged).toBe(true);
    expect(step(5.2)).toBeCloseTo(3 + 2 * FLICK_STEP);
    expect(step(5.2)).toBeCloseTo(5.2);
    expect(flick.engaged).toBe(false);
  });

  it("is a jump (the scene takes the page) when no wheel or touch came lately", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(25, { pushAt: 0 })).toBe(25);
    expect(flick.engaged).toBe(false);
    step(25);
    expect(step(40, { pushAt: 1 })).toBe(40);
  });

  it("is a jump when the last wheel is older than the flick window", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(25, { pushAt: 10_016 - FLICK_WINDOW_MS - 1 })).toBe(25);
    expect(flick.engaged).toBe(false);
  });

  it("is a jump after a key (Home, End, Page Down), also right after a wheel", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(28, { keyAt: 20_000, pushAt: 9_000 })).toBe(28);
    expect(flick.engaged).toBe(false);
  });

  it("is a jump when the page is moved by a seek, a focus move or a script (forced)", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(20, { forced: true })).toBe(20);
    expect(flick.engaged).toBe(false);
  });

  it("pulls the page back so the chase is never longer than the lead", () => {
    const { flick, step } = rig();
    step(3);
    const seen = step(22);
    expect(flick.pull).toBeCloseTo(3 + FLICK_MAX_LEAD);
    expect(seen).toBeCloseTo(3 + FLICK_STEP);
    // the engine put the page there; the chase runs on to it and ends
    step(3 + FLICK_MAX_LEAD);
    expect(step(3 + FLICK_MAX_LEAD)).toBeCloseTo(3 + FLICK_MAX_LEAD);
    expect(flick.engaged).toBe(false);
  });

  it("stands still while a play holds the page, and goes on when it lets go", () => {
    const { flick, step } = rig();
    step(3);
    const first = step(6);
    for (let i = 0; i < 20; i++) expect(step(6, { holding: true })).toBe(first);
    expect(flick.engaged).toBe(true);
    expect(step(6)).toBeCloseTo(first + FLICK_STEP);
  });

  it("walks every threshold in order (each frame crosses at most one screen)", () => {
    const { step } = rig();
    step(0);
    let prev = 0;
    let max = 0;
    let s = step(9);
    for (let i = 0; i < 20; i++) {
      max = Math.max(max, s - prev);
      prev = s;
      s = step(9);
    }
    expect(max).toBeLessThanOrEqual(FLICK_STEP + 1e-9);
    expect(prev).toBeCloseTo(9);
  });

  it("goes the other way too", () => {
    const { step } = rig();
    step(10);
    expect(step(5)).toBeCloseTo(10 - FLICK_STEP);
  });

  it("ends the chase with a jump when a key is pressed in the middle", () => {
    const { flick, step } = rig();
    step(3);
    step(6);
    expect(flick.engaged).toBe(true);
    expect(step(28, { keyAt: 99_999 })).toBe(28);
    expect(flick.engaged).toBe(false);
  });

  it("gives up a chase that lasts too long", () => {
    const { flick, step } = rig();
    step(3);
    step(6);
    expect(step(6, { holding: true, now: 40_000, pushAt: 39_950 })).toBe(6);
    expect(flick.engaged).toBe(false);
  });

  it("does not engage for a step just under the threshold", () => {
    const { flick, step } = rig();
    step(3);
    expect(step(3 + FLICK_ENGAGE)).toBeCloseTo(3 + FLICK_ENGAGE);
    expect(flick.engaged).toBe(false);
  });
});
