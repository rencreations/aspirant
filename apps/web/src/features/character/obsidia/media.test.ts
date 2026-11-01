import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { voiceLines } from "@/content/voice.generated";

import { OBSIDIA_MUSIC, OBSIDIA_VOICE_COUNT, obsidiaVoicePath, pickTier, TRAILER } from "./media";
import { OBSIDIA_BYTES, OBSIDIA_TIERS } from "./timeline.generated";

const publicDir = join(process.cwd(), "public");
const onDisk = (path: string) => existsSync(join(publicDir, path));

describe("what her page loads", () => {
  it("lists every one of her voice lines, and each file exists", () => {
    expect(OBSIDIA_VOICE_COUNT).toBe(voiceLines.obsidia.length);
    for (let n = 1; n <= OBSIDIA_VOICE_COUNT; n++) expect(onDisk(obsidiaVoicePath(n))).toBe(true);
  });

  it("has her music, and the trailer in every size it offers with its poster", () => {
    expect(onDisk(OBSIDIA_MUSIC)).toBe(true);
    expect(onDisk(TRAILER.poster)).toBe(true);
    for (const s of TRAILER.sources) expect(onDisk(s.src), s.src).toBe(true);
  });

  it("has every video in every size, with its size for the loading bar", () => {
    for (const tier of Object.keys(OBSIDIA_TIERS) as Array<keyof typeof OBSIDIA_TIERS>) {
      for (const [file, bytes] of Object.entries(OBSIDIA_BYTES[tier])) {
        expect(bytes, `${tier}/${file}`).toBeGreaterThan(0);
        expect(onDisk(`/video/obsidia/${tier}/${file}`), `${tier}/${file}`).toBe(true);
      }
    }
    expect(onDisk("/video/obsidia/still.webp")).toBe(true);
  });
});

describe("the size of video for a display", () => {
  it("gives a 4K screen the 4K size, and smaller screens less", () => {
    // A 3840x2160 screen at 1x: the picture covers it and is 3840 px wide, as is the video.
    expect(pickTier({ width: 3840, height: 2160, dpr: 1 })).toBe("2160");
    // A laptop at 3840x2160 with 200 percent scaling shows 1920x1080 in CSS pixels, 4K in device pixels.
    expect(pickTier({ width: 1920, height: 1080, dpr: 2 })).toBe("2160");
    expect(pickTier({ width: 1920, height: 1080, dpr: 1 })).toBe("1440");
    // A 2560x1440 (2K) screen gets the 2560 picture, not the 4K one.
    expect(pickTier({ width: 2560, height: 1440, dpr: 1 })).toBe("1440");
    expect(pickTier({ width: 1366, height: 768, dpr: 1 })).toBe("1080");
  });

  it("never picks a smaller size because of the device or the connection", () => {
    // The old light size is not offered, even on a small screen.
    expect(pickTier({ width: 1024, height: 576, dpr: 1 })).toBe("1080");
    const hints = { saveData: true, memory: 1, touch: true, downlink: 0.5, effectiveType: "2g" };
    expect(pickTier({ width: 3840, height: 2160, dpr: 1, ...hints })).toBe("2160");
  });
});
