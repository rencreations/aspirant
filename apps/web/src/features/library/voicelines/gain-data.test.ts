import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHARACTER_SLUGS } from "@/lib/slugs";
import { VOICE_BUS_GAIN, dbToLinear } from "@/lib/voice-gain";

import { lineStem } from "./model";
import type { VoiceCharacterFile } from "./types";

const DATA = path.resolve(import.meta.dirname, "../../../../public/data/library");
const LOUDNESS = path.resolve(
  import.meta.dirname,
  "../../../../../../scripts/library/voicelines/loudness.json",
);

/** What `scripts/library/voicelines/loudness.py` measured: key -> integrated LUFS and true peak. */
const loud = JSON.parse(fs.readFileSync(LOUDNESS, "utf8")) as Record<
  string,
  { i: number; tp: number }
>;

const TARGET_LUFS = -18;
const CEIL_DBTP = -1;
const BUS_DB = 20 * Math.log10(VOICE_BUS_GAIN);

/** The formula of `loudness.py` (`gain_db`), written again here so that the data and the player agree. */
function expectedGain(key: string, bus: number): number {
  const m = loud[key];
  if (!m) throw new Error(`no loudness for ${key}`);
  return Math.round(Math.min(TARGET_LUFS - m.i - bus, CEIL_DBTP - m.tp - bus) * 10) / 10;
}

function file(slug: string): VoiceCharacterFile {
  return JSON.parse(
    fs.readFileSync(path.join(DATA, `voicelines-${slug}.json`), "utf8"),
  ) as VoiceCharacterFile;
}

describe("the baked gain of the voice lines", () => {
  it("is on every line that has a recording, and on no line that has none", () => {
    for (const slug of CHARACTER_SLUGS) {
      const data = file(slug);
      for (const [lang, lines] of Object.entries(data.langs)) {
        for (const line of lines) {
          if (line.d === undefined) expect(line.g, `${slug} ${lang} ${line.n}`).toBeUndefined();
          else expect(Number.isFinite(line.g), `${slug} ${lang} ${line.n}`).toBe(true);
        }
      }
    }
  });

  it("is the one the formula gives for the measured loudness (target -18 LUFS, ceiling -1 dBTP, the voice bus)", () => {
    let checked = 0;
    for (const slug of CHARACTER_SLUGS) {
      const data = file(slug);
      for (const [lang, lines] of Object.entries(data.langs)) {
        for (const line of lines) {
          if (line.d === undefined) continue;
          const key = `${lineStem(slug, lang as keyof typeof data.langs, line.n)}.m4a`;
          expect(line.g, key).toBe(expectedGain(key, BUS_DB));
          checked++;
        }
      }
      for (const clip of data.trailer ?? []) {
        expect(clip.g, clip.m4a).toBe(expectedGain(clip.m4a, BUS_DB));
        checked++;
      }
      // A recording plays through the music bus, which has no lift.
      expect(data.full.g, data.full.m4a).toBe(expectedGain(data.full.m4a, 0));
      checked++;
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it("stays inside the range the player accepts, so that it is never clamped", () => {
    for (const slug of CHARACTER_SLUGS) {
      const data = file(slug);
      const all = [...Object.values(data.langs).flat(), ...(data.trailer ?? []), data.full].flatMap(
        (r) => (r.g === undefined ? [] : [r.g]),
      );
      for (const g of all) expect(dbToLinear(g)).toBeCloseTo(10 ** (g / 20), 10);
    }
  });

  it("brings every line to one level at the master: the spread of the levelled clips is under 0.7 LU", () => {
    const levels: number[] = [];
    for (const slug of CHARACTER_SLUGS) {
      const data = file(slug);
      for (const [lang, lines] of Object.entries(data.langs)) {
        for (const line of lines) {
          if (line.d === undefined || line.g === undefined) continue;
          const key = `${lineStem(slug, lang as keyof typeof data.langs, line.n)}.m4a`;
          const m = loud[key];
          if (m) levels.push(m.i + line.g + BUS_DB);
        }
      }
    }
    expect(levels.length).toBeGreaterThan(3000);
    // Without the gain the same lines span 33 LU.
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(0.7);
  });
});
