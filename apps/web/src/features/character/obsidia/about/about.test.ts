import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { entities } from "@/content/entities";

import { FORM_NAMES, FORMS } from "../media";

import { ABOUT_IMAGES } from "./about-images";
import { entityIds } from "./inline-text";
import { DISLIKES, LIKES, PROFILE_FACTS, PROFILE_VOICES, SUMMARY, TIES } from "./profile-data";
import { STORY } from "./story-data";
import { OBSIDIA_VOICE_NUMBERS } from "./voice-card";

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
  ...LIKES,
  ...DISLIKES,
  ...TIES.flatMap((t) => [t.name, t.relation, t.text]),
];

describe("Obsidia's story", () => {
  it("has unique sections that each say where to read them", () => {
    expect(new Set(STORY.map((s) => s.id)).size).toBe(STORY.length);
    expect(STORY.length).toBeGreaterThanOrEqual(18);
    for (const s of STORY) {
      expect(s.blocks.length).toBeGreaterThan(1);
      // Every section points at its chapters, except the words she has for the world, which are
      // tied to no scene.
      if (s.id !== "world") expect(s.chapters.length).toBeGreaterThan(0);
    }
  });

  it("points every tooltip at a glossary entry", () => {
    const texts = [...storyText(), ...profileText()];
    for (const t of texts) for (const id of entityIds(t)) expect(ids.has(id), id).toBe(true);
  });

  it("uses only voice lines that exist, each once, and uses all of them", () => {
    const used = STORY.flatMap((s) => s.blocks.flatMap((b) => (b.type === "voice" ? [b.n] : [])));
    for (const n of [...used, ...PROFILE_VOICES.map((v) => v.n)])
      expect(OBSIDIA_VOICE_NUMBERS.has(n), `line ${n}`).toBe(true);
    expect(new Set(used).size).toBe(used.length);
    expect(used.length).toBeGreaterThanOrEqual(30);
  });

  it("uses only pictures that exist, are in the loading list and are used", () => {
    const used = new Set(
      STORY.flatMap((s) => s.blocks.flatMap((b) => (b.type === "image" ? [b.name] : []))),
    );
    for (const name of used) expect(ABOUT_IMAGES).toContain(name);
    for (const name of ABOUT_IMAGES) {
      expect(existsSync(join(publicDir, "img", "obsidia", `${name}.webp`)), name).toBe(true);
      if (name !== "profile") expect(used.has(name), name).toBe(true);
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

describe("Her two forms", () => {
  it("has a photo and a silent clip for each, in the folders the script writes", () => {
    for (const f of FORM_NAMES) {
      expect(existsSync(join(publicDir, FORMS[f].poster)), FORMS[f].poster).toBe(true);
      expect(existsSync(join(publicDir, FORMS[f].src)), FORMS[f].src).toBe(true);
    }
  });
});
