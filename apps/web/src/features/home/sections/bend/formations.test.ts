import { describe, expect, it } from "vitest";

import { DRONE_CARD, SPIRAL_CARDS, STAGE, T } from "./beats";
import {
  FLIGHT,
  LENS,
  RING_CARDS,
  WALL_CARDS,
  arriveAt,
  arrivalStart,
  baseOf,
  blurAt,
  copyPose,
  flightAt,
  fly,
  gatherAt,
  isTall,
  makePose,
  orderInWave,
  outAt,
  paperPose,
  rankFromTop,
  ringExit,
  ringPose,
  ringRadius,
  ringTurn,
  spiralExit,
  spiralInAt,
  spiralPose,
  spiralStart,
  throwEase,
  waveOf,
  wallCount,
  wallDrop,
  wallPose,
} from "./formations";

const SCREENS = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 1280, h: 720 },
  { w: 390, h: 844 },
  { w: 820, h: 1180 },
];

/** Where a pose lands on the screen (the stage frame), through the lens. */
const screenOf = (p: { x: number; y: number; z: number }) => {
  const k = LENS / (LENS - p.z);
  return { x: p.x * k, y: p.y * k };
};

const finite = (p: ReturnType<typeof makePose>) =>
  [p.x, p.y, p.z, p.rx, p.ry, p.rz, p.size, p.opacity, p.blur, p.live, p.shade].every(
    Number.isFinite,
  );

