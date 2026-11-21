import { describe, expect, it } from "vitest";
import { beatsAt } from "./timeline";

describe("Selena's exit", () => {
  it("clears the copy before the camera moves", () => {
    const b = beatsAt(1.35);
    expect(b.drawer).toBe(0);
    expect(b.clip).toBe(0);
  });

  it("keeps the doll and dragon visible through the bite and wipes on the turn", () => {
    expect(beatsAt(2.95).wipe).toBe(0);
    const turn = beatsAt(3.5);
    expect(turn.wipe).toBeGreaterThan(0);
    expect(turn.actors).toBe(true);
    expect(beatsAt(4).wipe).toBe(1);
    expect(beatsAt(3.5)).toEqual(turn);
  });
});
