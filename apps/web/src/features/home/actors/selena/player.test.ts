import { describe, expect, it } from "vitest";

import { ClipPlayer, type ClipTable } from "./player";

const TABLE: ClipTable = {
  city_idle: { duration: 2.708333, loop: true },
  city_interaction_R_loop: { duration: 2.708333, loop: true },
  city_interaction_back_R: { duration: 3.208333, loop: false },
  city_interaction_R: { duration: 3.291667, loop: false },
  city_intercation02: { duration: 5.958333, loop: false },
  city_intercation03: { duration: 6.291667, loop: false },
};

function run(p: ClipPlayer, seconds: number, dt = 1 / 60): void {
  for (let t = 0; t < seconds; t += dt) p.step(dt);
}

describe("ClipPlayer", () => {
  it("starts in the idle loop and wraps without a seam", () => {
    const p = new ClipPlayer(TABLE);
    run(p, 2.6);
    expect(p.pose.a).toBe("city_idle");
    expect(p.pose.b).toBeNull();
    const before = p.pose.ta;
    expect(before).toBeGreaterThan(2.5);
    run(p, 0.2);
    expect(p.pose.ta).toBeLessThan(before);
    expect(p.pose.ta).toBeLessThan(0.2);
  });

  it("holds a one shot clip on its last key and says it ended", () => {
    const p = new ClipPlayer(TABLE);
    p.play("city_interaction_back_R", { fade: 0 });
    run(p, 4);
    expect(p.pose.ta).toBeCloseTo(3.208333, 5);
    expect(p.hasEnded()).toBe(true);
  });

  it("is a no-op when asked for what already plays, every frame", () => {
    const p = new ClipPlayer(TABLE);
    p.play("city_interaction_R_loop", { loop: true });
    run(p, 0.5);
    const t = p.time();
    for (let i = 0; i < 20; i += 1) {
      p.play("city_interaction_R_loop", { loop: true });
      p.step(1 / 60);
    }
    expect(p.time()).toBeCloseTo(t + 20 / 60, 5);
    expect(p.pose.b).toBeNull();
  });

  it("cross fades between two clips with a weight that rises from 0 to 1", () => {
    const p = new ClipPlayer(TABLE);
    p.play("city_interaction_R_loop", { fade: 0.2 });
    expect(p.pose.b).toBe("city_interaction_R_loop");
    const ws: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      p.step(1 / 60);
      if (p.pose.b) ws.push(p.pose.w);
    }
    expect(ws[0]).toBeGreaterThan(0);
    for (let i = 1; i < ws.length; i += 1) expect(ws[i]).toBeGreaterThanOrEqual(ws[i - 1]!);
    expect(ws[ws.length - 1]).toBeLessThanOrEqual(1);
    run(p, 0.3);
    expect(p.pose.b).toBeNull();
    expect(p.pose.a).toBe("city_interaction_R_loop");
  });

  it("waits for the loop to come round, then plays the way out and ends in the idle loop", () => {
    const p = new ClipPlayer(TABLE);
    p.play("city_interaction_R_loop", { fade: 0 });
    run(p, 1);
    p.play("city_interaction_back_R", {
      when: "loopEnd",
      loop: false,
      then: [{ clip: "city_idle", loop: true }],
    });
    expect(p.target()).toBe("city_idle");
    run(p, 1.0);
    // Still the hands loop: the loop has not come round yet.
    expect(p.current()).toBe("city_interaction_R_loop");
    run(p, 1);
    expect(p.current()).toBe("city_interaction_back_R");
    // Asking again, every frame, changes nothing.
    for (let i = 0; i < 10; i += 1) {
      p.play("city_interaction_back_R", {
        when: "loopEnd",
        loop: false,
        then: [{ clip: "city_idle", loop: true }],
      });
      p.step(1 / 60);
    }
    expect(p.current()).toBe("city_interaction_back_R");
    run(p, 3.3);
    expect(p.current()).toBe("city_idle");
    expect(p.target()).toBe("city_idle");
    run(p, 10);
    expect(p.current()).toBe("city_idle");
  });

  it("a scrub is pure and a play after it fades out of the scrubbed pose", () => {
    const p = new ClipPlayer(TABLE);
    p.scrub("city_intercation03", 2.4);
    p.step(1);
    expect(p.pose.ta).toBe(2.4);
    expect(p.playing()).toBe(false);
    p.scrub("city_intercation03", 99, "city_idle", 1, 0.5);
    expect(p.pose.ta).toBeCloseTo(6.291667, 5);
    expect(p.pose.b).toBe("city_idle");
    expect(p.pose.w).toBe(0.5);
    p.play("city_idle", { loop: true });
    expect(p.playing()).toBe(true);
    expect(p.pose.a).toBe("city_intercation03");
    expect(p.pose.b).toBe("city_idle");
    run(p, 0.5);
    expect(p.pose.a).toBe("city_idle");
    expect(p.pose.b).toBeNull();
  });

  it("a step of zero (a frozen frame) changes nothing", () => {
    const p = new ClipPlayer(TABLE);
    run(p, 0.4);
    const t = p.time();
    p.step(0);
    expect(p.time()).toBe(t);
  });

  it("an immediate play cancels a request that waits for the loop end", () => {
    const p = new ClipPlayer(TABLE);
    p.play("city_interaction_back_R", { when: "loopEnd", loop: false });
    expect(p.target()).toBe("city_interaction_back_R");
    p.play("city_idle", { loop: true });
    expect(p.target()).toBe("city_idle");
    run(p, 3);
    expect(p.current()).toBe("city_idle");
  });
});
