import { describe, expect, it } from "vitest";

import {
  HOLD_SLACK_MS,
  MAX_PLAY_SECONDS,
  PLAY_BACK,
  PlayMachine,
  easeValue,
  hystOf,
  passthrough,
  playLimitMs,
  restingIndexAt,
  restingValueOf,
  validatePlays,
  type HomePlay,
} from "./plays";

const ONE: HomePlay[] = [{ at: 0.1, from: 0, to: 1, seconds: 2 }];
const THREE: HomePlay[] = [
  { at: 0.1, from: 0, to: 0.3, seconds: 1 },
  { at: 0.4, from: 0.3, to: 0.7, seconds: 1.5 },
  { at: 0.8, from: 0.7, to: 1, seconds: 1, back: 0.5 },
];

/** A harness that steps a machine at a frame rate over wall-clock time. */
function rig(plays: readonly HomePlay[], screens = 4, floor?: number) {
  const m = new PlayMachine("t", plays, { screens, floor });
  let now = 1000;
  const state = { sRaw: 0, sShown: 0 };
  const frame = (dt: number) => {
    now += dt * 1000;
    m.step(state.sRaw, state.sShown, dt, now);
  };
  return {
    m,
    state,
    /** Put the scroll somewhere (both scrolls) without stepping. */
    at(s: number) {
      state.sRaw = s;
      state.sShown = s;
    },
    frame,
    /** Run `seconds` of frames at `fps`. */
    run(seconds: number, fps = 60) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) frame(1 / fps);
    },
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("validatePlays", () => {
  const bad = (plays: HomePlay[]) => () => validatePlays("list", plays);

  it("accepts a contiguous, ordered table", () => {
    expect(bad(THREE)).not.toThrow();
  });

  it("names the section and the play in every error", () => {
    expect(bad([])).toThrow(/section fall: plays is empty/);
    expect(bad([{ at: 0.1, from: 0, to: 1, seconds: 0 }])).toThrow(
      /section fall: plays\[0\] seconds 0 must be above 0/,
    );
    expect(bad([{ at: 1.2, from: 0, to: 1, seconds: 1 }])).toThrow(
      /plays\[0\] at 1.2 is outside 0 to 1/,
    );
    expect(bad([{ at: -0.1, from: 0, to: 1, seconds: 1 }])).toThrow(/plays\[0\] at -0.1/);
    expect(bad([{ at: 0.1, from: 0, to: 1, seconds: MAX_PLAY_SECONDS + 1 }])).toThrow(
      /plays\[0\] seconds 11 is over 10/,
    );
    expect(bad([{ at: 0.1, from: 0.4, to: 0.4, seconds: 1 }])).toThrow(
      /plays\[0\] from 0.4 equals to 0.4/,
    );
    expect(bad([{ at: 0.1, from: 0, to: 1, seconds: 1, back: 0 }])).toThrow(/plays\[0\] back 0/);
    expect(bad([{ at: Number.NaN, from: 0, to: 1, seconds: 1 }])).toThrow(
      /plays\[0\] at is not a finite number/,
    );
  });

  it("refuses a table that is not ordered by at", () => {
    expect(
      bad([
        { at: 0.5, from: 0, to: 0.5, seconds: 1 },
        { at: 0.5, from: 0.5, to: 1, seconds: 1 },
      ]),
    ).toThrow(/plays\[1\] at 0.5 must be above the previous at 0.5/);
    expect(
      bad([
        { at: 0.5, from: 0, to: 0.5, seconds: 1 },
        { at: 0.2, from: 0.5, to: 1, seconds: 1 },
      ]),
    ).toThrow(/ordered by at/);
  });

  it("refuses a table that is not contiguous", () => {
    expect(
      bad([
        { at: 0.1, from: 0, to: 0.5, seconds: 1 },
        { at: 0.6, from: 0.6, to: 1, seconds: 1 },
      ]),
    ).toThrow(
      /plays\[1\] from 0.6 must equal the previous play's to 0.5 \(the list is contiguous\)/,
    );
  });

  it("lets the last play end beyond 1, to take over the tail", () => {
    expect(bad([{ at: 0.9, from: 0, to: 1.4, seconds: 2 }])).not.toThrow();
  });
});

