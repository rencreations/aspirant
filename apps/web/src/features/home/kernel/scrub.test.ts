import { describe, expect, it } from "vitest";

import { playsOf, zoneLength } from "./beat";
import { PlayMachine, validatePlays, zoneProgress, zoneValue, type HomePlay } from "./plays";
import type { SnapFrame } from "./snap";
import {
  ZONE_EDGE,
  ZONE_GRACE_MS,
  ZONE_IDLE_MS,
  ZONE_MIN_SECONDS,
  ZoneSnap,
  zoneHeading,
  zoneIndexAt,
  zonePlan,
  zoneRanges,
  type ZoneRange,
} from "./scrub";
import type { Layout } from "./layout";
import type { HomeSection } from "./types";

const ZONE: HomePlay[] = [
  { at: 0.2, span: 0.4, from: 0, to: 1, seconds: 2 },
  { at: 0.7, from: 1, to: 2, seconds: 1 },
];

describe("zone arithmetic", () => {
  const z = ZONE[0]!;

  it("is from before the zone, to after it, linear between", () => {
    expect(zoneValue(z, 0)).toBe(0);
    expect(zoneValue(z, 0.2)).toBe(0);
    expect(zoneValue(z, 0.4)).toBeCloseTo(0.5, 9);
    expect(zoneValue(z, 0.6)).toBeCloseTo(1, 9);
    expect(zoneValue(z, 5)).toBe(1);
    expect(zoneProgress(z, 0.3)).toBeCloseTo(0.25, 9);
  });

  it("uses the curve it is given", () => {
    const eased: HomePlay = { ...z, ease: "inOut" };
    expect(zoneValue(eased, 0.3)).toBeCloseTo(4 * 0.25 ** 3, 9);
    expect(zoneValue(eased, 0.4)).toBeCloseTo(0.5, 9);
  });

  it("is symmetrical: the same scroll gives the same value going either way", () => {
    const m = new PlayMachine("t", [z], { screens: 4 });
    const at = (s: number) => {
      m.step(s, s, 1 / 60, 1000);
      return m.value;
    };
    m.jump(0, 0);
    const down = [0.25, 0.3, 0.35, 0.4, 0.5, 0.58].map(at);
    const up = [0.58, 0.5, 0.4, 0.35, 0.3, 0.25].map(at).reverse();
    down.forEach((v, i) => {
      expect(v).toBeCloseTo(up[i]!, 9);
    });
  });
});

describe("validatePlays with zones", () => {
  const bad = (plays: HomePlay[]) => () => validatePlays("rows", plays);

  it("accepts zones and clock plays in one contiguous, ordered table", () => {
    expect(bad(ZONE)).not.toThrow();
    expect(
      bad([
        { at: 0.1, from: 0, to: 0.5, seconds: 2 },
        { at: 0.3, span: 0.3, from: 0.5, to: 1, seconds: 1 },
      ]),
    ).not.toThrow();
  });

  it("refuses a bad span, a zone past the section's end and overlapping positions", () => {
    expect(bad([{ at: 0.1, span: 0, from: 0, to: 1, seconds: 1 }])).toThrow(/plays\[0\] span 0/);
    expect(bad([{ at: 0.1, span: -1, from: 0, to: 1, seconds: 1 }])).toThrow(/plays\[0\] span -1/);
    expect(bad([{ at: 0.8, span: 0.4, from: 0, to: 1, seconds: 1 }])).toThrow(/a zone ends at 1.2/);
    expect(
      bad([
        { at: 0.1, span: 0.5, from: 0, to: 0.5, seconds: 1 },
        { at: 0.4, from: 0.5, to: 1, seconds: 1 },
      ]),
    ).toThrow(/plays\[1\] at 0.4 is inside the previous zone/);
  });

  it("still refuses a zone that is not contiguous in value", () => {
    expect(
      bad([
        { at: 0.1, span: 0.2, from: 0, to: 0.5, seconds: 1 },
        { at: 0.5, span: 0.2, from: 0.6, to: 1, seconds: 1 },
      ]),
    ).toThrow(/contiguous/);
  });
});

