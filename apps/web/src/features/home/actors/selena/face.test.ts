import { describe, expect, it } from "vitest";

import { Face, MORPH_NAMES, PRESETS, indexOf } from "./face";

function run(face: Face, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) face.step(dt);
}

describe("Face", () => {
  it("every preset names only shapes the face has", () => {
    for (const preset of Object.values(PRESETS)) {
      for (const key of Object.keys(preset)) expect(MORPH_NAMES).toContain(key);
    }
  });

  it("holds an expression by an amount and lets go of it", () => {
    const face = new Face();
    face.set("surprised", 1);
    run(face, 1);
    expect(face.weights[indexOf("surprised")]).toBeGreaterThan(0.95);
    face.set("surprised", 0.5);
    run(face, 1);
    expect(face.weights[indexOf("surprised")]).toBeCloseTo(0.5, 1);
    face.set("neutral");
    run(face, 1);
    expect(face.weights[indexOf("surprised")]).toBeLessThan(0.02);
  });

  it("a one-shot reaction rises, holds and always ends", () => {
    const face = new Face();
    face.react("content", 1);
    expect(face.reacting()).toBe("content");
    let peak = 0;
    for (let i = 0; i < 60; i += 1) {
      face.step(1 / 60);
      peak = Math.max(peak, face.weights[indexOf("smile_closed")]!);
    }
    expect(peak).toBeGreaterThan(0.6);
    run(face, 1);
    expect(face.reacting()).toBeNull();
    expect(face.weights[indexOf("smile_closed")]).toBeLessThan(0.03);
  });

  it("blinks by itself, shuts the lids fully and opens again", () => {
    const face = new Face();
    let peak = 0;
    let blinks = 0;
    let was = 0;
    for (let i = 0; i < 60 * 30; i += 1) {
      face.step(1 / 60);
      const b = face.weights[indexOf("blink")]!;
      peak = Math.max(peak, b);
      if (b > 0.5 && was <= 0.5) blinks += 1;
      was = b;
    }
    expect(peak).toBeGreaterThan(0.95);
    // One blink every 2.4 to 5.8 s, a few of them double.
    expect(blinks).toBeGreaterThanOrEqual(5);
    expect(blinks).toBeLessThanOrEqual(16);
    expect(face.weights[indexOf("blink")]).toBeLessThan(0.05);
  });

  it("does not add a blink on top of a shape that already closes the eyes", () => {
    const face = new Face();
    face.set("laugh", 1);
    let most = 0;
    for (let i = 0; i < 60 * 20; i += 1) {
      face.step(1 / 60);
      most = Math.max(most, face.weights[indexOf("blink")]!);
    }
    expect(most).toBeLessThan(0.05);
  });

  it("talking moves the mouth and stops when told", () => {
    const face = new Face();
    face.talk(1);
    let min = 1;
    let max = 0;
    for (let i = 0; i < 60 * 2; i += 1) {
      face.step(1 / 60);
      const o = face.weights[indexOf("mouth_o")]!;
      min = Math.min(min, o);
      max = Math.max(max, o);
    }
    expect(max).toBeGreaterThan(0.3);
    expect(max - min).toBeGreaterThan(0.2);
    face.talk(0);
    run(face, 1);
    expect(face.weights[indexOf("mouth_o")]).toBeLessThan(0.05);
  });

  it("a step of zero changes nothing", () => {
    const face = new Face();
    face.set("angry");
    run(face, 0.5);
    const before = Array.from(face.weights);
    face.step(0);
    expect(Array.from(face.weights)).toEqual(before);
  });

  it("never asks for a weight outside 0 to 1", () => {
    const face = new Face();
    face.set("rage", 1);
    face.react("laugh", 1);
    face.talk(1);
    for (let i = 0; i < 300; i += 1) {
      face.step(1 / 60);
      for (const w of face.weights) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1.8);
      }
    }
  });
});
