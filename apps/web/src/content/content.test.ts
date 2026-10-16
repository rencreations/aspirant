import fs from "node:fs";
import path from "node:path";

import {
  characters,
  findCharacter,
  getCharacter,
  keyVoiceLines,
  nextCharacter,
  pairOf,
  partnerOf,
  previousCharacter,
} from "./characters";
import { entities, getEntity } from "./entities";
import { pairs } from "./pairs";
import { siteCopy } from "./site-copy";
import {
  chapterForParagraph,
  chapters,
  getChapterMeta,
  partFileFor,
  parts,
  storyIndex,
} from "./story";
import type { Block, PartFile, Segment, StoryIndex } from "./story-types";
import { SLUGS, type Slug } from "./types";
import { voiceLines } from "./voice.generated";
import * as world from "./world";

const STORY_DIR = path.resolve(__dirname, "../../public/data/story") + path.sep;

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(STORY_DIR + file, "utf8")) as T;
}

const index = readJson<StoryIndex>("index.json");
const partFiles = index.parts.map((part) =>
  readJson<PartFile>(part.file.replace("data/story/", "")),
);
const storyChapters = partFiles.flatMap((file) => file.chapters);

function segmentsOf(block: Block): readonly Segment[] {
  if (block.type === "p") return block.segments;
  if (block.type === "poem") return block.lines.flat();
  return [];
}

