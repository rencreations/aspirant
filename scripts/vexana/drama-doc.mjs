/**
 * Writes docs/superpowers/specs/2026-10-27-interactive-drama-graph.md: the decision tree of the
 * interactive drama for the owner to read. It reads the curated graph (drama-graph.ts) and the
 * numbers (drama.generated.ts), so run it after `drama.py manifest`.
 *
 *   node scripts/vexana/drama-doc.mjs        (Node 22 or later: it reads the .ts files as they are)
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "apps/web/src/features/character/vexana/drama");
const { DRAMA_NODES, DRAMA_START, CHAPTERS } = await import(
  pathToFileURL(path.join(dir, "drama-graph.ts")).href
);
const { DRAMA_FILES } = await import(pathToFileURL(path.join(dir, "drama.generated.ts")).href);

const DRAMA_BYTES = Object.values(DRAMA_FILES).reduce((sum, f) => sum + f.bytes, 0);
const node = (id) => DRAMA_NODES.find((n) => n.id === id);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const esc = (t) => t.replace(/"/g, "'");

const lines = [];
lines.push("# Interactive drama: the decision tree");
lines.push("");
lines.push(
  'Made from the 21 official videos of "Become The Aspirants | Interactive Drama" (Mobile Legends: Bang Bang). ' +
    "Written by `scripts/vexana/drama.py`, from `drama-graph.ts` (the story, written by hand) and `drama.generated.ts` (the numbers).",
);
lines.push("");
lines.push("## What was found");
lines.push("");
lines.push(
  "- The official tree has 21 episodes. They are **13 different films**: eight of them are the same film posted under two or three ids. " +
    "The picture and the sound are the same (the pictures were compared once a second and the sound by correlation: it matches to within the encoder's noise). Only the thumbnail differs, because it shows the answer the viewer chose to get there.",
);
lines.push(
  "- So each film is one episode here, and the answer that leads to it is kept on the choice (its tag, its text and its card).",
);
lines.push(
  "- A film ends on a held picture with no choice in it. The game draws the two choices over that picture.",
);
lines.push(
  "- Six chapters. Chapter 6 is three ending films, reached by seven of the official ids.",
);
lines.push(`- The video is ${(DRAMA_BYTES / 1048576).toFixed(0)} MB in all (1080p).`);
lines.push("");
lines.push("## The tree");
lines.push("");
lines.push("```mermaid");
lines.push("flowchart TD");
for (const n of DRAMA_NODES) {
  const shape = n.ending ? `(["${n.id}: ${esc(n.title)}"])` : `["${n.id}: ${esc(n.title)}"]`;
  lines.push(`  n${n.id}${shape}`);
}
for (const n of DRAMA_NODES) {
  for (const c of n.choices) lines.push(`  n${n.id} -->|"${esc(c.tag)}"| n${c.to}`);
}
lines.push("```");
lines.push("");
lines.push("Rounded boxes are endings.");
lines.push("");
lines.push("## The same tree as text");
lines.push("");
const seen = new Set();
const walk = (id, depth, via) => {
  const n = node(id);
  const pad = "  ".repeat(depth);
  const again = seen.has(id);
  const tail = n.ending ? " **(ending)**" : again ? " (seen above)" : "";
  lines.push(`${pad}- ${via ? `*${via}* → ` : ""}**${n.id}** ${n.title}${tail}`);
  if (again) return;
  seen.add(id);
  for (const c of n.choices) walk(c.to, depth + 1, `[${c.tag}] ${c.label}`);
};
walk(DRAMA_START, 0, "");
lines.push("");
lines.push("## Every episode");
lines.push("");
for (const ch of CHAPTERS) {
  lines.push(`### Chapter ${ch.number}: ${ch.title}`);
  lines.push("");
  lines.push("| Id | Official ids | Title | What happens | Choices | Film |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const n of DRAMA_NODES.filter((x) => x.chapter === ch.number)) {
    const f = DRAMA_FILES[n.file];
    const choices = n.choices.length
      ? n.choices.map((c) => `[${c.tag}] "${c.label}" → ${c.to}`).join("<br>")
      : `Ending: ${n.ending.title}`;
    lines.push(
      `| ${n.id} | ${n.codes.join(", ")} | ${n.title} | ${n.summary} | ${choices} | \`${n.file}.mp4\`, ${clock(f.duration)}, ${(f.bytes / 1048576).toFixed(1)} MB, ${f.marks.length - 1} lines |`,
    );
  }
  lines.push("");
}
lines.push("## Which ids are the same film");
lines.push("");
lines.push("| Film | Official ids | How the ids differ |");
lines.push("| --- | --- | --- |");
const dupes = DRAMA_NODES.filter((n) => n.codes.length > 1);
for (const n of dupes) {
  const ways = DRAMA_NODES.flatMap((p) =>
    p.choices.filter((c) => c.to === n.id).map((c) => `${c.thumb} from ${p.id}`),
  );
  lines.push(`| ${n.id} | ${n.codes.join(", ")} | Reached by: ${ways.join("; ")} |`);
}
lines.push("");
writeFileSync(
  path.join(root, "docs/superpowers/specs/2026-10-27-interactive-drama-graph.md"),
  lines.join("\n"),
);
console.log("wrote the decision tree");
