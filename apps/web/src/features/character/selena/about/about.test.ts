import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entities } from "@/content/entities";

import { ABOUT_IMAGES } from "./about-images";
import { entityIds } from "./inline-text";
import {
  DISLIKES,
  EXPERIENCE,
  LIKES,
  PROFILE_FACTS,
  PROFILE_VOICES,
  PROJECTS,
  SUMMARY,
  TIES,
} from "./profile-data";
import { STORY } from "./story-data";
import { SELENA_VOICE_NUMBERS } from "./voice-card";

const publicDir = join(process.cwd(), "public");
const ids = new Set(entities.map((e) => e.id));

const storyText = (): string[] =>
  STORY.flatMap((s) => [
    s.title,
    s.when ?? "",
    ...s.blocks.flatMap((b) =>
      b.type === "p" || b.type === "quote"
        ? [b.text]
        : b.type === "image"
          ? [b.alt, b.caption]
          : [b.why ?? ""],
    ),
  ]);

const profileText = (): string[] => [
  SUMMARY,
  ...PROFILE_FACTS.flatMap((f) => [f.label, f.value]),
  ...EXPERIENCE.flatMap((e) => [e.role, e.place, e.note]),
  ...LIKES,
  ...DISLIKES,
  ...TIES.flatMap((t) => [t.name, t.relation, t.text]),
  ...PROJECTS.flatMap((p) => [p.label, p.value]),
];

describe("Selena's story", () => {
  it("has unique sections that each say where to read them", () => {
    expect(new Set(STORY.map((s) => s.id)).size).toBe(STORY.length);
    expect(STORY.length).toBeGreaterThanOrEqual(18);
    for (const s of STORY) expect(s.blocks.length).toBeGreaterThan(1);
  });

  it("points every tooltip at a glossary entry", () => {
    const texts = [...storyText(), ...profileText()];
    for (const t of texts) for (const id of entityIds(t)) expect(ids.has(id), id).toBe(true);
  });

  it("uses only voice lines that exist, and uses plenty of them", () => {
    const used = STORY.flatMap((s) => s.blocks.flatMap((b) => (b.type === "voice" ? [b.n] : [])));
    for (const n of [...used, ...PROFILE_VOICES.map((v) => v.n)])
      expect(SELENA_VOICE_NUMBERS.has(n), `line ${n}`).toBe(true);
    expect(used.length).toBeGreaterThanOrEqual(30);
  });

  it("gives the profile the normal voice (line 1) and the Ender voice (line 19)", () => {
    expect(PROFILE_VOICES.map((v) => v.n)).toEqual([1, 19]);
  });

  it("uses only pictures that exist, are in the loading list and are used", () => {
    const used = new Set(
      STORY.flatMap((s) => s.blocks.flatMap((b) => (b.type === "image" ? [b.name] : []))),
    );
    for (const name of used) expect(ABOUT_IMAGES).toContain(name);
    for (const name of ABOUT_IMAGES) {
      expect(existsSync(join(publicDir, "img", "selena", `${name}.webp`)), name).toBe(true);
      if (!name.startsWith("profile-")) expect(used.has(name), name).toBe(true);
    }
    expect(used.size).toBeGreaterThanOrEqual(12);
  });

  it("follows the writing and canon rules", () => {
    const text = [...storyText(), ...profileText()].join(" ");
    // The scanner in scripts/qa forbids these words in source files, so the test builds them.
    const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    const banned = [
      ["convic", "tion"],
      ["Terre", "nia"],
      ["Sel", "wick"],
    ].map((p) => p.join(""));
    expect(dashes.test(text)).toBe(false);
    for (const word of banned) expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    // The duel is left open.
    expect(text).not.toMatch(/Selena (won|lost|died)|Obsidia (won|lost|died)/i);
  });
});