describe("PlayMachine with zones", () => {
  const rig = (plays: readonly HomePlay[], screens = 4) => {
    const m = new PlayMachine("t", plays, { screens });
    let now = 1000;
    return {
      m,
      /** One frame at the scroll `s` (both scrolls). */
      frame(s: number, dt = 1 / 60, sRaw = s) {
        now += dt * 1000;
        m.step(sRaw, s, dt, now);
      },
      run(seconds: number, s: number) {
        for (let i = 0; i < Math.round(seconds * 60); i++) this.frame(s);
      },
    };
  };

  it("follows the scroll through a zone and never holds", () => {
    const r = rig(ZONE);
    r.m.jump(0, 0);
    r.frame(0.1);
    expect(r.m.value).toBe(0);
    r.frame(0.4);
    expect(r.m.value).toBeCloseTo(0.5, 9);
    expect(r.m.active).toBe(false);
    r.frame(0.65);
    expect(r.m.value).toBe(1);
    expect(r.m.active).toBe(false);
    expect(r.m.zoneIndex).toBe(0);
  });

  it("a clock play after the zone still fires, from the zone's end", () => {
    const r = rig(ZONE);
    r.m.jump(0, 0);
    r.frame(0.65);
    r.frame(0.7);
    expect(r.m.active).toBe(true);
    expect(r.m.direction).toBe(1);
    r.run(0.5, 0.7);
    expect(r.m.value).toBeGreaterThan(1);
    expect(r.m.value).toBeLessThan(2);
    r.run(1, 0.7);
    expect(r.m.value).toBe(2);
    expect(r.m.active).toBe(false);
  });

  it("holds the clock play back until the smoothed scroll has finished the zone before it", () => {
    const r = rig([
      { at: 0.2, span: 0.2, from: 0, to: 1, seconds: 2 },
      { at: 0.4, from: 1, to: 2, seconds: 1 },
    ]);
    r.m.jump(0, 0);
    // The real scroll is past the threshold, the scene still in the zone's last tenth.
    r.frame(0.38, 1 / 60, 0.45);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBeLessThan(1);
    r.frame(0.4, 1 / 60, 0.45);
    expect(r.m.active).toBe(true);
  });

  it("scrolling back up out of a zone goes through the same values, then plays the clock play before it back", () => {
    const r = rig([
      { at: 0.1, from: 0, to: 1, seconds: 1 },
      { at: 0.4, span: 0.2, from: 1, to: 2, seconds: 1 },
    ]);
    r.m.jump(0.7, 0.7);
    expect(r.m.value).toBe(2);
    r.frame(0.5);
    expect(r.m.value).toBeCloseTo(1.5, 9);
    r.frame(0.39);
    expect(r.m.value).toBe(1);
    expect(r.m.active).toBe(false);
    r.frame(0.02);
    expect(r.m.active).toBe(true);
    expect(r.m.direction).toBe(-1);
  });

  it("a jump gives the value of the zone for the position", () => {
    const r = rig(ZONE);
    r.m.jump(0.4, 0.4);
    expect(r.m.value).toBeCloseTo(0.5, 9);
    r.m.jump(0.9, 0.9);
    expect(r.m.value).toBe(2);
    expect(r.m.end).toBe(2);
  });

  it("adds the scroll's passthrough in the lead and the tail, as plays do", () => {
    const r = rig([{ at: 0.2, span: 0.4, from: 0, to: 1, seconds: 1 }]);
    r.m.jump(-0.1, -0.1);
    expect(r.m.value).toBeCloseTo(-0.1, 9);
    r.m.jump(1.1, 1.1);
    expect(r.m.value).toBeCloseTo(1.1, 9);
  });
});

