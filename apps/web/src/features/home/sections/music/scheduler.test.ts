import { describe, expect, it } from "vitest";

import {
  BACK,
  CARRY,
  GIVE_UP,
  LIFT,
  NEEDLE,
  RETURN_AT,
  Scheduler,
  TO_CRATE,
  type DiscPhase,
  type Step,
} from "./scheduler";

/** Run the scheduler for `seconds` at 60 Hz with a disc phase, and return the steps entered, in order. */
function run(s: Scheduler, seconds: number, discPhase: DiscPhase, entered: Step[] = []): Step[] {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    const c = s.update({ dt: 1 / 60, discPhase });
    if (c.entered) entered.push(c.entered);
  }
  return entered;
}

describe("the pick", () => {
  it("waits for a choice and does nothing meanwhile", () => {
    const s = new Scheduler();
    const c = s.update({ dt: 1, discPhase: "idle" });
    expect(c.step).toBe("idle");
    expect(c.interactive).toBe(true);
    expect(c.crank).toBe(false);
    expect(c.needle).toBe(false);
    expect(c.music).toBe(false);
    expect(c.spot).toBe("idle");
  });

  it("goes through every step in order when the disc behaves", () => {
    const s = new Scheduler();
    expect(s.choose(3)).toBe(true);
    const seen: Step[] = [];
    run(s, TO_CRATE + 0.1, "idle", seen);
    expect(s.step).toBe("fetch");
    run(s, 0.5, "picking", seen);
    expect(s.step).toBe("fetch");
    run(s, 0.1, "held", seen);
    expect(s.step).toBe("carry");
    run(s, CARRY + 0.1, "held", seen);
    expect(s.step).toBe("place");
    run(s, 0.4, "placing", seen);
    expect(s.step).toBe("place");
    run(s, 0.1, "seated", seen);
    expect(s.step).toBe("needle");
    run(s, NEEDLE + 0.1, "seated", seen);
    expect(s.step).toBe("back");
    run(s, BACK + 0.1, "seated", seen);
    expect(s.step).toBe("playing");
    expect(seen).toEqual(["toCrate", "fetch", "carry", "place", "needle", "back", "playing"]);
  });

  it("only counts a choice while the crate waits", () => {
    const s = new Scheduler();
    expect(s.choose(0)).toBe(true);
    expect(s.choose(1)).toBe(false);
    expect(s.update({ dt: 0.016, discPhase: "idle" }).choice).toBe(0);
  });

  it("gives the choice back for every step after the pick", () => {
    const s = new Scheduler();
    s.choose(5);
    expect(s.update({ dt: 0.016, discPhase: "idle" }).choice).toBe(5);
  });

  it("does not wait for ever for a disc that never arrives", () => {
    const s = new Scheduler();
    s.choose(0);
    run(s, TO_CRATE + GIVE_UP + 0.5, "picking");
    expect(s.step).not.toBe("fetch");
    run(s, CARRY + GIVE_UP + 0.5, "picking");
    expect(["needle", "back", "playing"]).toContain(s.step);
  });

  it("sets the disc's targets on the step edges, once each", () => {
    const s = new Scheduler();
    s.choose(2);
    const seen = run(s, TO_CRATE + 0.2, "idle");
    expect(seen).toEqual(["toCrate", "fetch"]);
    expect(run(s, 0.3, "idle")).toEqual([]);
  });
});

