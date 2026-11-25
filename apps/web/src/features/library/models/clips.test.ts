import { AnimationClip, Object3D, VectorKeyframeTrack } from "three";
import { describe, expect, it } from "vitest";

import { ClipPlayer } from "./clips";

/** A root with one child that a clip moves along x, from `from` to `to` over a second. */
function rig(from: number, to: number) {
  const root = new Object3D();
  const box = new Object3D();
  box.name = "box";
  root.add(box);
  const track = (a: number, b: number) =>
    new VectorKeyframeTrack("box.position", [0, 0.5, 1], [a, 0, 0, (a + b) / 2, 0, 0, b, 0, 0]);
  const open = new AnimationClip("open", 1, [track(from, to)]);
  const loop = new AnimationClip("loop", 1, [track(0, 0)]);
  return { root, box, clips: [open, loop] };
}

describe("the clip player of the room", () => {
  it("plays a pick and lists its keys", () => {
    const { root, clips } = rig(0, 1);
    const p = new ClipPlayer(root, clips);
    expect(p.play("open", { fade: 0 })).toBe(true);
    expect(p.current).toBe("open");
    expect(p.factsOf("open")?.keys).toEqual([0, 0.5, 1]);
    expect(p.play("nope")).toBe(false);
  });

  it("seeks and steps by keys, and stepping pauses", () => {
    const { root, box, clips } = rig(0, 1);
    const p = new ClipPlayer(root, clips);
    p.play("open", { fade: 0 });
    p.seek(0.5);
    expect(box.position.x).toBeCloseTo(0.5, 5);
    p.step(1);
    expect(p.playing).toBe(false);
    expect(p.time).toBeCloseTo(1, 5);
    p.step(-1);
    expect(p.time).toBeCloseTo(0.5, 5);
  });

  it("blends over the seam of a clip that does not end where it starts, so it never jumps", () => {
    const { root, box, clips } = rig(0, 1);
    const p = new ClipPlayer(root, clips);
    p.play("open", { fade: 0 });
    let last = box.position.x;
    let worst = 0;
    for (let i = 0; i < 180; i += 1) {
      p.update(1 / 60);
      worst = Math.max(worst, Math.abs(box.position.x - last));
      last = box.position.x;
    }
    // A plain loop would jump by 1 at the seam; a blended one moves a little each frame.
    expect(worst).toBeLessThan(0.2);
    expect(p.current).toBe("open");
  });

  it("holds the last pose of a clip played once", () => {
    const { root, box, clips } = rig(0, 1);
    const p = new ClipPlayer(root, clips);
    p.play("open", { fade: 0, loop: false });
    for (let i = 0; i < 90; i += 1) p.update(1 / 60);
    expect(p.finished).toBe(true);
    expect(box.position.x).toBeCloseTo(1, 5);
  });
});
