import { afterEach, describe, expect, it } from "vitest";

import { INPUT_TAU, InputEnergy, smoothInput, wheelPixels } from "./input";

const DT = 1 / 60;

describe("wheelPixels", () => {
  it("passes pixels, turns lines and pages into pixels", () => {
    expect(wheelPixels(100, 0, 900)).toBe(100);
    expect(wheelPixels(3, 1, 900)).toBe(48);
    expect(wheelPixels(1, 2, 900)).toBe(900);
    expect(wheelPixels(-1, 2, 900)).toBe(-900);
  });
});

describe("smoothInput", () => {
  it("settles on a steady rate of input", () => {
    let v = 0;
    // 10 px a frame at 60 fps is 600 px/s
    for (let i = 0; i < 90; i++) v = smoothInput(v, 10, DT);
    expect(v).toBeGreaterThan(595);
    expect(v).toBeLessThan(605);
  });

  it("falls to a third (e^-1) in one time constant with no input", () => {
    let v = 600;
    const frames = Math.round(INPUT_TAU / DT);
    for (let i = 0; i < frames; i++) v = smoothInput(v, 0, DT);
    expect(v / 600).toBeCloseTo(Math.exp(-(frames * DT) / INPUT_TAU), 3);
    expect(v / 600).toBeGreaterThan(0.3);
    expect(v / 600).toBeLessThan(0.45);
  });

  it("is signed: input going up is negative", () => {
    let v = 0;
    for (let i = 0; i < 30; i++) v = smoothInput(v, -20, DT);
    expect(v).toBeLessThan(-500);
  });

  it("does not depend on the frame rate", () => {
    const run = (fps: number) => {
      let v = 0;
      const dt = 1 / fps;
      for (let i = 0; i < fps * 0.3; i++) v = smoothInput(v, 600 * dt, dt);
      return v;
    };
    expect(run(30)).toBeCloseTo(run(120), 0);
  });

  it("changes nothing for a dt of zero or less", () => {
    expect(smoothInput(123, 50, 0)).toBe(123);
    expect(smoothInput(123, 50, -1)).toBe(123);
  });

  it("reads one single notch as a short pulse that dies away", () => {
    // 100 px in one 60 Hz frame is 6000 px/s for 1 frame, averaged over the time constant
    let v = smoothInput(0, 100, DT);
    expect(v).toBeGreaterThan(500);
    expect(v).toBeLessThan(900);
    for (let i = 0; i < 60; i++) v = smoothInput(v, 0, DT);
    expect(Math.abs(v)).toBeLessThan(10);
  });
});

describe("InputEnergy", () => {
  const made: InputEnergy[] = [];
  afterEach(() => {
    for (const e of made) e.detach();
    made.length = 0;
  });

  function rig() {
    const target = new EventTarget() as unknown as Window;
    Object.defineProperty(target, "innerHeight", { value: 800 });
    const clock = { now: 1000 };
    const energy = new InputEnergy(() => clock.now);
    energy.attach(target);
    made.push(energy);
    const fire = (event: Event) => (target as unknown as EventTarget).dispatchEvent(event);
    return { energy, fire, clock };
  }

  const wheel = (deltaY: number, init: WheelEventInit = {}) =>
    new WheelEvent("wheel", { deltaY, ...init });

  function touch(type: string, y: number | null): Event {
    const event = new Event(type);
    Object.defineProperty(event, "touches", {
      value: y === null ? [] : [{ clientY: y }],
    });
    return event;
  }

  it("reads zero when nothing happened, and costs nothing", () => {
    const { energy } = rig();
    energy.step(DT);
    expect(energy.wheel).toBe(0);
    expect(energy.state.wheel).toBe(0);
  });

  it("reads a wheel going down as positive, going up as negative, and lets it die", () => {
    const { energy, fire } = rig();
    for (let i = 0; i < 20; i++) {
      fire(wheel(100));
      energy.step(DT);
    }
    expect(energy.wheel).toBeGreaterThan(4000);
    for (let i = 0; i < 90; i++) energy.step(DT);
    expect(energy.wheel).toBe(0);
    for (let i = 0; i < 20; i++) {
      fire(wheel(-100));
      energy.step(DT);
    }
    expect(energy.wheel).toBeLessThan(-4000);
  });

  it("normalises the wheel's delta mode", () => {
    const a = rig();
    const b = rig();
    a.fire(wheel(48, { deltaMode: 0 }));
    b.fire(wheel(3, { deltaMode: 1 }));
    a.energy.step(DT);
    b.energy.step(DT);
    expect(b.energy.wheel).toBeCloseTo(a.energy.wheel, 6);
    expect(a.energy.wheel).toBeGreaterThan(0);
  });

  it("ignores a pinch zoom and a sideways push", () => {
    const { energy, fire } = rig();
    fire(wheel(300, { ctrlKey: true }));
    fire(wheel(10, { deltaX: 300 }));
    energy.step(DT);
    expect(energy.wheel).toBe(0);
  });

  it("reads the finger: moving up is the page going down", () => {
    const { energy, fire } = rig();
    fire(touch("touchstart", 600));
    fire(touch("touchmove", 580));
    energy.step(DT);
    expect(energy.wheel).toBeGreaterThan(0);
    for (let i = 0; i < 90; i++) energy.step(DT);
    expect(energy.wheel).toBe(0);
    // the finger moving down is the page going up
    fire(touch("touchmove", 620));
    energy.step(DT);
    expect(energy.wheel).toBeLessThan(0);
    fire(touch("touchend", null));
  });

  it("keeps measuring while nothing else changes (a hold does not stop the listeners)", () => {
    const { energy, fire } = rig();
    fire(wheel(50));
    energy.step(DT);
    const first = energy.wheel;
    fire(wheel(50));
    energy.step(DT);
    expect(energy.wheel).toBeGreaterThan(first * 0.9);
  });

  it("does not change while the scene is frozen (dt 0)", () => {
    const { energy, fire } = rig();
    fire(wheel(100));
    energy.step(0);
    expect(energy.wheel).toBe(0);
    energy.step(DT);
    expect(energy.wheel).toBeGreaterThan(0);
  });

  it("stamps the time of the last wheel, touch and scroll key", () => {
    const { energy, fire, clock } = rig();
    expect(energy.lastInputAt).toBe(0);
    clock.now = 1500;
    fire(wheel(10));
    expect(energy.lastInputAt).toBe(1500);
    clock.now = 1600;
    fire(touch("touchstart", 100));
    expect(energy.lastInputAt).toBe(1600);
    clock.now = 1700;
    fire(new KeyboardEvent("keydown", { key: "a" }));
    expect(energy.lastInputAt).toBe(1600);
    fire(new KeyboardEvent("keydown", { key: "PageDown" }));
    expect(energy.lastInputAt).toBe(1700);
  });

  it("stops listening after detach and forgets after reset", () => {
    const { energy, fire } = rig();
    fire(wheel(100));
    energy.reset();
    energy.step(DT);
    expect(energy.wheel).toBe(0);
    energy.detach();
    fire(wheel(100));
    energy.step(DT);
    expect(energy.wheel).toBe(0);
  });
});
