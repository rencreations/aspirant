import { describe, expect, it } from "vitest";

import {
  FRIEND_IDS,
  friendOffScreen,
  friendWindows,
  leaving,
  passStep,
  placeOf,
  presence,
  slots,
  type FriendId,
} from "./friends";
import { completeLayout, type AnchorBox } from "./path";

const VW = 1440;
const VH = 900;
const MEETS: AnchorBox[] = [
  { id: "meet-3", x: 720, y: 13000, w: 115, room: 1 },
  { id: "meet-4", x: 720, y: 16600, w: 115, room: 1 },
  { id: "meet-5", x: 720, y: 22500, w: 115, room: 1 },
];
const LAYOUT = completeLayout(VW, VH, 80, 72, MEETS);

describe("the friends' stretches of scroll", () => {
  const w = friendWindows(LAYOUT);

  it("brings Mr. Bunny in before the third phase and takes him out above the fourth", () => {
    expect(w.bunny).not.toBeNull();
    const b = w.bunny;
    if (!b) return;
    expect(b.in1).toBeLessThan(13000);
    expect(b.out0).toBeGreaterThan(b.in1);
    expect(b.out1).toBeLessThan(16600);
  });

  it("overlaps the two's coming with Mr. Bunny's goodbye", () => {
    const b = w.bunny;
    const g = w.bold;
    if (!b || !g) throw new Error("no windows");
    // All four are on the page together for a stretch.
    expect(g.in1).toBeLessThan(b.out0);
    expect(presence(g, g.in1 + 1)).toBe(1);
    expect(presence(b, g.in1 + 1)).toBe(1);
  });

  it("has no friends without the meeting places", () => {
    const none = friendWindows(completeLayout(VW, VH, 80, 72));
    for (const id of FRIEND_IDS) expect(none[id]).toBeNull();
    expect(presence(null, 1000)).toBe(0);
    expect(leaving(null, 1000)).toBe(false);
  });

  it("is continuous in the scroll, and settles to the nearer end at rest", () => {
    for (const id of FRIEND_IDS) {
      const win = w[id];
      if (!win) continue;
      let was = presence(win, win.in0 - 50);
      for (let s = win.in0 - 50; s < win.out1 + 50; s += 7) {
        const p = presence(win, s);
        expect(Math.abs(p - was)).toBeLessThan(0.05);
        was = p;
        const settled = presence(win, s, true);
        expect(settled === 0 || settled === 1).toBe(true);
      }
    }
  });
});

describe("the friends' places", () => {
  const full: Record<FriendId, number> = { bunny: 1, bold: 1, soft: 1 };

  it("sweeps a friend across the drone without a step as the drone crosses the screen", () => {
    let was = slots({ droneX: 0, vw: VW, room: 1, presence: full });
    for (let x = 0; x <= VW; x += 6) {
      const now = slots({ droneX: x, vw: VW, room: 1, presence: full });
      for (const id of FRIEND_IDS) {
        expect(Math.abs(now[id].x - was[id].x)).toBeLessThan(0.15);
        expect(Math.abs(now[id].y - was[id].y)).toBeLessThan(0.15);
      }
      was = now;
    }
  });

  it("puts friends on the side of the middle of the screen where there is room", () => {
    const left = slots({ droneX: 150, vw: VW, room: 1, presence: full });
    const right = slots({ droneX: 1290, vw: VW, room: 1, presence: full });
    for (const id of FRIEND_IDS) {
      expect(left[id].x).toBeGreaterThan(1);
      expect(right[id].x).toBeLessThan(-1);
    }
    // In a row: the two do not take the same place.
    expect(Math.abs(left.bold.x - left.soft.x)).toBeGreaterThan(0.6);
  });

  it("keeps them close behind the drone where it has no room", () => {
    const close = slots({ droneX: 600, vw: VW, room: 0, presence: full });
    for (const id of FRIEND_IDS) {
      expect(Math.abs(close[id].x)).toBeLessThan(0.7);
      expect(close[id].y).toBeGreaterThan(0);
    }
  });

  it("comes in from its own edge, off the screen at nothing", () => {
    const drone = { x: 700, y: 400, size: 115 };
    for (const id of FRIEND_IDS) {
      const rel = slots({ droneX: 700, vw: VW, room: 1, presence: full })[id];
      const away = placeOf({ id, drone, rel, presence: 0, out: false, vw: VW, vh: VH, navH: 80 });
      expect(friendOffScreen(id, away, VW, VH)).toBe(true);
      const here = placeOf({ id, drone, rel, presence: 1, out: false, vw: VW, vh: VH, navH: 80 });
      expect(friendOffScreen(id, here, VW, VH)).toBe(false);
    }
  });

  it("changes sides of the drone only where nothing of it is over the drone", () => {
    const drone = { x: 500, y: 400, size: 120 };
    expect(passStep(true, false, { x: 520, y: 400, reach: 40 }, drone)).toBe(false);
    expect(passStep(true, false, { x: 760, y: 400, reach: 40 }, drone)).toBe(true);
    expect(passStep(false, true, { x: 520, y: 400, reach: 40 }, drone)).toBe(true);
  });
});
