import { describe, expect, it } from "vitest";

import { BuildGate } from "./build-gate";

const never = (): Promise<void> => new Promise(() => undefined);
const at = (ms: number) => (): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("BuildGate", () => {
  it("is not done until it is finished", () => {
    const gate = new BuildGate();
    expect(gate.done).toBe(false);
    gate.finish();
    expect(gate.done).toBe(true);
  });

  it("waits for the quiet moment while nobody is waiting", async () => {
    const gate = new BuildGate();
    const seen: string[] = [];
    void gate.pause(never).then(() => seen.push("woke"));
    await new Promise((r) => setTimeout(r, 15));
    expect(seen).toEqual([]);
    const quick = gate.pause(at(5)).then(() => "quiet");
    await expect(quick).resolves.toBe("quiet");
  });

  it("lets a pause that is waiting go the moment the visitor arrives", async () => {
    const gate = new BuildGate();
    const waiting = gate.pause(never).then(() => "woke");
    gate.hurry();
    await expect(waiting).resolves.toBe("woke");
    expect(gate.hurried).toBe(true);
  });

  it("does not pause at all once the visitor is waiting", async () => {
    const gate = new BuildGate();
    gate.hurry();
    let called = false;
    await gate.pause(() => {
      called = true;
      return never();
    });
    expect(called).toBe(false);
  });

  it("ignores a hurry after the build is over", () => {
    const gate = new BuildGate();
    gate.finish();
    gate.hurry();
    expect(gate.hurried).toBe(false);
  });
});