describe("beat steps with a span", () => {
  const steps = [
    { atScreens: 0.5, spanScreens: 1, to: 1, seconds: 1.2 },
    { atScreens: 2, to: 2, seconds: 1.4 },
    { atScreens: 2.6, spanScreens: 0.8, to: 3, seconds: 1, ease: "inOut" },
  ] as const;

  it("writes zones in shares of the section, linear by default", () => {
    const plays = playsOf(0, 3, 4, steps);
    expect(() => {
      validatePlays("t", plays);
    }).not.toThrow();
    expect(plays[0]!.span).toBeCloseTo(0.25, 9);
    expect(plays[0]!.ease).toBe("linear");
    expect(plays[1]!.span).toBeUndefined();
    expect(plays[1]!.ease).toBe("inOut");
    expect(plays[2]!.at).toBeCloseTo(0.65, 9);
    expect(plays[2]!.ease).toBe("inOut");
  });

  it("gives the length of the section from its steps", () => {
    expect(zoneLength(steps)).toBeCloseTo(3.4, 9);
    expect(zoneLength(steps, 0.6)).toBeCloseTo(4, 9);
    expect(zoneLength([])).toBe(0);
  });
});

const section = (id: string, screens: number, plays?: HomePlay[]): HomeSection =>
  ({
    id,
    screens,
    lead: 0,
    tail: 0,
    bg: "daybreak",
    nav: { theme: "daybreak" },
    dom: "fixed",
    ...(plays ? { plays } : {}),
  }) as unknown as HomeSection;

const layoutOf = (defs: HomeSection[]): Layout => {
  let at = 0;
  return {
    placed: defs.map((def, index) => {
      const start = at;
      at += def.screens;
      return { def, id: def.id, index, start, end: at, from: start, to: at };
    }),
    total: at,
  };
};

describe("zoneRanges", () => {
  it("places every zone of the registry in screens from the top", () => {
    const layout = layoutOf([
      section("hero", 2),
      section("rows", 4, [
        { at: 0.25, span: 0.5, from: 0, to: 1, seconds: 2 },
        { at: 0.8, from: 1, to: 2, seconds: 1 },
      ]),
    ]);
    const zones = zoneRanges(layout);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ id: "rows", index: 0, from: 3, to: 5, seconds: 2 });
  });
});

describe("the snap decision", () => {
  const z: ZoneRange = { id: "rows", index: 0, from: 10, to: 14, seconds: 2, snap: true };
  const at = (p: number) => z.from + p * (z.to - z.from);

  it("going down finishes forward from a quarter, else goes back", () => {
    expect(zoneHeading(0.25, true)).toBe("forward");
    expect(zoneHeading(0.5, true)).toBe("forward");
    expect(zoneHeading(0.24, true)).toBe("back");
    expect(zoneHeading(0.05, true)).toBe("back");
  });

  it("going up goes back up to three quarters, else finishes forward", () => {
    expect(zoneHeading(0.75, false)).toBe("back");
    expect(zoneHeading(0.3, false)).toBe("back");
    expect(zoneHeading(0.76, false)).toBe("forward");
    expect(zoneHeading(0.95, false)).toBe("forward");
  });

  it("a key always finishes the way it went", () => {
    expect(zoneHeading(0.05, true, true)).toBe("forward");
    expect(zoneHeading(0.95, false, true)).toBe("back");
  });

  it("targets the ends and takes the zone's seconds times the distance left, at least 0.35 s", () => {
    const fwd = zonePlan(z, at(0.5), true);
    expect(fwd).toMatchObject({ heading: "forward", target: 14 });
    expect(fwd.seconds).toBeCloseTo(1, 9);
    const back = zonePlan(z, at(0.1), true);
    expect(back).toMatchObject({ heading: "back", target: 10 });
    expect(back.seconds).toBeCloseTo(0.35, 9);
    const nearly = zonePlan(z, at(0.9), true);
    expect(nearly.seconds).toBe(ZONE_MIN_SECONDS);
    expect(zonePlan(z, at(0.1), false).seconds).toBeCloseTo(0.35, 9);
  });

  it("finds the zone a position is inside, with the ends counted as outside", () => {
    const zones = [z];
    expect(zoneIndexAt(zones, 9)).toBe(-1);
    expect(zoneIndexAt(zones, 10)).toBe(-1);
    expect(zoneIndexAt(zones, 12)).toBe(0);
    expect(zoneIndexAt(zones, 14)).toBe(-1);
    expect(zoneIndexAt(zones, at(0.01), ZONE_EDGE)).toBe(-1);
    expect(zoneIndexAt(zones, at(0.03), ZONE_EDGE)).toBe(0);
    expect(zoneIndexAt(zones, at(0.99), ZONE_EDGE)).toBe(-1);
  });
});

