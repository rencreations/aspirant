import { describe, expect, it } from "vitest";

import { StateMachine, TO_IDLE_AT, TO_POSE_AT, interactionOf } from "./states";

describe("the target", () => {
  it("has a hysteresis", () => {
    const m = new StateMachine();
    m.target(0.1);
    expect(m.idleWanted).toBe(false);
    m.target(TO_IDLE_AT + 0.01);
    expect(m.idleWanted).toBe(true);
    // Between the two thresholds nothing flips.
    m.target(0.08);
    expect(m.idleWanted).toBe(true);
    m.target(TO_POSE_AT + 0.01);
    expect(m.idleWanted).toBe(true);
    m.target(TO_POSE_AT - 0.01);
    expect(m.idleWanted).toBe(false);
    m.target(0.08);
    expect(m.idleWanted).toBe(false);
  });
});

describe("the transitions", () => {
  it("plays to idle once and then loops the idle", () => {
    const m = new StateMachine();
    m.target(0.5);
    expect(m.step(false)).toBe("toIdle");
    expect(m.step(false)).toBeNull();
    expect(m.step(false)).toBeNull();
    expect(m.step(true)).toBe("idle");
    expect(m.step(true)).toBeNull();
  });

  it("plays to pose when the frame shrinks back", () => {
    const m = new StateMachine(true);
    m.target(0);
    expect(m.step(false)).toBe("toPose");
    expect(m.step(true)).toBe("pose");
  });

  it("never cuts a transition when the visitor reverses", () => {
    const m = new StateMachine();
    m.target(0.5);
    m.step(false);
    expect(m.state).toBe("toIdle");
    m.target(0);
    // The clip that began goes on to its end.
    expect(m.step(false)).toBeNull();
    expect(m.state).toBe("toIdle");
    // At its end the opposite transition starts at once.
    expect(m.step(true)).toBe("toPose");
    expect(m.step(false)).toBeNull();
    expect(m.step(true)).toBe("pose");
  });

  it("goes back and forth again when the visitor keeps flicking", () => {
    const m = new StateMachine();
    m.target(1);
    m.step(false);
    m.target(0);
    m.step(true);
    expect(m.state).toBe("toPose");
    m.target(1);
    expect(m.step(true)).toBe("toIdle");
    expect(m.step(true)).toBe("idle");
  });

  it("stops mid scroll: the clip finishes, then the loop that matches where the frame rests", () => {
    const m = new StateMachine();
    // The growth passes the threshold and rests at 40 percent: idle is the target.
    m.target(0.4);
    m.step(false);
    expect(m.state).toBe("toIdle");
    m.target(0.4);
    expect(m.step(true)).toBe("idle");
    // The idle snap shrinks the frame back below the lower threshold: the way back plays.
    m.target(0.02);
    expect(m.step(false)).toBe("toPose");
    expect(m.step(true)).toBe("pose");
  });
});

describe("a jump", () => {
  it("sets the matching loop with no transition", () => {
    const m = new StateMachine();
    m.jump(1);
    expect(m.state).toBe("idle");
    expect(m.step(false)).toBeNull();
    m.jump(0);
    expect(m.state).toBe("pose");
    expect(m.step(false)).toBeNull();
  });
});

describe("what reacts to the cursor", () => {
  it("looks in the loops, turns the view in the idle only, and nothing in a transition", () => {
    expect(interactionOf("pose")).toEqual({ look: 1, view: 0 });
    expect(interactionOf("idle")).toEqual({ look: 1, view: 1 });
    expect(interactionOf("toIdle")).toEqual({ look: 0, view: 0 });
    expect(interactionOf("toPose")).toEqual({ look: 0, view: 0 });
  });
});
