#!/usr/bin/env node
// Builds the story JSON for the Experience page from the novel text `short-v2.md`.
//
//   node scripts/content/build-story.mjs [path/to/short-v2.md]
//
// The source path can also come from the ASPIRANT_STORY environment variable. The default is
// the author's folder on the build machine. Output (all idempotent):
//
//   apps/web/public/data/story/index.json          front matter, parts, chapter list, back matter
//   apps/web/public/data/story/part-01..12.json    chapter text as typed blocks
//   apps/web/src/content/story-index.generated.ts  the index without the front matter, for pages
//   scripts/content/out/story-report.txt           every dash replacement, counts and checks
//
// The text is kept exactly as written, except that every em-dash and en-dash is replaced
// (see lib/dedash.mjs). Names, places and terms are marked as entity segments for hover cards.
import fs from "node:fs";
import path from "node:path";

import { entities } from "../../apps/web/src/content/entities.ts";
import { annotateSegments, buildMatcher, findMatches } from "./lib/annotate.mjs";
import { dedash, visibleDashes } from "./lib/dedash.mjs";
import { countWords, parseInline, plainText, stripMarkers } from "./lib/inline.mjs";
import { REPO_ROOT, rel, writeJson, writeText, writeTs } from "./lib/output.mjs";

const SOURCE = process.argv[2] ?? process.env.ASPIRANT_STORY ?? "D:/ren/aspirant/story/short-v2.md";
const OUT_DIR = path.join(REPO_ROOT, "apps/web/public/data/story");
const TS_OUT = path.join(REPO_ROOT, "apps/web/src/content/story-index.generated.ts");
const REPORT = path.join(REPO_ROOT, "scripts/content/out/story-report.txt");

const NUMBER_WORDS = [
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
];

/**
 * Paragraphs where a name means someone or something else. The entity is not annotated in
 * any paragraph of that chapter that contains the given text.
 */
const EXCLUSIONS = [
  {
    chapter: "c35",
    contains: "It was the nursemaid's name",
    entity: "angela",
    reason: "the nursemaid Angela, not the android",
  },
  {
    chapter: "c27",
    contains: "The girl in the book was called Selena",
    entity: "selena",
    reason: "the girl in Karina's picture-book",
  },
  {
    chapter: "c27",
    contains: "You want to be called Selena?",
    entity: "selena",
    reason: "the name is still the book's name here",
  },
  {
    chapter: "c15",
    contains: "Chang'e was a girl in an old story",
    entity: "change",
    reason: "Chang'e of the moon legend",
  },
  {
    chapter: "c13",
    contains: "hunters and engineers",
    entity: "hunters",
    reason: "human hunters who joined the Shield",
  },
];

const SPEECH_VERBS = [
  "said",
  "asked",
  "cried",
  "shouted",
  "whispered",
  "murmured",
  "muttered",
  "screamed",
  "shrieked",
  "replied",
  "snapped",
];

// ---------------------------------------------------------------------------------------------

if (!fs.existsSync(SOURCE)) {
  console.error(`Story source not found: ${SOURCE}`);
  console.error("Pass the path to short-v2.md as an argument or set ASPIRANT_STORY.");
  process.exit(1);
}

const dashLog = [];
const warnings = [];
const exclusionHits = [];

const rawLines = fs.readFileSync(SOURCE, "utf8").split(/\r?\n/u);
const lines = rawLines.map((line, index) =>
  dedash(line, { where: `line ${index + 1}`, log: dashLog }),
);

const matcher = buildMatcher(entities);
const entityIds = new Set(entities.map((entity) => entity.id));

/** Split a range of lines into paragraphs: runs of non-empty lines. */
function paragraphs(from, to) {
  const out = [];
  let current = null;
  for (let index = from; index < to; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      if (current) out.push(current);
      current = null;
      continue;
    }
    if (!current) current = { line: index + 1, rows: [] };
    current.rows.push(line);
  }
  if (current) out.push(current);
  return out;
}

function findLine(predicate, from = 0) {
  for (let index = from; index < lines.length; index += 1) {
    if (predicate(lines[index])) return index;
  }
  return -1;
}