describe("ZoneSnap", () => {
  const layout = layoutOf([
    section("hero", 2),
    section("rows", 4, [
      { at: 0.25, span: 0.5, from: 0, to: 1, seconds: 2 },
      { at: 0.8, from: 1, to: 2, seconds: 1 },
    ]),
  ]);
  // The zone is 3 to 5 screens.
  const rig = () => {
    const moves: Array<{ screens: number; seconds: number }> = [];
    let stops = 0;
    const snap = new ZoneSnap(
      {
        layout,
        move: (screens, seconds) => moves.push({ screens, seconds }),
        stop: () => stops++,
      },
      0,
    );
    const f: SnapFrame = {
      now: 0,
      real: 0,
      unit: 900,
      open: true,
      frozen: false,
      pushAt: 0,
      keyAt: 0,
      touching: false,
      holds: 0,
      playing: false,
      chasing: false,
      scripted: false,
    };
    return {
      snap,
      moves,
      stops: () => stops,
      f,
      /** Push the page (a wheel) to a place at `now`, then let it stand until `until`. */
      push(real: number, now: number, until: number, step = 16) {
        f.now = now;
        f.real = real;
        f.pushAt = now;
        snap.step(f);
        for (let t = now + step; t <= until; t += step) {
          f.now = t;
          snap.step(f);
        }
      },
    };
  };

  it("finishes forward when the visitor stops past a quarter going down, after the idle time", () => {
    const r = rig();
    r.push(3.9, 1000, 1000);
    r.f.now = 1100;
    r.f.real = 4.2;
    r.snap.step(r.f);
    r.f.now = 1100 + ZONE_IDLE_MS - 20;
    r.snap.step(r.f);
    expect(r.moves).toHaveLength(0);
    expect(r.snap.report().blocked).toBe("input");
    r.f.now = 1100 + ZONE_IDLE_MS + 20;
    r.snap.step(r.f);
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0]!.screens).toBe(5);
    expect(r.moves[0]!.seconds).toBeCloseTo(2 * (0.8 / 2), 9);
    expect(r.snap.moving).toBe(true);
  });

  it("goes back when the visitor stops a little way in", () => {
    const r = rig();
    r.push(3.0, 1000, 1000);
    r.f.now = 1050;
    r.f.real = 3.2;
    r.f.pushAt = 1050;
    r.snap.step(r.f);
    r.f.now = 1400;
    r.snap.step(r.f);
    expect(r.moves).toHaveLength(1);
    expect(r.moves[0]!.screens).toBe(3);
  });

  it("goes back when the visitor was scrolling up and stops at the middle", () => {
    const r = rig();
    r.push(4.9, 1000, 1000);
    r.f.now = 1050;
    r.f.real = 4.0;
    r.f.pushAt = 1050;
    r.snap.step(r.f);
    r.f.now = 1400;
    r.snap.step(r.f);
    expect(r.moves[0]!.screens).toBe(3);
  });

  it("does nothing in a dwell, outside the zone", () => {
    const r = rig();
    r.push(5.4, 1000, 1500);
    expect(r.moves).toHaveLength(0);
    expect(r.snap.report().blocked).toBe("outside");
    r.push(1.0, 2000, 2600);
    expect(r.moves).toHaveLength(0);
  });

  it("never moves before the visitor has pushed, nor inside the grace after a seek", () => {
    const r = rig();
    r.f.now = 3000;
    r.f.real = 4;
    r.snap.step(r.f);
    r.f.now = 4000;
    r.snap.step(r.f);
    expect(r.snap.report().blocked).toBe("unarmed");
    expect(r.moves).toHaveLength(0);
    r.push(4, 5000, 5000);
    r.snap.noteJump(5100);
    r.f.pushAt = 5200;
    r.f.now = 5200;
    r.snap.step(r.f);
    r.f.now = 5100 + ZONE_GRACE_MS - 50;
    r.snap.step(r.f);
    expect(r.moves).toHaveLength(0);
    expect(r.snap.report().blocked).toBe("grace");
  });

  it("waits for a hold, a clock play, a finger and a script move", () => {
    for (const patch of [
      { holds: 1 },
      { playing: true },
      { touching: true },
      { scripted: true },
      { chasing: true },
    ] as const) {
      const r = rig();
      r.push(4, 1000, 1000);
      Object.assign(r.f, patch);
      r.f.now = 2000;
      r.snap.step(r.f);
      r.f.now = 2400;
      r.snap.step(r.f);
      expect(r.moves).toHaveLength(0);
    }
  });

  it("is cancelled by a new input and a key also stops the scroller's move", () => {
    const r = rig();
    r.push(4, 1000, 1000);
    r.f.now = 1300;
    r.snap.step(r.f);
    expect(r.snap.moving).toBe(true);
    r.snap.cancel(false);
    expect(r.snap.moving).toBe(false);
    expect(r.stops()).toBe(0);
    r.f.pushAt = 1400;
    r.f.now = 1400;
    r.snap.step(r.f);
    r.f.now = 1700;
    r.snap.step(r.f);
    expect(r.snap.moving).toBe(true);
    r.snap.cancel(true);
    expect(r.stops()).toBe(1);
  });

  it("after a key it finishes the way it went, even from the first tenth", () => {
    const r = rig();
    r.push(3.0, 1000, 1000);
    r.f.now = 1050;
    r.f.real = 3.2;
    r.f.keyAt = 1050;
    r.f.pushAt = 900;
    r.snap.step(r.f);
    r.f.now = 1400;
    r.snap.step(r.f);
    expect(r.moves[0]!.screens).toBe(5);
  });

  it("tells the zone the page is inside, for the joint snap to leave alone", () => {
    const r = rig();
    expect(r.snap.any).toBe(true);
    expect(r.snap.inside(4)).toBe(true);
    expect(r.snap.inside(3)).toBe(false);
    expect(r.snap.inside(5.5)).toBe(false);
  });
});