describe("the curves", () => {
  it("run from 0 to 1 and clamp", () => {
    for (const ease of ["inOut", "out", "inOutSoft", "linear"] as const) {
      expect(easeValue(ease, 0)).toBeCloseTo(0, 9);
      expect(easeValue(ease, 1)).toBeCloseTo(1, 9);
      expect(easeValue(ease, -1)).toBe(0);
      expect(easeValue(ease, 2)).toBe(1);
      let last = -1;
      for (let i = 0; i <= 50; i++) {
        const v = easeValue(ease, i / 50);
        expect(v).toBeGreaterThanOrEqual(last - 1e-12);
        last = v;
      }
    }
  });

  it("has the shapes it names", () => {
    expect(easeValue("linear", 0.3)).toBeCloseTo(0.3, 9);
    expect(easeValue("inOut", 0.5)).toBeCloseTo(0.5, 9);
    expect(easeValue("inOutSoft", 0.5)).toBeCloseTo(0.5, 9);
    expect(easeValue("out", 0.2)).toBeGreaterThan(0.4);
    expect(easeValue("inOut", 0.2)).toBeLessThan(0.1);
  });
});

describe("resting values", () => {
  it("counts the thresholds at or before a position", () => {
    expect(restingIndexAt(THREE, 0.05)).toBe(0);
    expect(restingIndexAt(THREE, 0.1)).toBe(1);
    expect(restingIndexAt(THREE, 0.5)).toBe(2);
    expect(restingIndexAt(THREE, 0.8)).toBe(3);
    expect(restingIndexAt(THREE, 9)).toBe(3);
  });

  it("is piecewise constant: the first from, then each play's to", () => {
    expect(restingValueOf(THREE, 0)).toBe(0);
    expect(restingValueOf(THREE, 1)).toBe(0.3);
    expect(restingValueOf(THREE, 2)).toBe(0.7);
    expect(restingValueOf(THREE, 3)).toBe(1);
    expect(restingValueOf(THREE, 99)).toBe(1);
  });

  it("continues the scroll linearly in the lead and the tail", () => {
    expect(passthrough(-0.2)).toBeCloseTo(-0.2);
    expect(passthrough(0)).toBe(0);
    expect(passthrough(0.6)).toBe(0);
    expect(passthrough(1)).toBe(0);
    expect(passthrough(1.25)).toBeCloseTo(0.25);
  });

  it("sizes the hysteresis at 0.04 of the section or 0.12 of a screen, the larger", () => {
    expect(hystOf(2)).toBeCloseTo(0.06);
    expect(hystOf(9)).toBeCloseTo(0.04);
    expect(hystOf(3)).toBeCloseTo(0.04);
    expect(hystOf(1.2)).toBeCloseTo(0.1);
  });

  it("keeps the hold's limit a second and a half past the play", () => {
    expect(playLimitMs(2)).toBe(2000 + HOLD_SLACK_MS);
  });
});

