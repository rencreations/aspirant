import { describe, expect, it } from "vitest";

import type { FriendId, Slot } from "./friends";
import {
  createShow,
  ROUTINE_SECONDS,
  routineFrame,
  startRoutine,
  stepShow,
  type RoutineKind,
  type ShowInput,
} from "./routines";

const SLOTS: Record<FriendId, Slot> = {
  bunny: { x: 1.5, y: -0.06, scale: 1 },
  bold: { x: -1.38, y: -0.12, scale: 1 },
  soft: { x: 1.38, y: 0.08, scale: 1 },
};
const KINDS = Object.keys(ROUTINE_SECONDS) as RoutineKind[];
const ALL: FriendId[] = ["bunny", "bold", "soft"];

/** The turn a whole turn ends on looks the same as none. */
const turnless = (a: number) => Math.abs(Math.sin(a / 2));

describe("each routine", () => {
  for (const kind of KINDS) {
    it(`${kind} starts and ends where the friends and the drone are, with no step`, () => {
      const show = createShow();
      expect(startRoutine(show, kind, [...ALL], SLOTS)).toBe(true);
      const r = show.active;
      if (!r) throw new Error("no routine");
      const total = ROUTINE_SECONDS[kind];
      const step = 1 / 120;
      let was = routineFrame(r, SLOTS);
      // At its start and its end it adds nothing.
      for (const t of [0, total]) {
        r.t = t;
        const f = routineFrame(r, SLOTS);
        expect(Math.abs(f.drone.dx)).toBeLessThan(1e-6);
        expect(Math.abs(f.drone.dy)).toBeLessThan(1e-6);
        expect(turnless(f.drone.pitch)).toBeLessThan(1e-3);
        expect(turnless(f.drone.yaw)).toBeLessThan(1e-3);
        expect(Math.abs(f.drone.roll)).toBeLessThan(1e-3);
        for (const id of ALL) {
          const b = f.friends[id];
          if (!b) continue;
          expect(b.w).toBeLessThan(1e-6);
          expect(Math.abs(b.lift)).toBeLessThan(1e-6);
          expect(turnless(b.spin)).toBeLessThan(1e-3);
          expect(b.front).toBe(false);
        }
      }
      // In between, nothing it adds jumps between two frames.
      for (let t = 0; t <= total; t += step) {
        r.t = t;
        const f = routineFrame(r, SLOTS);
        expect(Math.abs(f.drone.dy - was.drone.dy)).toBeLessThan(0.05);
        expect(Math.abs(f.drone.dx - was.drone.dx)).toBeLessThan(0.05);
        expect(Math.abs(f.drone.roll - was.drone.roll)).toBeLessThan(0.2);
        for (const id of ALL) {
          const b = f.friends[id];
          const p = was.friends[id];
          if (!b || !p) continue;
          const x = p.x + (b.x - p.x);
          expect(Number.isFinite(x)).toBe(true);
          expect(Math.abs(b.w * b.x - p.w * p.x)).toBeLessThan(0.12);
          expect(Math.abs(b.lift - p.lift)).toBeLessThan(0.08);
        }
        was = f;
      }
    });
  }
});

function input(over: Partial<ShowInput>): ShowInput {
  return {
    dt: 1 / 60,
    present: { bunny: 0, bold: 0, soft: 0 },
    leaving: { bunny: false, bold: false, soft: false },
    atRest: false,
    pressed: false,
    slots: SLOTS,
    ...over,
  };
}

describe("the show", () => {
  it("greets Mr. Bunny when he arrives, once a stay", () => {
    const show = createShow();
    const r = stepShow(show, input({ present: { bunny: 1, bold: 0, soft: 0 } }));
    expect(r?.kind).toBe("greet");
    for (let i = 0; i < 400; i += 1)
      stepShow(show, input({ present: { bunny: 1, bold: 0, soft: 0 } }));
    expect(show.active?.kind ?? null).not.toBe("greet");
    // Gone, and back: greeted again.
    stepShow(show, input({}));
    for (let i = 0; i < 100; i += 1) stepShow(show, input({}));
    expect(stepShow(show, input({ present: { bunny: 1, bold: 0, soft: 0 } }))?.kind).toBe("greet");
  });

  it("has the four meet in a huddle, and Mr. Bunny says goodbye as he leaves", () => {
    const show = createShow();
    show.met.bunny = true;
    const all = { bunny: 1, bold: 1, soft: 1 };
    expect(stepShow(show, input({ present: all }))?.kind).toBe("huddle");
    for (let i = 0; i < 260; i += 1) stepShow(show, input({ present: all }));
    let kind: string | null = null;
    for (let i = 0; i < 120 && kind !== "bye"; i += 1) {
      kind =
        stepShow(
          show,
          input({
            present: { bunny: 0.8, bold: 1, soft: 1 },
            leaving: { bunny: true, bold: false, soft: false },
          }),
        )?.kind ?? null;
    }
    expect(kind).toBe("bye");
  });

  it("plays at rest, never in flight", () => {
    const show = createShow();
    show.met = { bunny: true, bold: true, soft: true };
    show.group = true;
    const all = { bunny: 1, bold: 1, soft: 1 };
    for (let i = 0; i < 120; i += 1) expect(stepShow(show, input({ present: all }))).toBeNull();
    let started: string | null = null;
    for (let i = 0; i < 120 && !started; i += 1) {
      started = stepShow(show, input({ present: all, atRest: true }))?.kind ?? null;
    }
    expect(started).not.toBeNull();
  });

  it("cheers when the drone is pressed with friends there", () => {
    const show = createShow();
    show.met = { bunny: true, bold: true, soft: true };
    show.group = true;
    const r = stepShow(show, input({ present: { bunny: 0, bold: 1, soft: 1 }, pressed: true }));
    expect(r?.kind).toBe("cheer");
    expect(r?.cast).toEqual(["bold", "soft"]);
  });
});