describe("a zone flagged noSnap", () => {
  const layout = layoutOf([
    section("hero", 2),
    section("exit", 4, [
      { at: 0.25, span: 0.5, from: 0, to: 1, seconds: 2, noSnap: true },
      { at: 0.8, from: 1, to: 2, seconds: 1 },
    ]),
  ]);
  const frame = (): SnapFrame => ({
    now: 0,
    real: 0,
    unit: 900,
    open: true,
    frozen: false,
    pushAt: 0,
    keyAt: 0,
    touching: false,
    holds: 0,
    playing: false,
    chasing: false,
    scripted: false,
  });

  it("is a zone for the arithmetic and for the joint snap, but never moves the page by itself", () => {
    const moves: number[] = [];
    const snap = new ZoneSnap({ layout, move: (s) => moves.push(s), stop: () => undefined }, 0);
    expect(zoneRanges(layout)[0]!.snap).toBe(false);
    expect(snap.inside(4)).toBe(true);
    const f = frame();
    f.now = 1000;
    f.real = 4;
    f.pushAt = 1000;
    snap.step(f);
    for (let t = 1016; t < 4000; t += 16) {
      f.now = t;
      snap.step(f);
    }
    expect(moves).toHaveLength(0);
    expect(snap.report().blocked).toBe("free");
  });

  it("takes noSnap for a zone only", () => {
    expect(() =>
      validatePlays("x", [{ at: 0.1, from: 0, to: 1, seconds: 1, noSnap: true }]),
    ).toThrow(/noSnap/);
    expect(() =>
      validatePlays("x", [{ at: 0.1, span: 0.5, from: 0, to: 1, seconds: 1, noSnap: true }]),
    ).not.toThrow();
  });
});