describe("a forward play", () => {
  it("rests on first.from until the threshold, with no hold", () => {
    const r = rig(ONE);
    r.at(0.05);
    r.run(1);
    expect(r.m.value).toBe(0);
    expect(r.m.active).toBe(false);
    expect(r.m.fired).toBe(0);
    expect(r.m.resting).toBe(0);
  });

  it("starts when the scroll crosses the threshold downward, and holds", () => {
    const r = rig(ONE);
    r.at(0.05);
    r.run(0.2);
    r.at(0.11);
    r.frame(1 / 60);
    expect(r.m.active).toBe(true);
    expect(r.m.direction).toBe(1);
    expect(r.m.index).toBe(0);
    expect(r.m.fired).toBe(1);
    expect(r.m.resting).toBe(1);
    expect(r.m.limitMs).toBe(playLimitMs(2));
    expect(r.m.started).toBe(1);
  });

  it("runs from `from` to `to` on the curve and lets go when it arrives", () => {
    const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 2, ease: "linear" }]);
    r.at(0.2);
    r.frame(0);
    expect(r.m.active).toBe(true);
    expect(r.m.value).toBe(0);
    r.run(1);
    expect(r.m.value).toBeCloseTo(0.5, 2);
    expect(r.m.progress).toBeCloseTo(0.5, 2);
    r.run(0.99);
    expect(r.m.active).toBe(true);
    r.run(0.05);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
    expect(r.m.progress).toBe(0);
    expect(r.m.direction).toBe(0);
    expect(r.m.limitMs).toBe(0);
  });

  it("takes the same time at 30, 60 and 144 frames a second", () => {
    for (const fps of [30, 60, 144]) {
      const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 2, ease: "linear" }]);
      r.at(0.2);
      r.frame(0);
      r.run(1, fps);
      expect(r.m.value).toBeCloseTo(0.5, 1);
      r.run(0.98, fps);
      expect(r.m.active).toBe(true);
      r.run(0.05, fps);
      expect(r.m.active).toBe(false);
    }
  });

  it("does not fire again while the scroll stays below the next threshold", () => {
    const r = rig(THREE);
    r.at(0.15);
    r.run(2);
    expect(r.m.fired).toBe(1);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBeCloseTo(0.3);
    r.at(0.35);
    r.run(1);
    expect(r.m.fired).toBe(1);
    expect(r.m.value).toBeCloseTo(0.3);
  });

  it("holds its value between plays however far the scroll moves", () => {
    const r = rig(THREE);
    r.at(0.15);
    r.run(2);
    for (const s of [0.16, 0.2, 0.3, 0.39]) {
      r.at(s);
      r.run(0.1);
      expect(r.m.value).toBeCloseTo(0.3);
    }
  });

  it("uses the table's curve and passes it to the target both ways", () => {
    const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 2, ease: "out" }]);
    r.at(0.2);
    r.frame(0);
    r.run(0.5);
    // easeOutCubic(0.25) = 1 - 0.75^3
    expect(r.m.value).toBeCloseTo(1 - Math.pow(0.75, 3), 2);
  });
});

describe("a backward play", () => {
  function played() {
    const r = rig(THREE);
    r.at(0.9);
    r.frame(0);
    r.run(6);
    expect(r.m.fired).toBe(3);
    expect(r.m.active).toBe(false);
    return r;
  }

  it("waits for the hysteresis below the threshold", () => {
    const r = played();
    // the last threshold is 0.8; 4 screens, so the hysteresis is 0.04
    r.at(0.79);
    r.run(0.2);
    expect(r.m.active).toBe(false);
    r.at(0.77);
    r.run(0.2);
    expect(r.m.active).toBe(false);
    expect(r.m.fired).toBe(3);
    r.at(0.75);
    r.frame(1 / 60);
    expect(r.m.active).toBe(true);
    expect(r.m.direction).toBe(-1);
    expect(r.m.index).toBe(2);
    expect(r.m.fired).toBe(2);
    expect(r.m.resting).toBe(0.7);
  });

  it("runs the play the other way in `seconds * back`", () => {
    const r = played();
    r.at(0.7);
    r.frame(0);
    expect(r.m.limitMs).toBe(playLimitMs(0.5));
    r.run(0.45);
    expect(r.m.active).toBe(true);
    r.run(0.1);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBeCloseTo(0.7);
  });

  it("takes 0.7 of the length when the play does not say", () => {
    const r = rig(ONE);
    r.at(0.5);
    r.frame(0);
    r.run(2.1);
    expect(r.m.fired).toBe(1);
    r.at(0);
    r.frame(0);
    expect(r.m.direction).toBe(-1);
    expect(r.m.limitMs).toBeCloseTo(playLimitMs(2 * PLAY_BACK));
    r.run(1.3);
    expect(r.m.active).toBe(true);
    r.run(0.15);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(0);
    expect(r.m.fired).toBe(0);
  });

  it("goes from the target back to `from`, on the same curve toward it", () => {
    const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 1, ease: "linear", back: 1 }]);
    r.at(0.5);
    r.frame(0);
    r.run(1.05);
    r.at(0);
    r.frame(0);
    r.run(0.5);
    expect(r.m.value).toBeCloseTo(0.5, 1);
    r.run(0.55);
    expect(r.m.value).toBe(0);
  });

  it("does not replay on a wobble inside the hysteresis", () => {
    const r = played();
    for (let i = 0; i < 20; i++) {
      r.at(i % 2 ? 0.805 : 0.775);
      r.run(0.1);
    }
    expect(r.m.fired).toBe(3);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
  });

  it("fires again going down after it has been played back", () => {
    const r = played();
    r.at(0.5);
    r.frame(0);
    r.run(2);
    expect(r.m.fired).toBe(2);
    r.at(0.85);
    r.frame(0);
    expect(r.m.direction).toBe(1);
    expect(r.m.fired).toBe(3);
  });
});

