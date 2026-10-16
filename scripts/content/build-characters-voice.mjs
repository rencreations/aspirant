#!/usr/bin/env node
// Builds the voice line lists for the ten Aspirants from `audio/<slug>/voice.md`.
//
//   node scripts/content/build-characters-voice.mjs [path/to/audio]
//
// The audio folder can also come from ASPIRANT_AUDIO. Output (idempotent):
//
//   apps/web/src/content/voice.generated.ts   VoiceLine lists per slug
//   scripts/content/out/voice-report.txt      counts and every change made to a line
//
// The English text is the translation as given, with three fixes for the site rules:
// dashes become a comma (or the reviewed wording in EN_OVERRIDES), the Japanese-version word
// for the power becomes "aspirant power", and translator notes move into `note`.
import fs from "node:fs";
import path from "node:path";

import { dedash, hasDash, visibleDashes } from "./lib/dedash.mjs";
import { REPO_ROOT, rel, writeText, writeTs } from "./lib/output.mjs";

const AUDIO = process.argv[2] ?? process.env.ASPIRANT_AUDIO ?? "D:/ren/aspirant/audio";
const TS_OUT = path.join(REPO_ROOT, "apps/web/src/content/voice.generated.ts");
const REPORT = path.join(REPO_ROOT, "scripts/content/out/voice-report.txt");

const SLUGS = [
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
];

/**
 * Lines where a plain comma for the dash reads badly. Each override may differ from the source
 * only in punctuation and capitals; the build checks that.
 */
const EN_OVERRIDES = {
  "fanny-18": "I'll show you. I'm going to become the strongest Aspirant.",
  "guinevere-18": "A girl's Aspirant spirit: it is believing in miracles.",
  "vexana-06": "Just for this moment: time, stop!",
  "vexana-20": "Look up. The stars are shining.",
  "vexana-22": "Now is the time. Stake everything.",
  "vexana-37": "My decision: it won't reach you, Guinevere.",
  "selena-01": '"Destroy that, wipe out this." I just want to be free.',
  "selena-35": "Oops. I might have gone too far.",
};

/** Lesley 36 and 37: the transcript heard 嫦娥 (Jouga) as ジョーカー ("Joker"). */
const JP_FIXES = [
  {
    slug: "lesley",
    from: "ジョーカー",
    to: "嫦娥",
    note: "The Japanese transcript reads ジョーカー (Joker). The line is addressed to Chang'e.",
  },
];

const TRANSLATOR_NOTE = /\s*\((cut off)\)\s*$/iu;
const BANNED = new RegExp(["con", "viction"].join(""), "giu");

function punctuationFree(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, "")
    .trim();
}

if (!fs.existsSync(AUDIO)) {
  console.error(`Audio folder not found: ${AUDIO}`);
  console.error("Pass the audio folder as an argument or set ASPIRANT_AUDIO.");
  process.exit(1);
}

const report = ["Voice build report", `Source: ${AUDIO}`, ""];
const changes = [];
const dashLog = [];
const result = {};

for (const slug of SLUGS) {
  const file = path.join(AUDIO, slug, "voice.md");
  const rows = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*\d+\s*\|/u.test(line));
  const lines = rows.map((row) => {
    const cells = row
      .trim()
      .replace(/^\||\|$/gu, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 3) throw new Error(`${slug}: bad row ${row}`);
    const [numberCell, fileCell, enCell] = cells;
    const n = Number(numberCell);
    const fileName = fileCell.replace(/`/gu, "");
    const titleMatch = /^(\d+)_(.+)\.flac$/u.exec(fileName);
    if (!titleMatch || Number(titleMatch[1]) !== n)
      throw new Error(`${slug} ${n}: bad file name ${fileName}`);
    const key = `${slug}-${String(n).padStart(2, "0")}`;
    const notes = [];

    let jpTitle = titleMatch[2];
    for (const fix of JP_FIXES) {
      if (fix.slug === slug && jpTitle.includes(fix.from)) {
        jpTitle = jpTitle.replaceAll(fix.from, fix.to);
        notes.push(fix.note);
        changes.push(`${key} jpTitle: ${fix.from} -> ${fix.to}`);
      }
    }
    if (hasDash(jpTitle))
      throw new Error(`${key}: dash in Japanese title ${visibleDashes(jpTitle)}`);

    let en = enCell;
    const translatorNote = TRANSLATOR_NOTE.exec(en);
    if (translatorNote) {
      en = en.replace(TRANSLATOR_NOTE, "");
      notes.push("The audio line is cut off.");
      changes.push(`${key} en: moved "(${translatorNote[1]})" into the note`);
    }
    if (EN_OVERRIDES[key]) {
      if (punctuationFree(EN_OVERRIDES[key]) !== punctuationFree(en)) {
        throw new Error(`${key}: override changes more than punctuation`);
      }
      changes.push(
        `${key} en: "${visibleDashes(en)}" -> "${EN_OVERRIDES[key]}" (reviewed wording)`,
      );
      en = EN_OVERRIDES[key];
    }
    en = dedash(en, { where: key, log: dashLog });
    if (BANNED.test(en)) {
      const before = en;
      en = en.replace(BANNED, (word) =>
        word[0] === word[0].toUpperCase() ? "Aspirant power" : "aspirant power",
      );
      changes.push(`${key} en: "${before}" -> "${en}"`);
    }
    BANNED.lastIndex = 0;
    if (/\bJoker\b/u.test(en)) throw new Error(`${key}: "Joker" in the translation`);

    const line = {
      n,
      jpTitle,
      en,
      file: `audio/voice/${slug}/${String(n).padStart(2, "0")}.m4a`,
    };
    if (notes.length) line.note = notes.join(" ");
    return line;
  });
  lines.forEach((line, index) => {
    if (line.n !== index + 1)
      throw new Error(`${slug}: line numbers are not 1..N (found ${line.n})`);
  });
  result[slug] = lines;
  report.push(`${slug.padEnd(10)} ${lines.length} lines`);
}

report.push("");
report.push(`DASHES REPLACED WITH A COMMA (${dashLog.length})`);
for (const entry of dashLog) report.push(`  ${entry.where}: ${entry.after}`);
report.push("");
report.push(`OTHER CHANGES (${changes.length})`);
for (const change of changes) report.push(`  ${change}`);
report.push("");

const source = `// Generated by scripts/content/build-characters-voice.mjs from audio/<slug>/voice.md.
// Do not edit by hand. \`file\` is a relative asset path: wrap it in asset() before use.
import type { Slug, VoiceLine } from "./types";

export const voiceLines: Readonly<Record<Slug, readonly VoiceLine[]>> = ${JSON.stringify(result)};
`;
const changed = await writeTs(TS_OUT, source);
writeText(REPORT, report.join("\n"));

const total = Object.values(result).reduce((sum, lines) => sum + lines.length, 0);
console.log(`Voice: ${total} lines for ${SLUGS.length} characters. Report: ${rel(REPORT)}`);
console.log(changed ? `Wrote: ${rel(TS_OUT)}` : "No changes.");
