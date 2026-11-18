import { describe, expect, it } from "vitest";

import { moodAt } from "../../actors/doll/face/sequence";

import { FACES, faceSteps } from "./faces";
import { HAND_AT, HAND_SCREENS, LIST_AT } from "./timeline";

describe("carry faces", () => {
  it("starts resigned as the fall ends (J6), is scared, shocked then dizzy at the landing, smiles on the palm", () => {
    expect(moodAt(FACES, 0).a).toBe("gloom");
    expect(moodAt(FACES, 0.6).a).toBe("scared");
    expect(moodAt(FACES, HAND_AT.land + 0.04).b).toBe("shocked");
    expect(moodAt(FACES, HAND_AT.land + 0.2).b).toBe("dizzy");
    expect(moodAt(FACES, HAND_SCREENS - 0.8).b).toBe("smile");
  });

  it("grins during the toss, smiles on the frame, is determined at the end", () => {
    expect(moodAt(FACES, HAND_SCREENS + LIST_AT.toss[0] + 0.1).b).toBe("grin");
    expect(moodAt(FACES, HAND_SCREENS + LIST_AT.toss[1] + 0.5).b).toBe("smile");
    expect(moodAt(FACES, HAND_SCREENS + 8.6).b).toBe("determined");
  });

  it("turns 'this face by then' into holds that add up", () => {
    const steps = faceSteps([
      { face: "neutral", at: 0, blend: 0 },
      { face: "smile", at: 2, blend: 0.5 },
    ]);
    expect(steps[0]?.hold).toBeCloseTo(1.5, 6);
    expect(steps[1]?.blend).toBe(0.5);
  });
});