describe("interrupts", () => {
  it("never reverses a play that is running, even when the scroll goes back", () => {
    const r = rig([{ at: 0.3, from: 0, to: 1, seconds: 2, ease: "linear" }]);
    r.at(0.4);
    r.frame(0);
    r.run(0.5);
    r.at(0); // the hold failed or momentum: the scroll goes far back
    r.run(0.5);
    expect(r.m.direction).toBe(1);
    expect(r.m.value).toBeCloseTo(0.5, 1);
    r.run(1.05);
    // The forward play ended, then the machine re-read the scroll and played back.
    expect(r.m.direction).toBe(-1);
    expect(r.m.fired).toBe(0);
  });

  it("goes straight on into the next play when momentum carried the page past its threshold", () => {
    const r = rig(THREE);
    r.at(0.15);
    r.frame(0);
    r.run(0.5);
    expect(r.m.index).toBe(0);
    r.at(0.45); // momentum during the first play
    r.run(0.5); // the first play ends (1 s) in the middle of this run
    r.run(0.1);
    expect(r.m.index).toBe(1);
    expect(r.m.fired).toBe(2);
    expect(r.m.active).toBe(true);
    expect(r.m.started).toBe(2);
  });

  it("stays held across a chain: no frame where the hold lets go", () => {
    const r = rig(THREE);
    r.at(0.9);
    r.frame(0);
    let free = 0;
    let frames = 0;
    for (let i = 0; i < 60 * 3.5; i++) {
      r.frame(1 / 60);
      frames++;
      if (!r.m.active) free++;
    }
    // 1 + 1.5 + 1 seconds of plays: the hold is not let go before 3.5 s.
    expect(frames).toBe(210);
    expect(r.m.fired).toBe(3);
    expect(r.m.started).toBe(3);
    expect(free).toBeLessThanOrEqual(1);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
  });

  it("plays a hard flick's scenes in a row, each locked, and ends on the last station", () => {
    const r = rig(THREE);
    r.state.sRaw = 2; // the flick has carried the page far; the scene trails it
    r.state.sShown = 1;
    r.frame(0);
    const seen: number[] = [];
    for (let i = 0; i < 60 * 5; i++) {
      r.frame(1 / 60);
      if (r.m.active && seen[seen.length - 1] !== r.m.index) seen.push(r.m.index);
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(r.m.value).toBe(1);
  });

  it("carries the left over time into the next play", () => {
    const r = rig([
      { at: 0.1, from: 0, to: 1, seconds: 1, ease: "linear" },
      { at: 0.2, from: 1, to: 2, seconds: 1, ease: "linear" },
    ]);
    r.at(0.5);
    r.frame(0);
    // one big step of 1.5 s: the first play ends, half of the second is done
    r.m.step(0.5, 0.5, 1.5, r.now());
    expect(r.m.index).toBe(1);
    expect(r.m.value).toBeCloseTo(1.5, 5);
  });
});

describe("jumps", () => {
  it("sets the resting value for the position: no play, no hold", () => {
    const r = rig(THREE);
    r.m.jump(0.5);
    expect(r.m.fired).toBe(2);
    expect(r.m.value).toBe(0.7);
    expect(r.m.active).toBe(false);
    r.m.jump(0);
    expect(r.m.value).toBe(0);
    expect(r.m.fired).toBe(0);
    r.m.jump(5);
    expect(r.m.value).toBe(1 + 4);
    expect(r.m.fired).toBe(3);
  });

  it("cancels a running play", () => {
    const r = rig(ONE);
    r.at(0.5);
    r.frame(0);
    r.run(0.5);
    expect(r.m.active).toBe(true);
    r.m.jump(0.05);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(0);
    expect(r.m.fired).toBe(0);
  });

  it("does not fire on the step after a jump that landed past a threshold", () => {
    const r = rig(THREE);
    r.m.jump(0.5);
    r.at(0.5);
    r.run(1);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(0.7);
  });

  it("lands before a threshold that it was a hair short of, and plays when the scroll goes on", () => {
    const r = rig(THREE);
    r.m.jump(0.39);
    expect(r.m.fired).toBe(1);
    r.at(0.41);
    r.frame(0);
    expect(r.m.active).toBe(true);
    expect(r.m.index).toBe(1);
  });
});

describe("leaving the section", () => {
  it("ends a running play where it was going and lets go", () => {
    const r = rig(ONE);
    r.at(0.5);
    r.frame(0);
    r.run(0.4);
    expect(r.m.active).toBe(true);
    r.m.leave();
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
    expect(r.m.fired).toBe(1);
  });

  it("ends a backward play at its `from`", () => {
    const r = rig(ONE);
    r.at(0.5);
    r.frame(0);
    r.run(2.1);
    r.at(0);
    r.frame(0);
    expect(r.m.direction).toBe(-1);
    r.m.leave();
    expect(r.m.value).toBe(0);
    expect(r.m.active).toBe(false);
  });

  it("does nothing at rest", () => {
    const r = rig(ONE);
    r.m.leave();
    expect(r.m.value).toBe(0);
  });
});

describe("the safety", () => {
  it("gives up its lock when the play has outlived its hold in wall-clock time", () => {
    const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 2, ease: "linear" }]);
    r.at(0.5);
    r.frame(0);
    expect(r.m.active).toBe(true);
    // A frozen scene: dt is 0 and the time goes by.
    r.advance(2000 + HOLD_SLACK_MS - 10);
    r.m.step(0.5, 0.5, 0, r.now());
    expect(r.m.active).toBe(true);
    r.advance(20);
    r.m.step(0.5, 0.5, 0, r.now());
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
  });

  it("gives up on a slow machine whose frames are clamped", () => {
    const r = rig([{ at: 0.1, from: 0, to: 1, seconds: 1, ease: "linear" }]);
    r.at(0.5);
    r.frame(0);
    // 2 frames a second with dt clamped to 0.05: the play would take 20 s
    for (let i = 0; i < 6; i++) {
      r.advance(500);
      r.m.step(0.5, 0.5, 0.05, r.now());
    }
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
  });

  it("measures each play from its own start", () => {
    const r = rig(THREE);
    r.at(0.9);
    r.frame(0);
    r.run(3.6);
    expect(r.m.fired).toBe(3);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBe(1);
  });
});