function lookupEntity(text) {
  const match = findMatches(matcher, stripMarkers(text))[0];
  return match ? match.id : null;
}

function isItalicLine(text) {
  const trimmed = text.trim();
  return /^\*[^*].*[^*]\*$/u.test(trimmed) && !trimmed.slice(1, -1).includes("*");
}

function tableRows(rows) {
  return rows
    .filter((row) => row.trim().startsWith("|"))
    .slice(2)
    .map((row) =>
      row
        .trim()
        .replace(/^\||\|$/gu, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
}

// ---------------------------------------------------------------------------------------------
// Front matter

const firstPart = findLine((line) => /^# PART /u.test(line));
const backStart = findLine((line) => line.startsWith("## What this story leaves open"));
if (firstPart < 0 || backStart < 0) throw new Error("Could not find the parts or the back matter.");

const title = lines[0].replace(/^# /u, "").trim();
const subtitle = lines[findLine((line) => line.startsWith("## "))].replace(/^## /u, "").trim();
const introLine = lines.find((line, index) => index < firstPart && isItalicLine(line));
const intro = stripMarkers(introLine).trim();

const quoteLines = lines.slice(0, firstPart).filter((line) => line.startsWith(">"));
const epigraph = {
  lines: quoteLines
    .map((line) => line.replace(/^>\s?/u, "").trim())
    .filter((line) => line.startsWith("*"))
    .map((line) => stripMarkers(line).trim()),
  attribution: quoteLines
    .map((line) => line.replace(/^>\s?/u, "").trim())
    .filter((line) => line && !line.startsWith("*"))
    .join(" "),
};

const beforeStart = findLine((line) => line.startsWith("## Before you begin"));
const beforeYouBegin = [];
{
  const headings = [];
  for (let index = beforeStart; index < firstPart; index += 1) {
    if (lines[index].startsWith("### ")) headings.push(index);
  }
  headings.forEach((start, n) => {
    const end = headings[n + 1] ?? firstPart;
    const sectionTitle = lines[start].replace(/^### /u, "").trim();
    const seen = new Set();
    const blocks = [];
    for (const para of paragraphs(start + 1, end)) {
      if (para.rows[0].trim().startsWith("|")) {
        blocks.push({
          type: "people",
          rows: tableRows(para.rows).map(([name, text]) => ({
            entityId: lookupEntity(name),
            name: stripMarkers(name),
            text: stripMarkers(text),
          })),
        });
        continue;
      }
      const segments = annotateSegments(
        parseInline(para.rows.join(" "), `line ${para.line}`),
        matcher,
        (id) => (seen.has(id) ? false : (seen.add(id), true)),
      );
      blocks.push({ type: "p", segments });
    }
    beforeYouBegin.push({
      id: sectionTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-|-$/gu, ""),
      title: sectionTitle,
      blocks,
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Parts and chapters

const parts = [];
const chapters = [];
let globalParagraph = 0;
let interludeCount = 0;
const speakerPattern = buildSpeakerPattern();

function buildSpeakerPattern() {
  const people = entities.filter(
    (entity) => entity.kind === "character" || entity.kind === "person",
  );
  const aliases = people
    .flatMap((entity) => entity.aliases.map((alias) => ({ alias, id: entity.id })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const names = aliases.map(({ alias }) => alias.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
  const verbs = SPEECH_VERBS.join("|");
  // A speech tag sits right after a closing quote: `," said Fanny` or `," Karina whispered`.
  return {
    idOf: new Map(aliases.map(({ alias, id }) => [alias, id])),
    after: new RegExp(
      `["\u201d]\\s+(?:${verbs})\\s+(?:the\\s+)?(${names})(?!['\u2019]s)(?![\\p{L}\\p{N}-])`,
      "gu",
    ),
    before: new RegExp(`["\u201d]\\s+(?:the\\s+)?(${names})\\s+(?:${verbs})\\b`, "gu"),
  };
}

function speakerOf(text) {
  const ids = new Set();
  for (const re of [speakerPattern.after, speakerPattern.before]) {
    for (const match of text.matchAll(re)) ids.add(speakerPattern.idOf.get(match[1]));
  }
  return ids.size === 1 ? [...ids][0] : null;
}

const partStarts = [];
for (let index = firstPart; index < backStart; index += 1) {
  if (/^# PART /u.test(lines[index])) partStarts.push(index);
}

partStarts.forEach((start, n) => {
  const end = partStarts[n + 1] ?? backStart;
  const word = lines[start].replace(/^# PART /u, "").trim();
  const number = NUMBER_WORDS.indexOf(word) + 1;
  if (number !== n + 1)
    throw new Error(`Unexpected part heading at line ${start + 1}: ${lines[start]}`);
  const titleLine = findLine((line) => line.startsWith("## "), start);
  const partTitle = lines[titleLine].replace(/^## /u, "").trim();
  const settingLine = findLine((line) => line.trim() !== "", titleLine + 1);
  if (!isItalicLine(lines[settingLine])) {
    throw new Error(`Part ${number} has no italic setting line (line ${settingLine + 1}).`);
  }
  const setting = stripMarkers(lines[settingLine]).trim();

  const headings = [];
  for (let index = start; index < end; index += 1) {
    if (lines[index].startsWith("### ")) headings.push(index);
  }

  const partChapters = headings.map((headingIndex, k) => {
    const chapterEnd = headings[k + 1] ?? end;
    const heading = lines[headingIndex].replace(/^### /u, "").trim();
    const chapterMatch = /^Chapter (\d+): (.+)$/u.exec(heading);
    const interludeMatch = /^Interlude: (.+)$/u.exec(heading);
    let id;
    let kind;
    let chapterNumber = null;
    let chapterTitle;
    if (chapterMatch) {
      kind = "chapter";
      chapterNumber = Number(chapterMatch[1]);
      chapterTitle = chapterMatch[2].trim();
      id = `c${String(chapterNumber).padStart(2, "0")}`;
    } else if (interludeMatch) {
      kind = "interlude";
      interludeCount += 1;
      chapterTitle = interludeMatch[1].trim();
      id = `i-${chapterTitle.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}-${interludeCount}`;
    } else {
      throw new Error(`Unknown heading at line ${headingIndex + 1}: ${heading}`);
    }

    // The first unit of a part annotates every occurrence; the rest annotate the first only.
    const everyOccurrence = k === 0;
    const seen = new Set();
    const blocks = [];
    let timeNote = null;
    let localParagraph = 0;
    let sceneBreaks = 0;
    let words = 0;
    const firstParagraphIndex = globalParagraph;

    for (const para of paragraphs(headingIndex + 1, chapterEnd)) {
      const joined = para.rows.join("\n");
      if (joined.trim() === "---") continue;
      if (joined.trim() === "* * *") {
        sceneBreaks += 1;
        blocks.push({ type: "scene-break", id: `${id}-s${String(sceneBreaks).padStart(2, "0")}` });
        continue;
      }
      if (
        blocks.length === 0 &&
        timeNote === null &&
        para.rows.length === 1 &&
        isItalicLine(joined)
      ) {
        timeNote = stripMarkers(joined).trim();
        continue;
      }

      const excluded = new Set(
        EXCLUSIONS.filter((rule) => rule.chapter === id && joined.includes(rule.contains)).map(
          (rule) => rule.entity,
        ),
      );
      for (const rule of EXCLUSIONS) {
        if (rule.chapter === id && joined.includes(rule.contains)) {
          exclusionHits.push(`${id} line ${para.line}: no "${rule.entity}" (${rule.reason})`);
        }
      }
      const decide = (entityId) => {
        if (excluded.has(entityId)) return false;
        if (!everyOccurrence && seen.has(entityId)) return false;
        seen.add(entityId);
        return true;
      };

      const isPoem =
        para.rows.length > 1 && para.rows.slice(0, -1).every((row) => / {2}$/u.test(row));
      const blockId = `${id}-p${String(localParagraph).padStart(3, "0")}`;
      if (isPoem) {
        const poemLines = para.rows.map((row, r) =>
          annotateSegments(parseInline(row.trim(), `line ${para.line + r}`), matcher, decide),
        );
        poemLines.forEach((segments, r) => {
          checkRoundTrip(segments, para.rows[r].trim(), para.line + r);
          words += countWords(plainText(segments));
        });
        blocks.push({ type: "poem", id: blockId, i: globalParagraph, lines: poemLines });
      } else {
        if (para.rows.length > 1) {
          warnings.push(
            `${id} line ${para.line}: paragraph spans ${para.rows.length} lines; joined with spaces`,
          );
        }
        const source = para.rows.map((row) => row.trim()).join(" ");
        const segments = annotateSegments(
          parseInline(source, `line ${para.line}`),
          matcher,
          decide,
        );
        checkRoundTrip(segments, source, para.line);
        const text = plainText(segments);
        words += countWords(text);
        const block = { type: "p", id: blockId, i: globalParagraph, segments };
        if (/^["\u201C]/u.test(text)) {
          block.dialogue = true;
          const speaker = speakerOf(text);
          if (speaker) block.speaker = speaker;
        }
        blocks.push(block);
      }
      localParagraph += 1;
      globalParagraph += 1;
    }

    if (localParagraph === 0) throw new Error(`${id} has no paragraphs.`);
    return {
      id,
      kind,
      number: chapterNumber,
      title: chapterTitle,
      part: number,
      timeNote,
      wordCount: words,
      paragraphCount: localParagraph,
      firstParagraphIndex,
      blocks,
    };
  });

  const file = `data/story/part-${String(number).padStart(2, "0")}.json`;
  const partMeta = {
    number,
    label: `Part ${word.charAt(0)}${word.slice(1).toLowerCase()}`,
    title: partTitle,
    setting,
    chapterIds: partChapters.map((chapter) => chapter.id),
    file,
    wordCount: partChapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
  };
  parts.push(partMeta);
  chapters.push(...partChapters);
});

function checkRoundTrip(segments, source, line) {
  const expected = stripMarkers(source);
  const actual = plainText(segments);
  if (expected !== actual) {
    throw new Error(
      `Text changed at line ${line}:\n  expected: ${expected}\n  actual:   ${actual}`,
    );
  }
  for (const segment of segments) {
    if (segment.t === "ent" && !entityIds.has(segment.id)) {
      throw new Error(`Unknown entity ${segment.id} at line ${line}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Back matter

function sectionRange(startPredicate) {
  const start = findLine(startPredicate, backStart);
  if (start < 0) throw new Error("Back matter section not found.");
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{2,3} /u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end, title: lines[start].replace(/^#{2,3} /u, "").trim() };
}

const chapterIdSet = new Set(chapters.map((chapter) => chapter.id));

function parseChapterCell(cell) {
  const ids = [];
  const interlude = /Part (\w+) \(the "Far Above" page/u.exec(cell);
  if (interlude) {
    const partNumber = parts.find((part) => part.label === `Part ${interlude[1]}`)?.number;
    const id = parts[partNumber - 1]?.chapterIds.find((chapterId) => chapterId.startsWith("i-"));
    if (!id) throw new Error(`No interlude in ${cell}`);
    ids.push(id);
  }
  for (const match of cell.matchAll(/(\d+)(?: to (\d+))?/gu)) {
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    for (let n = from; n <= to; n += 1) ids.push(`c${String(n).padStart(2, "0")}`);
  }
  for (const id of ids) {
    if (!chapterIdSet.has(id))
      throw new Error(`Time order refers to unknown chapter ${id} (${cell})`);
  }
  return ids;
}

const openRange = sectionRange((line) => line.startsWith("## What this story leaves open"));
const openParas = paragraphs(openRange.start + 1, openRange.end);
const openQuestions = {
  title: openRange.title,
  intro: stripMarkers(openParas[0].rows.join(" ")).trim(),
  items: openParas
    .slice(1)
    .flatMap((para) => para.rows)
    .filter((row) => row.startsWith("- "))
    .map((row) => {
      const match = /^- \*\*(.+?)\*\*\s*(.+)$/u.exec(row);
      if (!match) throw new Error(`Bad open question: ${row}`);
      return { question: match[1].trim(), answer: stripMarkers(match[2]).trim() };
    }),
};
const closing = stripMarkers(
  openParas.flatMap((para) => para.rows).find((row) => /^\*THE END\*$/u.test(row.trim())) ?? "",
).trim();

const referenceRange = sectionRange((line) => line.startsWith("## For reference"));
const reference = {
  title: referenceRange.title,
  intro: stripMarkers(
    paragraphs(referenceRange.start + 1, referenceRange.end)[0].rows.join(" "),
  ).trim(),
};

const whoRange = sectionRange((line) => line.startsWith("### Now you know"));
const whoParas = paragraphs(whoRange.start + 1, whoRange.end);
const whoIsWho = {
  title: whoRange.title,
  rows: tableRows(whoParas.find((para) => para.rows[0].startsWith("|")).rows).map(
    ([name, rowTitle, text]) => ({
      entityId: lookupEntity(name),
      name: stripMarkers(name),
      title: stripMarkers(rowTitle),
      text: stripMarkers(text),
    }),
  ),
  also: [
    ...whoParas
      .find((para) => para.rows[0].startsWith("Also:"))
      .rows.join(" ")
      .matchAll(/\*\*(.+?)\*\*,\s*(.+?)(?=\s\*\*|$)/gu),
  ].map((match) => ({
    entityId: lookupEntity(match[1]),
    name: match[1].trim(),
    text: match[2].trim(),
  })),
};

const timeRange = sectionRange((line) => line.startsWith("### The story in time order"));
const timeOrder = {
  title: timeRange.title,
  rows: tableRows(paragraphs(timeRange.start + 1, timeRange.end)[0].rows).map(
    ([when, what, cell]) => ({
      when: stripMarkers(when),
      what: stripMarkers(what),
      chapters: stripMarkers(cell),
      chapterIds: parseChapterCell(cell),
    }),
  ),
};

const wordsRange = sectionRange((line) => line.startsWith("### Words to know"));
const wordsToKnow = {
  title: wordsRange.title,
  items: paragraphs(wordsRange.start + 1, wordsRange.end)
    .flatMap((para) => para.rows)
    .filter((row) => row.startsWith("- "))
    .map((row) => {
      const match = /^- \*\*(.+?):\*\*\s*(.+)$/u.exec(row);
      if (!match) throw new Error(`Bad word to know: ${row}`);
      const segments = parseInline(match[2].trim(), "words to know");
      return {
        term: match[1].trim(),
        entityId: lookupEntity(match[1]),
        text: plainText(segments),
        segments,
      };
    }),
};

const backMatter = { openQuestions, closing, reference, whoIsWho, timeOrder, wordsToKnow };

// ---------------------------------------------------------------------------------------------
// Write

const chapterMetas = chapters.map(({ blocks: _blocks, ...meta }) => meta);
const stats = {
  parts: parts.length,
  chapters: chapters.filter((chapter) => chapter.kind === "chapter").length,
  interludes: chapters.filter((chapter) => chapter.kind === "interlude").length,
  paragraphs: globalParagraph,
  words: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
};

const index = {
  title,
  subtitle,
  intro,
  epigraph,
  beforeYouBegin,
  parts,
  chapters: chapterMetas,
  backMatter,
  stats,
};

const written = [];
if (await writeJson(path.join(OUT_DIR, "index.json"), index)) written.push("index.json");
for (const part of parts) {
  const file = path.join(REPO_ROOT, "apps/web/public", part.file);
  const partChapters = chapters.filter((chapter) => chapter.part === part.number);
  if (await writeJson(file, { part, chapters: partChapters })) written.push(path.basename(file));
}

const { beforeYouBegin: _front, ...lite } = index;
const tsSource = `// Generated by scripts/content/build-story.mjs from short-v2.md. Do not edit by hand.
// The full text lives in public/data/story/part-XX.json; this module holds the index only.
import type { StoryIndex } from "./story-types";

export const storyIndex: Omit<StoryIndex, "beforeYouBegin"> = ${JSON.stringify(lite)};
`;
if (await writeTs(TS_OUT, tsSource)) written.push(rel(TS_OUT));

// ---------------------------------------------------------------------------------------------
// Report

const annotationCounts = new Map();
const firstChapterOf = new Map();
let speakers = 0;
for (const chapter of chapters) {
  for (const block of chapter.blocks) {
    if (block.type === "p" && block.speaker) speakers += 1;
    const segmentLists =
      block.type === "p" ? [block.segments] : block.type === "poem" ? block.lines : [];
    for (const segment of segmentLists.flat()) {
      if (segment.t !== "ent") continue;
      annotationCounts.set(segment.id, (annotationCounts.get(segment.id) ?? 0) + 1);
      if (!firstChapterOf.has(segment.id)) firstChapterOf.set(segment.id, chapter.id);
    }
  }
}

const report = [];
report.push("Story build report");
report.push(`Source: ${SOURCE}`);
report.push("");
report.push("COUNTS");
report.push(`  parts: ${stats.parts}`);
report.push(`  chapters: ${stats.chapters}`);
report.push(`  interludes: ${stats.interludes} (spec.md says 3; the source has 2)`);
report.push(`  paragraphs: ${stats.paragraphs}`);
report.push(`  words: ${stats.words}`);
report.push(`  dialogue paragraphs with a speaker hint: ${speakers}`);
report.push(`  entity annotations: ${[...annotationCounts.values()].reduce((a, b) => a + b, 0)}`);
report.push("");
report.push(`DASH REPLACEMENTS (${dashLog.length})`);
report.push("  Dashes are shown as <U+2014> (em) and <U+2013> (en).");
for (const entry of dashLog) {
  report.push(`  ${entry.where} [${entry.rule}]`);
  report.push(`    before: ${entry.before}`);
  report.push(`    after:  ${entry.after}`);
}
report.push("");
report.push(`TIME NOTES (${chapters.filter((chapter) => chapter.timeNote).length})`);
for (const chapter of chapters) {
  if (chapter.timeNote) report.push(`  ${chapter.id}: ${chapter.timeNote}`);
}
report.push("");
report.push("ANNOTATION RULES");
report.push(
  "  The first unit of each part annotates every occurrence; other chapters the first only.",
);
report.push("  Part Nine opens with an interlude, so the interlude is its first unit.");
report.push(`  First units: ${parts.map((part) => part.chapterIds[0]).join(", ")}`);
report.push("  Angela in c29 is the android (Ruby names her), so it is annotated.");
report.push("");
report.push(`EXCLUSIONS APPLIED (${exclusionHits.length})`);
for (const hit of exclusionHits) report.push(`  ${hit}`);
report.push("");
report.push("ENTITIES (annotations, first chapter in the text, firstChapter in entities.ts)");
let mismatches = 0;
for (const entity of entities) {
  const count = annotationCounts.get(entity.id) ?? 0;
  const first = firstChapterOf.get(entity.id) ?? "-";
  const declared = entity.firstChapter ?? "-";
  const flag = first === declared ? "" : "  << MISMATCH";
  if (flag) mismatches += 1;
  report.push(
    `  ${entity.id.padEnd(24)} ${String(count).padStart(4)}  ${first.padEnd(15)} ${declared}${flag}`,
  );
}
report.push("");
report.push(`WARNINGS (${warnings.length})`);
for (const warning of warnings) report.push(`  ${warning}`);
report.push("");
writeText(REPORT, report.join("\n"));

console.log(
  `Story: ${stats.parts} parts, ${stats.chapters} chapters, ${stats.interludes} interludes, ` +
    `${stats.paragraphs} paragraphs, ${stats.words} words.`,
);
console.log(`Dash replacements: ${dashLog.length}. Report: ${rel(REPORT)}`);
console.log(written.length ? `Wrote: ${written.join(", ")}` : "No changes.");
if (mismatches) {
  console.warn(`${mismatches} entity firstChapter values differ from the text. See the report.`);
  process.exitCode = 1;
}
for (const entry of dashLog) {
  if (entry.rule === "fallback")
    console.warn(`Fallback dash rule used at ${entry.where}: ${entry.after}`);
}
if (lines.some((line) => visibleDashes(line) !== line)) throw new Error("A dash survived.");
