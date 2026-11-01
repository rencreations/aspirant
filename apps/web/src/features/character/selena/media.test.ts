import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { voiceLines } from "@/content/voice.generated";

import { MENU_ICON, pickTier, SELENA_VOICE_COUNT, selenaVoicePath, TRAILER } from "./media";
import { SKILL_CLIPS } from "./skills/clips.generated";
import { skillClipPath, skillSmallPath } from "./skills/skills-media";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));

describe("what her page loads", () => {
  it("lists every one of her voice lines, and each file exists", () => {
    expect(SELENA_VOICE_COUNT).toBe(voiceLines.selena.length);
    for (let n = 1; n <= SELENA_VOICE_COUNT; n++) expect(onDisk(selenaVoicePath(n))).toBe(true);
  });

  it("has her pictures for the three buttons", () => {
    for (const path of Object.values(MENU_ICON)) expect(onDisk(path), path).toBe(true);
  });

  it("has the trailer in every size it offers, and its poster", () => {
    expect(onDisk(TRAILER.poster)).toBe(true);
    for (const s of TRAILER.sources) expect(onDisk(s.src), s.src).toBe(true);
  });

  it("has the full clip and the small loop of every skill clip, with their sizes", () => {
    for (const id of Object.keys(SKILL_CLIPS) as Array<keyof typeof SKILL_CLIPS>) {
      expect(onDisk(skillClipPath(id)), id).toBe(true);
      expect(onDisk(skillSmallPath(id)), `${id} small`).toBe(true);
      expect(SKILL_CLIPS[id].smallBytes).toBeGreaterThan(0);
    }
  });
});

describe("the size of video for a display", () => {
  it("matches the width of the picture in device pixels", () => {
    // The picture covers the screen: a 1920x1080 window at 1x needs about 2400 px of video.
    expect(pickTier({ width: 1920, height: 1080, dpr: 1 })).toBe("1440");
    // A 2560x1440 (2K) screen gets the 2560 picture, not the 4K one.
    expect(pickTier({ width: 2560, height: 1440, dpr: 1 })).toBe("1440");
    // A full HD window with 125 percent scaling also stays at 2560.
    expect(pickTier({ width: 1920, height: 1080, dpr: 1.25 })).toBe("1440");
    // A sharp screen (4K, or full HD at 200 percent) gets the 4K picture.
    expect(pickTier({ width: 1920, height: 1080, dpr: 2 })).toBe("2160");
    expect(pickTier({ width: 3840, height: 2160, dpr: 1 })).toBe("2160");
    expect(pickTier({ width: 1366, height: 768, dpr: 1 })).toBe("1080");
    expect(pickTier({ width: 1280, height: 720, dpr: 1 })).toBe("1080");
  });

  it("never picks a smaller size because of the device or the connection", () => {
    // The old light size is not offered, even on a small screen.
    expect(pickTier({ width: 1024, height: 576, dpr: 1 })).toBe("1080");
    expect(pickTier({ width: 390, height: 844, dpr: 3 })).not.toBe("lite");
    // Whatever the browser says about memory, touch, data saving or the link, the size follows the display.
    const hints = { saveData: true, memory: 1, touch: true, downlink: 0.5, effectiveType: "2g" };
    expect(pickTier({ width: 3840, height: 2160, dpr: 1, ...hints })).toBe("2160");
  });
});