describe("the lead and the tail", () => {
  it("adds the scroll to the value outside the section, so the joints stay continuous", () => {
    const r = rig(ONE);
    r.state.sRaw = -0.05;
    r.state.sShown = -0.1;
    r.frame(1 / 60);
    expect(r.m.value).toBeCloseTo(-0.1);
    r.state.sRaw = 0;
    r.state.sShown = 0;
    r.frame(1 / 60);
    expect(r.m.value).toBeCloseTo(0);
  });

  it("goes on from the last `to` in the tail, whatever the last `to` is", () => {
    const r = rig([{ at: 0.9, from: 0, to: 1.2, seconds: 1, ease: "linear" }]);
    r.at(0.95);
    r.frame(0);
    r.run(1.1);
    expect(r.m.value).toBeCloseTo(1.2);
    r.at(1);
    r.run(0.1);
    expect(r.m.value).toBeCloseTo(1.2);
    r.at(1.15);
    r.run(0.1);
    expect(r.m.value).toBeCloseTo(1.35);
    r.at(1.3);
    r.run(0.1);
    expect(r.m.value).toBeCloseTo(1.5);
  });

  it("keeps a first.from that is not 0 in the lead too", () => {
    const r = rig([{ at: 0.2, from: -0.3, to: 1, seconds: 1 }]);
    r.state.sRaw = -0.1;
    r.state.sShown = -0.1;
    r.frame(1 / 60);
    expect(r.m.value).toBeCloseTo(-0.4);
  });

  it("drives the tail from the smoothed scroll and the thresholds from the real one", () => {
    const r = rig(ONE);
    r.state.sRaw = 0.2;
    r.state.sShown = 0.05; // the scene still trails the page by 0.15
    r.frame(0);
    expect(r.m.active).toBe(true);
    expect(r.m.value).toBe(0);
  });
});

