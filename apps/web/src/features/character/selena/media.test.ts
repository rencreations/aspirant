import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { voiceLines } from "@/content/voice.generated";

import {
  limitTier,
  MENU_ICON,
  pickTier,
  SELENA_VOICE_COUNT,
  selenaVoicePath,
  TRAILER,
} from "./media";
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

describe("the size of video a device can play", () => {
  it("keeps the size that suits the display when the device decodes it smoothly", async () => {
    expect(await limitTier("2160", () => Promise.resolve(true))).toBe("2160");
    expect(await limitTier("1440", () => Promise.resolve(true))).toBe("1440");
  });

  it("steps down one size at a time from a size the device cannot decode smoothly", async () => {
    const asked: string[] = [];
    const tier = await limitTier("2160", (t) => {
      asked.push(t);
      return Promise.resolve(t !== "2160");
    });
    expect(tier).toBe("1440");
    expect(asked).toEqual(["2160", "1440"]);
  });

  it("falls back to the smallest size and never asks about it", async () => {
    const asked: string[] = [];
    const tier = await limitTier("2160", (t) => {
      asked.push(t);
      return Promise.resolve(false);
    });
    expect(tier).toBe("1080");
    expect(asked).toEqual(["2160", "1440"]);
    expect(await limitTier("1080", () => Promise.resolve(false))).toBe("1080");
  });
});

describe("the size that suits a display", () => {
  it("matches the width of the picture in device pixels", () => {
    // The picture covers the screen: a 1920x1080 window at 1x needs about 2400 px of video.
    expect(pickTier({ width: 1920, height: 1080, dpr: 1 })).toBe("1440");
    expect(pickTier({ width: 1920, height: 1080, dpr: 2 })).toBe("2160");
    expect(pickTier({ width: 1280, height: 720, dpr: 1 })).toBe("1080");
  });

  it("stops at 1440 on touch devices, and goes smallest on low memory or data saving", () => {
    expect(pickTier({ width: 1920, height: 1080, dpr: 2, touch: true })).toBe("1440");
    expect(pickTier({ width: 1920, height: 1080, dpr: 2, touch: true, memory: 4 })).toBe("1080");
    expect(pickTier({ width: 2560, height: 1440, dpr: 2, saveData: true })).toBe("1080");
    expect(pickTier({ width: 2560, height: 1440, dpr: 2, memory: 2 })).toBe("1080");
  });
});
