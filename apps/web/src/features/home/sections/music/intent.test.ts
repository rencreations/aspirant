import { describe, expect, it } from "vitest";

import {
  GRACE_MS,
  IntentGate,
  QUIET_MS,
  TAP_MS,
  TAP_PX,
  TOUCH_PX,
  WHEEL_PX,
  isScrollOnKey,
  isTap,
} from "./intent";

describe("IntentGate", () => {
  it("counts nothing before it is armed", () => {
    const gate = new IntentGate();
    expect(gate.armed).toBe(false);
    expect(gate.feed(100, 500, WHEEL_PX)).toBe(false);
  });

  it("ignores the tail of the gesture that was going when the scene arrived", () => {
    const gate = new IntentGate();
    gate.feed(0, 40, WHEEL_PX);
    gate.feed(200, 40, WHEEL_PX);
    gate.arm(400);
    // The same gesture goes on (events less than QUIET_MS apart): still the old one.
    for (let t = 450; t < 3000; t += 100) expect(gate.feed(t, 60, WHEEL_PX)).toBe(false);
  });

  it("counts a fresh gesture that begins after a pause", () => {
    const gate = new IntentGate();
    gate.arm(400, 0);
    gate.feed(420, 30, WHEEL_PX);
    // A gap longer than QUIET_MS ends that gesture and begins another.
    const start = 420 + QUIET_MS + 50;
    expect(gate.feed(start, 50, WHEEL_PX)).toBe(false);
    expect(gate.feed(start + 60, 60, WHEEL_PX)).toBe(true);
  });

  it("a gesture that began after the arming counts once it covers the distance", () => {
    const gate = new IntentGate();
    gate.arm(1000, 0);
    expect(gate.feed(1100, 99, WHEEL_PX)).toBe(false);
    expect(gate.feed(1120, 1, WHEEL_PX)).toBe(true);
  });

  it("measures upward and downward movement alike", () => {
    const gate = new IntentGate();
    gate.arm(0, 0);
    expect(gate.feed(10, -TOUCH_PX, TOUCH_PX)).toBe(true);
  });

  it("a finger going down always begins a new gesture", () => {
    const gate = new IntentGate();
    gate.feed(0, 10, TOUCH_PX);
    gate.arm(50, 0);
    gate.feed(100, 10, TOUCH_PX);
    gate.begin();
    expect(gate.feed(150, TOUCH_PX, TOUCH_PX)).toBe(true);
  });

  it("a gesture that begins within the grace after the scene stood is too early", () => {
    const gate = new IntentGate();
    gate.arm(1000);
    // Swipe after swipe, each a new finger: none of them in the first GRACE_MS counts.
    for (let t = 1050; t < 1000 + GRACE_MS; t += 120) {
      gate.begin();
      expect(gate.feed(t, 200, TOUCH_PX)).toBe(false);
    }
    // The first finger to go down after the grace does.
    gate.begin();
    expect(gate.feed(1000 + GRACE_MS + 20, 200, TOUCH_PX)).toBe(true);
  });

  it("disarming stops everything", () => {
    const gate = new IntentGate();
    gate.arm(0);
    gate.disarm();
    expect(gate.armed).toBe(false);
    expect(gate.feed(2000, 900, WHEEL_PX)).toBe(false);
  });
});

describe("isScrollOnKey", () => {
  it("knows the keys that go on down the page", () => {
    for (const key of [" ", "PageDown", "ArrowDown", "End"]) expect(isScrollOnKey(key)).toBe(true);
    for (const key of ["ArrowUp", "PageUp", "Home", "a", "Enter", "Tab"]) {
      expect(isScrollOnKey(key)).toBe(false);
    }
  });
});

describe("isTap", () => {
  it("is a finger that lifts where it went down, soon", () => {
    expect(isTap(0, 0, 90)).toBe(true);
    expect(isTap(3, -4, TAP_MS)).toBe(true);
  });

  it("is not a drag", () => {
    expect(isTap(0, TAP_PX + 1, 100)).toBe(false);
    expect(isTap(40, 0, 100)).toBe(false);
  });

  it("is not a long press", () => {
    expect(isTap(0, 0, TAP_MS + 1)).toBe(false);
    expect(isTap(0, 0, -1)).toBe(false);
  });

  it("counts the distance, not each axis", () => {
    // 9 and 9 is about 12.7 pixels away: past the limit.
    expect(isTap(9, 9, 100)).toBe(false);
    expect(isTap(8, 8, 100)).toBe(true);
  });
});