describe("entering the section", () => {
  it("from above starts with nothing fired, so the crossing fires, even with the scene lagging", () => {
    const r = rig(ONE, 4, -0.125);
    // The scene enters the range (sShown -0.125) while the page is already 0.2 screens ahead.
    r.m.enter(-0.125);
    expect(r.m.fired).toBe(0);
    r.state.sRaw = 0.2;
    r.state.sShown = -0.125;
    r.frame(1 / 60);
    expect(r.m.active).toBe(true);
    expect(r.m.direction).toBe(1);
    expect(r.m.fired).toBe(1);
  });

  it("from below starts with everything fired, and does not play", () => {
    const r = rig(THREE);
    r.m.enter(1.12);
    expect(r.m.fired).toBe(3);
    r.state.sRaw = 1.1;
    r.state.sShown = 1.12;
    r.run(1);
    expect(r.m.active).toBe(false);
    expect(r.m.value).toBeCloseTo(1 + 0.12);
  });

  it("from below plays the last one back when the visitor scrolls on up", () => {
    const r = rig(THREE);
    r.m.enter(1.1);
    r.at(0.9);
    r.run(0.2);
    expect(r.m.active).toBe(false);
    r.at(0.7);
    r.frame(0);
    expect(r.m.direction).toBe(-1);
    expect(r.m.index).toBe(2);
  });
});

describe("reaching the first threshold from the top of the page", () => {
  it("can play the first scene back at the very top, where there is no lead", () => {
    // The hero: nothing below its start. The threshold is 0.01 and the lowest scroll is 0.
    const r = rig([{ at: 0.01, from: 0, to: 1, seconds: 1 }], 4.2, 0);
    r.at(0.05);
    r.frame(0);
    r.run(1.2);
    expect(r.m.fired).toBe(1);
    r.at(0);
    r.frame(0);
    expect(r.m.direction).toBe(-1);
    r.run(1);
    expect(r.m.value).toBe(0);
  });

  it("keeps a threshold at the start of a section with a lead crossable", () => {
    const r = rig([{ at: 0, from: 0, to: 1, seconds: 1 }], 2, -0.25);
    r.at(0.1);
    r.frame(0);
    r.run(1.2);
    r.at(-0.1);
    r.frame(0);
    expect(r.m.direction).toBe(-1);
  });
});

describe("what it exposes", () => {
  it("says where it rests, where it ends and how long the table is", () => {
    const r = rig(THREE);
    expect(r.m.length).toBe(3);
    expect(r.m.end).toBe(1);
    expect(r.m.resting).toBe(0);
    expect(r.m.id).toBe("t");
  });

  it("refuses a bad table at construction", () => {
    expect(
      () =>
        new PlayMachine("x", [{ at: 2, from: 0, to: 1, seconds: 1 }], {
          screens: 3,
        }),
    ).toThrow(/section x: plays\[0\] at 2/);
  });
});

describe("restOutside: the lead and the tail do not follow the scroll", () => {
  it("gives the played value only, in the lead and in the tail", () => {
    const m = new PlayMachine("t", ONE, { screens: 2, restOutside: true });
    m.jump(-0.3, -0.3);
    m.step(-0.3, -0.3, 0, 0);
    expect(m.value).toBe(0);
    m.jump(1.7, 1.7);
    m.step(1.7, 1.7, 0, 0);
    expect(m.value).toBe(1);
  });

  it("keeps the scroll's passthrough when it is off (the default)", () => {
    const m = new PlayMachine("t", ONE, { screens: 2 });
    m.jump(-0.3, -0.3);
    m.step(-0.3, -0.3, 0, 0);
    expect(m.value).toBeCloseTo(-0.3, 9);
    m.jump(1.7, 1.7);
    m.step(1.7, 1.7, 0, 0);
    expect(m.value).toBeCloseTo(1.7, 9);
  });
});