describe("the work while it plays", () => {
  function playing(): Scheduler {
    const s = new Scheduler();
    s.choose(0);
    run(s, TO_CRATE + 0.1, "idle");
    run(s, 0.1, "held");
    run(s, CARRY + 0.1, "held");
    run(s, 0.1, "seated");
    run(s, NEEDLE + BACK + 0.2, "seated");
    return s;
  }

  it("cranks from the moment the disc is placed and lowers the needle after it lands", () => {
    const s = new Scheduler();
    s.choose(0);
    run(s, TO_CRATE + 0.1, "idle");
    run(s, 0.1, "held");
    expect(s.update({ dt: 0.016, discPhase: "held" }).crank).toBe(false);
    run(s, CARRY + 0.05, "held");
    expect(s.step).toBe("place");
    expect(s.update({ dt: 0.016, discPhase: "placing" }).crank).toBe(true);
    expect(s.update({ dt: 0.016, discPhase: "placing" }).needle).toBe(false);
    run(s, 0.1, "seated");
    expect(s.update({ dt: 0.016, discPhase: "seated" }).needle).toBe(true);
  });

  it("wants the music from the needle on, and not before the disc is seated", () => {
    const s = new Scheduler();
    s.choose(0);
    run(s, TO_CRATE + 0.1, "idle");
    run(s, 0.1, "held");
    run(s, CARRY + 0.05, "held");
    expect(s.update({ dt: 0.016, discPhase: "placing" }).music).toBe(false);
    run(s, 0.1, "seated");
    const c = s.update({ dt: 0.016, discPhase: "seated" });
    expect(c.step).toBe("needle");
    expect(c.music).toBe(true);
    run(s, NEEDLE + 0.05, "seated");
    expect(s.step).toBe("back");
    expect(s.update({ dt: 0.016, discPhase: "seated" }).music).toBe(true);
  });

  it("wants the music only while it plays", () => {
    const s = playing();
    expect(s.step).toBe("playing");
    expect(s.update({ dt: 0.016, discPhase: "seated" }).music).toBe(true);
    s.trackEnded();
    const c = s.update({ dt: 0.016, discPhase: "seated" });
    expect(c.step).toBe("ended");
    expect(c.music).toBe(false);
    expect(c.needle).toBe(false);
    expect(c.crank).toBe(false);
  });

  it("takes a record off and puts it back for another", () => {
    const s = playing();
    expect(s.again()).toBe(true);
    let c = s.update({ dt: 0.016, discPhase: "seated" });
    expect(c.step).toBe("lift");
    expect(c.music).toBe(false);
    expect(c.needle).toBe(false);
    expect(c.crank).toBe(false);
    expect(c.spot).toBe("platter");
    run(s, LIFT + 0.1, "seated");
    expect(s.step).toBe("return");
    run(s, RETURN_AT + 0.1, "returning");
    expect(s.step).toBe("return");
    run(s, 0.1, "idle");
    c = s.update({ dt: 0.016, discPhase: "idle" });
    expect(c.step).toBe("idle");
    expect(c.interactive).toBe(true);
    expect(c.choice).toBeNull();
    // And a second song can be chosen.
    expect(s.choose(4)).toBe(true);
  });

  it("refuses 'another record' before there is a disc on the way to the platter", () => {
    const s = new Scheduler();
    expect(s.again()).toBe(false);
    s.choose(0);
    run(s, 0.1, "idle");
    expect(s.again()).toBe(false);
  });

  it("is reset to a crate that waits", () => {
    const s = playing();
    s.reset();
    const c = s.update({ dt: 0.016, discPhase: "idle" });
    expect(c.step).toBe("idle");
    expect(c.choice).toBeNull();
    expect(c.music).toBe(false);
    expect(c.crank).toBe(false);
  });
});

describe("where the left drone is", () => {
  it("goes to the crate, then the platter, then the needle, then home", () => {
    const s = new Scheduler();
    s.choose(0);
    const spots: string[] = [];
    const keep = (phase: DiscPhase, seconds: number) => {
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        const c = s.update({ dt: 1 / 60, discPhase: phase });
        if (spots[spots.length - 1] !== c.spot) spots.push(c.spot);
      }
    };
    keep("idle", TO_CRATE + 0.1);
    keep("held", 0.2);
    keep("held", CARRY + 0.1);
    keep("seated", 0.2);
    keep("seated", NEEDLE + BACK + 0.2);
    expect(spots).toEqual(["crate", "platter", "needle", "idle"]);
  });
});
