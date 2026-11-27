import { describe, expect, it } from "vitest";

import { CONTACT, DOLL_MOODS, GIVE, dollBeatAt, newDollBeat } from "./doll-beats";

const LAYERS = [
  "lift",
  "side",
  "yaw",
  "roll",
  "headRoll",
  "headNod",
  "headTurn",
  "gazeX",
  "gazeY",
  "flail",
  "sprint",
  "squash",
  "talk",
] as const;

describe("the doll in Selena's film", () => {
  it("still sits as she rode before she leaves the seat", () => {
    const b = dollBeatAt(GIVE - 0.01, 10, 1, 0.2);
    expect(b.poseA).toBe("ride");
    expect(b.poseB).toBe("ride");
    for (const k of LAYERS) expect(Math.abs(b[k])).toBeLessThan(1e-9);
  });

  it("is a smooth function of the scroll: no layer and no pose leaps between two near times", () => {
    let prev = { ...dollBeatAt(GIVE - 0.2, 10, 1, 0.2, newDollBeat()) };
    for (let t = GIVE - 0.2; t <= CONTACT + 0.8; t += 0.002) {
      const b = { ...dollBeatAt(t, 10, 1, 0.2, newDollBeat()) };
      for (const k of LAYERS) expect(Math.abs(b[k] - prev[k])).toBeLessThan(0.05);
      if (b.poseA !== prev.poseA || b.poseB !== prev.poseB) {
        // Where the pair of poses changes, the pose shown is the same on both sides.
        const was = prev.poseW > 0.5 ? prev.poseB : prev.poseA;
        const now = b.poseW > 0.5 ? b.poseB : b.poseA;
        expect(now).toBe(was);
        expect(Math.min(prev.poseW, 1 - prev.poseW) + Math.min(b.poseW, 1 - b.poseW)).toBeLessThan(
          0.1,
        );
      }
      prev = b;
    }
  });

  it("is confused, then frightened, then panics, and screams on into the jaws", () => {
    const faces = DOLL_MOODS.map((s) => s.face);
    expect(faces.indexOf("confused")).toBeLessThan(faces.indexOf("shocked"));
    expect(faces.indexOf("shocked")).toBeLessThan(faces.indexOf("scared"));
    expect(faces.indexOf("scared")).toBeLessThan(faces.indexOf("panic"));
    expect(faces).toContain("scream");
    const total = DOLL_MOODS.reduce((s, m, i) => s + m.hold + (i > 0 ? (m.blend ?? 0.12) : 0), 0);
    expect(GIVE + total).toBeGreaterThan(CONTACT + 0.5);
  });
});
