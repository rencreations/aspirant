import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bindHold, holdCount, holdScroll, requestSnap, takeSnap } from "./hold";

/** A stand in for the site's lock: one underlying lock, counted. */
function fakeLock() {
  const log = { locks: 0, unlocks: 0, limits: [] as Array<number | undefined> };
  const lock = (limitMs?: number) => {
    log.locks++;
    log.limits.push(limitMs);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      log.unlocks++;
    };
  };
  return { log, lock };
}

describe("the scroll hold", () => {
  let unbind = () => undefined as void;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    unbind();
    vi.useRealTimers();
  });

  it("does nothing when no lock is bound", () => {
    const release = holdScroll(1000);
    expect(holdCount()).toBe(0);
    expect(() => release()).not.toThrow();
  });

  it("takes the site's lock once and gives it back when the last hold ends", () => {
    const { log, lock } = fakeLock();
    unbind = bindHold(lock);
    const a = holdScroll(5000);
    const b = holdScroll(5000);
    expect(log.locks).toBe(1);
    expect(holdCount()).toBe(2);
    a();
    expect(log.unlocks).toBe(0);
    expect(holdCount()).toBe(1);
    b();
    expect(log.unlocks).toBe(1);
    expect(holdCount()).toBe(0);
  });

  it("makes each release idempotent: a second call does not free the other holder", () => {
    const { log, lock } = fakeLock();
    unbind = bindHold(lock);
    const a = holdScroll(5000);
    const b = holdScroll(5000);
    a();
    a();
    a();
    expect(log.unlocks).toBe(0);
    expect(holdCount()).toBe(1);
    b();
    expect(log.unlocks).toBe(1);
  });

  it("lets a new hold start before the old one ends without ever letting go of the page", () => {
    const { log, lock } = fakeLock();
    unbind = bindHold(lock);
    const first = holdScroll(5000);
    const second = holdScroll(5000);
    first();
    expect(log.unlocks).toBe(0);
    expect(log.locks).toBe(1);
    second();
    expect(log.unlocks).toBe(1);
  });

  it("lets go of a hold of its own after its limit, and keeps the page for the others", () => {
    const { log, lock } = fakeLock();
    unbind = bindHold(lock);
    holdScroll(1000);
    const long = holdScroll(10_000);
    vi.advanceTimersByTime(1001);
    expect(holdCount()).toBe(1);
    expect(log.unlocks).toBe(0);
    vi.advanceTimersByTime(9000);
    expect(holdCount()).toBe(0);
    expect(log.unlocks).toBe(1);
    long();
    expect(log.unlocks).toBe(1);
  });

  it("takes the page again after it was given back", () => {
    const { log, lock } = fakeLock();
    unbind = bindHold(lock);
    holdScroll(1000)();
    holdScroll(1000)();
    expect(log.locks).toBe(2);
    expect(log.unlocks).toBe(2);
  });

  it("forgets its holds when the lock is unbound", () => {
    const { lock } = fakeLock();
    unbind = bindHold(lock);
    holdScroll(1000);
    unbind();
    expect(holdCount()).toBe(0);
  });
});

describe("requestSnap", () => {
  it("is read once", () => {
    expect(takeSnap()).toBe(false);
    requestSnap();
    expect(takeSnap()).toBe(true);
    expect(takeSnap()).toBe(false);
  });
});
