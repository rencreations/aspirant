#!/usr/bin/env node
// Text scan for the canon rules (docs/design/canon-rules.md, "Automated check").
//
//   node scripts/qa/scan-text.mjs [root ...]
//
// Default roots: apps/web/src, apps/web/public/data, docs, and apps/web/out when it exists.
// Fails (exit 1) on any em-dash (U+2014), en-dash (U+2013), the Japanese-version word for
// aspirant power (the site always says "aspirant power"), or a banned spelling from the canon
// rules. Prints file:line:column and the context.
//
// The patterns are built from escapes and split strings so this file never matches itself.
import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

const DEFAULT_ROOTS = ["apps/web/src", "apps/web/public/data", "docs", "apps/web/out"];

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".html",
  ".htm",
  ".txt",
  ".xml",
  ".svg",
  ".yml",
  ".yaml",
  ".srt",
  ".vtt",
  ".webmanifest",
  ".rsc",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", ".git", "coverage"]);

const RULES = [
  { name: "em-dash (U+2014)", re: new RegExp("\\u2014", "gu"), words: false },
  { name: "en-dash (U+2013)", re: new RegExp("\\u2013", "gu"), words: false },
  {
    name: 'write "aspirant power"',
    re: new RegExp(["con", "viction"].join(""), "giu"),
    words: true,
  },
  {
    name: "spelling: Terrinia",
    re: new RegExp(["Ter", "enia|Ter", "inia|Terr", "enia"].join(""), "giu"),
    words: true,
  },
  {
    name: "non-canon: parody academy",
    re: new RegExp(["Sei", "resk"].join(""), "giu"),
    words: true,
  },
  {
    name: "spelling: Storm Citadel",
    re: new RegExp(["Windstorm", " Nest"].join(""), "giu"),
    words: true,
  },
];

/** Files that must quote the banned words to explain them. Dashes are still checked. */
const WORD_RULE_EXEMPT = new Set([
  "docs/design/canon-rules.md",
  "docs/OPEN-QUESTIONS.md",
  "scripts/qa/scan-text.mjs",
]);

function toRepoPath(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}

function* walk(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    yield target;
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(target, entry.name));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield path.join(target, entry.name);
    }
  }
}

function context(line, index, length) {
  const start = Math.max(0, index - 40);
  const end = Math.min(line.length, index + length + 40);
  const text = line
    .slice(start, end)
    .replaceAll(String.fromCharCode(0x2014), "<U+2014>")
    .replaceAll(String.fromCharCode(0x2013), "<U+2013>");
  return `${start > 0 ? "..." : ""}${text}${end < line.length ? "..." : ""}`;
}

const args = process.argv.slice(2);
const roots = (args.length ? args : DEFAULT_ROOTS)
  .map((root) => path.resolve(REPO_ROOT, root))
  .filter((root) => {
    if (fs.existsSync(root)) return true;
    if (args.length) console.warn(`Skipping missing root: ${root}`);
    return false;
  });

let files = 0;
const hits = [];
for (const root of roots) {
  for (const file of walk(root)) {
    files += 1;
    const repoPath = toRepoPath(file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/u);
    lines.forEach((line, lineIndex) => {
      for (const rule of RULES) {
        if (rule.words && WORD_RULE_EXEMPT.has(repoPath)) continue;
        rule.re.lastIndex = 0;
        for (const match of line.matchAll(rule.re)) {
          hits.push(
            `${repoPath}:${lineIndex + 1}:${match.index + 1}: [${rule.name}] ${context(line, match.index, match[0].length)}`,
          );
        }
      }
    });
  }
}

for (const hit of hits) console.log(hit);
console.log(
  `scan-text: ${files} files in ${roots.map(toRepoPath).join(", ") || "(no roots)"}; ${hits.length} problem(s).`,
);
process.exit(hits.length ? 1 : 0);