describe("the wall", () => {
  it("has the cards of its screen, all with finite poses", () => {
    for (const vp of SCREENS) {
      const n = wallCount(vp);
      expect(n).toBe(isTall(vp) ? RING_CARDS : WALL_CARDS);
      const p = makePose();
      for (let i = 0; i < n; i += 1) {
        wallPose(i, vp, p);
        expect(finite(p)).toBe(true);
        expect(p.size).toBeGreaterThan(20);
      }
    }
  });

  it("puts a poster where the table says it is on the screen, whatever its depth", () => {
    const vp = { w: 1440, h: 900 };
    const p = makePose();
    wallPose(4, vp, p);
    const s = screenOf(p);
    expect(s.x).toBeCloseTo(-0.6 * 720, 4);
    expect(s.y).toBeCloseTo(0.12 * 450, 4);
  });

  it("keeps the middle column free of near and mid posters (Tetra stands there)", () => {
    for (const vp of SCREENS) {
      const p = makePose();
      for (let i = 0; i < wallCount(vp); i += 1) {
        wallPose(i, vp, p);
        if (p.z < -300) continue; // far posters are behind her
        const s = screenOf(p);
        expect(Math.abs(s.x)).toBeGreaterThan(vp.w * 0.5 * 0.17);
      }
    }
  });

  it("keeps every poster off the title's band (top centre) and the button's (bottom centre)", () => {
    for (const vp of SCREENS) {
      const p = makePose();
      for (let i = 0; i < wallCount(vp); i += 1) {
        wallPose(i, vp, p);
        const s = screenOf(p);
        const nx = s.x / (vp.w / 2);
        const ny = s.y / (vp.h / 2);
        expect(!(Math.abs(nx) < 0.3 && ny > 0.62)).toBe(true);
        expect(!(Math.abs(nx) < 0.25 && ny < -0.62 && p.z > -300)).toBe(true);
      }
    }
  });

  it("is sharp in the middle depths and out of focus near and far", () => {
    expect(blurAt(-60)).toBe(0);
    expect(blurAt(40)).toBe(0);
    expect(blurAt(300)).toBeGreaterThan(0.5);
    expect(blurAt(-600)).toBeGreaterThan(0.4);
    expect(blurAt(-520)).toBeGreaterThan(blurAt(-300));
  });

  it("sizes cards by their size on the screen, so a near poster is the big one", () => {
    const vp = { w: 1440, h: 900 };
    const near = makePose();
    const mid = makePose();
    const far = makePose();
    wallPose(0, vp, near);
    wallPose(4, vp, mid);
    wallPose(12, vp, far);
    const onScreen = (p: ReturnType<typeof makePose>) => (p.size * LENS) / (LENS - p.z);
    expect(onScreen(near)).toBeGreaterThan(onScreen(mid));
    expect(onScreen(mid)).toBeGreaterThan(onScreen(far));
  });

  it("throws the posters in by waves: earth, air, water, fire, one after another", () => {
    const vp = { w: 1440, h: 900 };
    const n = wallCount(vp);
    const firstOf = [Infinity, Infinity, Infinity, Infinity];
    for (let i = 0; i < n; i += 1) {
      const w = waveOf(i, vp);
      firstOf[w] = Math.min(firstOf[w]!, arriveAt(i, vp));
    }
    expect(firstOf[0]!).toBeLessThan(firstOf[1]!);
    expect(firstOf[1]!).toBeLessThan(firstOf[2]!);
    expect(firstOf[2]!).toBeLessThan(firstOf[3]!);
    for (let i = 0; i < n; i += 1) {
      expect(arriveAt(i, vp)).toBeGreaterThanOrEqual(T.bendFrom);
      expect(arriveAt(i, vp) + FLIGHT).toBeLessThanOrEqual(T.holdFrom + 0.3);
    }
  });

  it("numbers the posters of a wave from zero, and ranks them from the top of the screen", () => {
    const vp = { w: 1440, h: 900 };
    const n = wallCount(vp);
    const ranks = Array.from({ length: n }, (_, i) => rankFromTop(i, vp));
    expect([...ranks].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    for (let w = 0; w < 4; w += 1) {
      const orders = Array.from({ length: n }, (_, i) => i)
        .filter((i) => waveOf(i, vp) === w)
        .map((i) => orderInWave(i, vp));
      expect(orders).toEqual(orders.map((_, k) => k));
    }
  });

  it("starts each flight off the screen and ends it in the slot", () => {
    for (const vp of SCREENS) {
      const a = makePose();
      const b = makePose();
      for (let i = 0; i < wallCount(vp); i += 1) {
        arrivalStart(i, vp, a);
        wallPose(i, vp, b);
        const s = screenOf(a);
        const outside = Math.abs(s.x) > vp.w / 2 || Math.abs(s.y) > vp.h / 2;
        expect(outside).toBe(true);
        const out = makePose();
        fly(a, b, 1, 0.35, out);
        expect(out.x).toBeCloseTo(b.x, 6);
        expect(out.y).toBeCloseTo(b.y, 6);
        expect(out.z).toBeCloseTo(b.z, 6);
        expect(out.size).toBeCloseTo(b.size, 6);
      }
    }
  });
});

describe("the ring", () => {
  it("stands cards on a circle round Tetra's chest, half in front of her and half behind", () => {
    for (const vp of SCREENS) {
      const p = makePose();
      let front = 0;
      let back = 0;
      for (let k = 0; k < RING_CARDS; k += 1) {
        ringPose(k, RING_CARDS, 0.3, vp, p);
        expect(finite(p)).toBe(true);
        if (p.z > 0) front += 1;
        else back += 1;
        // Seen from above the cards are on a circle of the ring's radius.
        const r = ringRadius(vp);
        const along = Math.hypot(p.x, p.z / (Math.cos(0.42) * Math.min(1, 900 / baseOf(vp))));
        expect(along).toBeCloseTo(r, 3);
      }
      expect(front).toBeGreaterThanOrEqual(6);
      expect(back).toBeGreaterThanOrEqual(6);
    }
  });

  it("is lower in front than behind (a circle seen a little from above)", () => {
    const vp = { w: 1440, h: 900 };
    const front = makePose();
    const back = makePose();
    ringPose(0, RING_CARDS, 0, vp, front);
    ringPose(0, RING_CARDS, Math.PI, vp, back);
    expect(front.z).toBeGreaterThan(0);
    expect(back.z).toBeLessThan(0);
    expect(front.y).toBeLessThan(back.y);
  });

  it("turns whole: the card k at turn t is the card k+1 at t minus a step", () => {
    const vp = { w: 1440, h: 900 };
    const a = makePose();
    const b = makePose();
    const step = (Math.PI * 2) / RING_CARDS;
    ringPose(3, RING_CARDS, 0.7, vp, a);
    ringPose(4, RING_CARDS, 0.7 - step, vp, b);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
    expect(a.z).toBeCloseTo(b.z, 6);
  });

  it("shows the picture of a card that is behind to the viewer (it is turned round, not mirrored)", () => {
    const vp = { w: 1440, h: 900 };
    const p = makePose();
    ringPose(0, RING_CARDS, Math.PI, vp, p);
    // The card faces outward (toward -z) at yaw pi, then is turned a half turn to face +z again.
    expect(Math.cos(p.ry)).toBeGreaterThan(0.99);
  });

  it("gathers the highest poster first and throws the ring out in a short span", () => {
    const vp = { w: 1440, h: 900 };
    const top = rankFromTop(0, vp) === 0 ? 0 : 1;
    expect(gatherAt(top, vp)).toBeCloseTo(T.gatherFrom, 6);
    for (let i = 0; i < wallCount(vp); i += 1) {
      expect(gatherAt(i, vp)).toBeGreaterThanOrEqual(T.gatherFrom);
      expect(gatherAt(i, vp) + 0.6).toBeLessThanOrEqual(T.gatherTo + 0.05);
    }
    for (let k = 0; k < RING_CARDS; k += 1) {
      expect(outAt(k)).toBeGreaterThanOrEqual(T.outFrom);
      expect(outAt(k) + 0.5).toBeLessThanOrEqual(T.outTo + 0.05);
    }
  });

  it("turns with the page, and faster as it is thrown", () => {
    expect(ringTurn(T.gatherFrom)).toBe(0);
    expect(ringTurn(T.outTo)).toBeGreaterThan(ringTurn(T.outFrom - 0.2));
    expect(ringTurn(T.gatherFrom + 1) - ringTurn(T.gatherFrom)).toBeGreaterThan(0.5);
  });

  it("throws a ring card off the screen, and a spare poster away", () => {
    for (const vp of SCREENS) {
      const from = makePose();
      const to = makePose();
      ringPose(2, RING_CARDS, 0, vp, from);
      ringExit(from, vp, to);
      const s = screenOf(to);
      expect(Math.abs(s.x) > vp.w / 2 || Math.abs(s.y) > vp.h / 2).toBe(true);
      expect(to.opacity).toBe(0);
      wallPose(0, vp, from);
      wallDrop(from, vp, to);
      expect(to.opacity).toBe(0);
    }
  });
});

describe("the spiral", () => {
  const vp = { w: 1440, h: 900 };

  it("has the front card in front of Tetra's left and the others round her", () => {
    const p = makePose();
    spiralPose(0, 0, vp, p);
    expect(p.z).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(0);
    expect(p.opacity).toBeCloseTo(1, 3);
  });

  it("shows a card ahead only when it is near, and one that is past only when it is just past", () => {
    const p = makePose();
    spiralPose(9, 0, vp, p);
    expect(p.opacity).toBe(0);
    spiralPose(0, 9, vp, p);
    expect(p.opacity).toBe(0);
    spiralPose(0, 1.5, vp, p);
    expect(p.opacity).toBeGreaterThan(0.5);
  });

  it("brings the drone's card to the front at the end of the advance", () => {
    const front = makePose();
    spiralPose(DRONE_CARD, DRONE_CARD, vp, front);
    const first = makePose();
    spiralPose(0, 0, vp, first);
    expect(front.x).toBeCloseTo(first.x, 6);
    expect(front.z).toBeCloseTo(first.z, 6);
    expect(front.opacity).toBeCloseTo(1, 6);
    expect(SPIRAL_CARDS).toBe(DRONE_CARD + 1);
  });

  it("flies the cards in from above and below, in order", () => {
    const a = makePose();
    for (let k = 0; k < SPIRAL_CARDS; k += 1) {
      spiralStart(k, vp, a);
      const s = screenOf(a);
      expect(Math.abs(s.y)).toBeGreaterThan(vp.h / 2);
      if (k > 0) expect(spiralInAt(k)).toBeGreaterThan(spiralInAt(k - 1));
    }
    expect(spiralInAt(0)).toBeGreaterThanOrEqual(T.spiralFrom);
    expect(spiralInAt(DRONE_CARD) + 0.75).toBeLessThanOrEqual(T.advTo);
  });

  it("sends the others up and off as the drone's card takes the stage", () => {
    const from = makePose();
    const to = makePose();
    spiralPose(8, DRONE_CARD, vp, from);
    spiralExit(from, vp, to);
    expect(to.opacity).toBe(0);
    expect(to.x).toBeLessThan(from.x);
  });

  it("stands the paper to the right of Tetra, facing the viewer", () => {
    for (const v of SCREENS) {
      const p = makePose();
      paperPose(v, p);
      const s = screenOf(p);
      expect(s.x).toBeGreaterThan(v.w * STAGE.tx + v.w * 0.1);
      expect(s.x).toBeLessThan(v.w / 2);
      expect(Math.abs(p.ry)).toBeLessThan(0.2);
      expect(p.size).toBeGreaterThan(baseOf(v) * 0.2);
    }
  });
});

describe("flights", () => {
  it("run from one pose to the other and back off the swirl at both ends", () => {
    const a = makePose();
    const b = makePose();
    a.x = -300;
    a.y = 100;
    a.z = -200;
    b.x = 250;
    b.y = -80;
    b.z = 300;
    b.size = 200;
    const o = makePose();
    fly(a, b, 0, 0.9, o);
    expect(o.x).toBeCloseTo(a.x, 6);
    expect(o.z).toBeCloseTo(a.z, 6);
    fly(a, b, 1, 0.9, o);
    expect(o.x).toBeCloseTo(b.x, 6);
    expect(o.z).toBeCloseTo(b.z, 6);
    expect(o.size).toBeCloseTo(200, 6);
    // In the middle the swirl bends the path off the straight line.
    fly(a, b, 0.5, 0.9, o);
    expect(Math.hypot(o.x - (a.x + b.x) / 2, o.z - (a.z + b.z) / 2)).toBeGreaterThan(20);
  });

  it("is out of focus while it moves and sharp when it stops", () => {
    const a = makePose();
    const b = makePose();
    const o = makePose();
    fly(a, b, 0.5, 0, o);
    expect(o.blur).toBeGreaterThan(0.2);
    fly(a, b, 1, 0, o);
    expect(o.blur).toBeCloseTo(0, 9);
  });

  it("takes the short way round for an angle", () => {
    const a = makePose();
    const b = makePose();
    a.rz = 3;
    b.rz = -3;
    const o = makePose();
    fly(a, b, 0.5, 0, o);
    // The short way from 3 to -3 passes pi, not 0.
    expect(Math.abs(Math.cos(o.rz))).toBeGreaterThan(0.95);
    copyPose(a, o);
    expect(o.rz).toBe(3);
  });

  it("clamps and settles (the throw and the flight window)", () => {
    expect(throwEase(0)).toBe(0);
    expect(throwEase(1)).toBeCloseTo(1, 9);
    expect(Math.max(...Array.from({ length: 101 }, (_, i) => throwEase(i / 100)))).toBeGreaterThan(
      1,
    );
    expect(throwEase(-1)).toBe(0);
    expect(flightAt(0, 1, 0.5)).toBe(0);
    expect(flightAt(1.25, 1, 0.5)).toBeCloseTo(0.5, 9);
    expect(flightAt(3, 1, 0.5)).toBe(1);
  });
});