function chapterText(id: string): string {
  const chapter = storyChapters.find((candidate) => candidate.id === id);
  if (!chapter) return "";
  const body = chapter.blocks
    .map((block) =>
      block.type === "poem"
        ? block.lines.map((line) => line.map((segment) => segment.text).join("")).join(" ")
        : segmentsOf(block)
            .map((segment) => segment.text)
            .join(""),
    )
    .filter(Boolean)
    .join(" ");
  return [chapter.timeNote ?? "", body].join(" ");
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

// Built from code points so this file passes the text scan.
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`, "u");
const BANNED = new RegExp(
  [
    ["con", "viction"].join(""),
    ["Ter", "enia"].join(""),
    ["Ter", "inia"].join(""),
    ["Terr", "enia"].join(""),
    ["Sei", "resk"].join(""),
    ["Windstorm", " Nest"].join(""),
  ].join("|"),
  "iu",
);

const knownChapterIds = new Set<string>(chapters.map((chapter) => chapter.id));

describe("characters", () => {
  it("has the ten in queue order", () => {
    expect(characters.map((character) => character.slug)).toEqual([
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ]);
    expect(characters.map((character) => character.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("has unique slugs that match SLUGS", () => {
    const slugs = characters.map((character) => character.slug);
    expect(new Set(slugs).size).toBe(10);
    expect(slugs).toEqual([...SLUGS]);
  });

  it("loops the queue in both directions", () => {
    expect(nextCharacter("fanny").slug).toBe("layla");
    expect(nextCharacter("obsidia").slug).toBe("selena");
    expect(nextCharacter("selena").slug).toBe("fanny");
    expect(previousCharacter("fanny").slug).toBe("selena");
    let slug: Slug = SLUGS[0];
    for (let step = 0; step < 10; step += 1) slug = nextCharacter(slug).slug;
    expect(slug).toBe(SLUGS[0]);
  });

  it("finds characters by route param", () => {
    expect(findCharacter("vexana")?.name).toBe("Vexana");
    expect(findCharacter("joker")).toBeUndefined();
    expect(getCharacter("change").name).toBe("Chang'e");
  });

  it("follows the canon facts", () => {
    const facts = Object.fromEntries(
      characters.map((c) => [c.slug, [c.aspirantName, c.ageText, c.birthday, c.mbti, c.jp.script]]),
    );
    expect(facts).toEqual({
      fanny: ["Blade of Kibou", "17", "June 11", "ESTJ", "ファニー"],
      layla: ["Miss Hikari", "16", "November 29", "ENTJ", "ライラ"],
      ruby: ["Mecha Maiden", "15 to 19", "June 12", "ESFP", "ルビー"],
      angela: ["Cyber Cherubin", "No human age (android)", "March 13", "INFP", "アンジェラ"],
      lesley: ["Deadeye Spectre", "20", "September 10", "ISTJ", "ラズリー"],
      change: ["Tech Tensai", "Not specified", "January 23", "ENTP", "嫦娥"],
      guinevere: ["Daybreak Halo", "16", "February 28", "ENFP", "グィネヴィア"],
      vexana: ["Twilight Star", "15 to 17", "March 10", "INFJ", "サナ"],
      obsidia: ["Imperatrix Arashi", "No human age (Ender)", "November 13", "INTJ", "アイーダ"],
      selena: ["Silverbolt Raiko", "19", "June 18", "ENTP", "セリナ"],
    });
    expect(getCharacter("change").jp.romaji).toBeNull();
    expect(getCharacter("change").ageNote).toBeTruthy();
  });

  it("pairs partners both ways, and Obsidia and Selena have none", () => {
    for (const character of characters) {
      const partner = partnerOf(character.slug);
      if (partner) expect(partner.partnerSlug).toBe(character.slug);
      expect(pairOf(character.slug).members).toContain(character.slug);
    }
    expect(partnerOf("obsidia")).toBeNull();
    expect(partnerOf("selena")).toBeNull();
    expect(pairs).toHaveLength(5);
  });

  it("gives forms to the three with an Ender form", () => {
    const withForms = characters
      .filter((character) => character.forms)
      .map((character) => character.slug);
    expect(withForms.sort()).toEqual(["obsidia", "selena", "vexana"]);
  });

  it("keeps Roger and Professor Joe out of relationships", () => {
    for (const character of characters) {
      for (const relation of character.sections.relationships) {
        expect(relation.name).not.toMatch(/Roger|Joe/u);
        expect(relation.entityId).not.toBe("roger");
      }
    }
  });

  it("uses hex palettes and short taglines", () => {
    for (const character of characters) {
      for (const colour of Object.values(character.palette))
        expect(colour).toMatch(/^#[0-9A-F]{6}$/u);
      expect(character.tagline.split(/\s+/u).length).toBeLessThanOrEqual(10);
    }
  });

  it("points inStory and later facts at real chapters", () => {
    for (const character of characters) {
      expect(character.inStory.chapterIds.length).toBeGreaterThan(0);
      for (const id of character.inStory.chapterIds) expect(knownChapterIds.has(id)).toBe(true);
      for (const fact of character.laterInStory)
        expect(knownChapterIds.has(fact.chapterId)).toBe(true);
    }
  });
});

describe("voice lines", () => {
  it("gives every character at least 20 lines with English text", () => {
    for (const character of characters) {
      expect(character.voice.length).toBeGreaterThanOrEqual(20);
      character.voice.forEach((line, i) => {
        expect(line.n).toBe(i + 1);
        expect(line.en.trim().length).toBeGreaterThan(0);
        expect(line.jpTitle.trim().length).toBeGreaterThan(0);
        expect(line.file).toBe(
          `audio/voice/${character.slug}/${String(line.n).padStart(2, "0")}.m4a`,
        );
      });
    }
  });

  it("addresses Lesley 36 and 37 to Chang'e", () => {
    const lesley = voiceLines.lesley;
    for (const n of [36, 37]) {
      const line = lesley.find((candidate) => candidate.n === n);
      expect(line?.en).toContain("Chang'e");
      expect(line?.jpTitle).toContain("嫦娥");
      expect(line?.en).not.toMatch(/Joker/u);
    }
  });

  it("has key quotes that exist", () => {
    for (const character of characters) {
      expect(keyVoiceLines(character.slug)).toHaveLength(character.keyQuotes.length);
    }
  });
});

describe("entities", () => {
  it("has unique ids and unique aliases", () => {
    const ids = entities.map((entity) => entity.id);
    expect(new Set(ids).size).toBe(ids.length);
    const aliases = entities.flatMap((entity) => entity.aliases);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("keeps each short line within 160 characters", () => {
    for (const entity of entities) expect(entity.short.length, entity.id).toBeLessThanOrEqual(160);
  });

  it("covers all ten Aspirants", () => {
    for (const slug of SLUGS) {
      expect(entities.some((entity) => entity.characterSlug === slug && entity.id === slug)).toBe(
        true,
      );
    }
  });

  it("matches firstChapter to the first annotation in the story", () => {
    const first = new Map<string, string>();
    for (const chapter of storyChapters) {
      for (const block of chapter.blocks) {
        for (const segment of segmentsOf(block)) {
          if (segment.t === "ent" && !first.has(segment.id)) first.set(segment.id, chapter.id);
        }
      }
    }
    for (const entity of entities) {
      expect(first.get(entity.id), entity.id).toBe(entity.firstChapter);
    }
  });

  it("annotates only known entities, and never inside a heading", () => {
    for (const chapter of storyChapters) {
      for (const block of chapter.blocks) {
        for (const segment of segmentsOf(block)) {
          if (segment.t === "ent") expect(getEntity(segment.id), segment.id).toBeDefined();
        }
      }
      expect(typeof chapter.title).toBe("string");
    }
  });
});

describe("story JSON", () => {
  it("has 12 parts and 60 numbered chapters, plus two interludes", () => {
    expect(index.parts).toHaveLength(12);
    const numbered = index.chapters.filter((chapter) => chapter.kind === "chapter");
    expect(numbered.map((chapter) => chapter.number)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 1),
    );
    expect(numbered.map((chapter) => chapter.id)).toEqual(
      Array.from({ length: 60 }, (_, i) => `c${String(i + 1).padStart(2, "0")}`),
    );
    expect(
      index.chapters.filter((chapter) => chapter.kind === "interlude").map((c) => c.id),
    ).toEqual(["i-far-above-1", "i-far-above-2"]);
    expect(index.stats.chapters).toBe(60);
  });

  it("gives every chapter at least one paragraph", () => {
    expect(storyChapters).toHaveLength(62);
    for (const chapter of storyChapters) {
      expect(
        chapter.blocks.filter((block) => block.type === "p").length,
        chapter.id,
      ).toBeGreaterThan(0);
    }
  });

  it("numbers paragraphs globally without gaps", () => {
    let expected = 0;
    for (const chapter of storyChapters) {
      expect(chapter.firstParagraphIndex).toBe(expected);
      for (const block of chapter.blocks) {
        if (block.type === "scene-break") continue;
        expect(block.i).toBe(expected);
        expected += 1;
      }
    }
    expect(expected).toBe(index.stats.paragraphs);
    expect(chapterForParagraph(0)?.id).toBe("c01");
  });

  it("keeps each part file in step with the index", () => {
    partFiles.forEach((file, i) => {
      expect(file.part).toEqual(index.parts[i]);
      expect(file.chapters.map((chapter) => chapter.id)).toEqual(file.part.chapterIds);
    });
    expect(partFileFor("c47")).toBe("data/story/part-10.json");
  });

  it("matches the generated index module", () => {
    const { beforeYouBegin: _front, ...lite } = index;
    expect(storyIndex).toEqual(lite);
    expect(parts).toHaveLength(12);
    expect(getChapterMeta("c01")?.title).toBe("The Student Who Was Always First");
  });

  it("keeps the three open questions and a valid time order", () => {
    expect(index.backMatter.openQuestions.items).toHaveLength(3);
    for (const row of index.backMatter.timeOrder.rows) {
      expect(row.chapterIds.length).toBeGreaterThan(0);
      for (const id of row.chapterIds) expect(knownChapterIds.has(id)).toBe(true);
    }
  });
});

describe("world data", () => {
  it("quotes the story word for word", () => {
    const quotes: Array<[string, string]> = [
      [world.cycle.quote, world.cycle.chapterId],
      ...world.cycle.stages.map((stage): [string, string] => [stage.quote, stage.chapterId]),
      ...world.couplingScores.map((score): [string, string] => [score.quote, score.chapterId]),
      ...world.contrasts.flatMap((contrast): Array<[string, string]> => [
        [contrast.before.quote, contrast.before.chapterId],
        [contrast.after.quote, contrast.after.chapterId],
      ]),
    ];
    for (const [quote, chapterId] of quotes) expect(chapterText(chapterId), quote).toContain(quote);
  });

  it("points every card and layer at real chapters and entities", () => {
    for (const card of [...world.whereYouAre, ...world.places]) {
      expect(getEntity(card.entityId)).toBeDefined();
      for (const id of card.chapterIds) expect(knownChapterIds.has(id)).toBe(true);
    }
    for (const layer of world.hierarchy) {
      expect(getEntity(layer.entityId)).toBeDefined();
      for (const id of layer.chapterIds) expect(knownChapterIds.has(id)).toBe(true);
      for (const kind of layer.kinds ?? []) expect(knownChapterIds.has(kind.chapterId)).toBe(true);
    }
    for (const pair of pairs) expect(knownChapterIds.has(pair.taglineSource)).toBe(true);
    expect(world.couplingLab.map((score) => score.value)).toEqual([2.1, 1.62]);
    expect(world.cycle.stages).toHaveLength(4);
    expect(world.openQuestions).toHaveLength(3);
  });
});

describe("text rules", () => {
  const contentStrings = collectStrings([
    characters,
    entities,
    pairs,
    siteCopy,
    voiceLines,
    storyIndex,
    world,
  ]);

  it("has no em-dash or en-dash in any content string", () => {
    for (const text of contentStrings) expect(text, text).not.toMatch(DASHES);
  });

  it("has no dash in the story JSON files", () => {
    for (const file of fs.readdirSync(STORY_DIR)) {
      expect(fs.readFileSync(STORY_DIR + file, "utf8"), file).not.toMatch(DASHES);
    }
  });

  it("uses aspirant power and the canon spellings", () => {
    for (const text of contentStrings) expect(text, text).not.toMatch(BANNED);
    for (const file of fs.readdirSync(STORY_DIR)) {
      expect(fs.readFileSync(STORY_DIR + file, "utf8"), file).not.toMatch(BANNED);
    }
  });
});
