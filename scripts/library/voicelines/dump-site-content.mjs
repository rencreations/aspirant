// Dumps the site's reviewed voice text and the ten character cards to JSON for the pipeline.
//
//   node --experimental-strip-types scripts/library/voicelines/dump-site-content.mjs <out dir>
//
// Reads apps/web/src/content/voice.generated.ts and content/characters/*.ts (read only) and
// writes site-voice.json and site-chars.json into the folder it is given.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = process.argv[2];
if (!out) throw new Error("Pass the output folder.");
fs.mkdirSync(out, { recursive: true });

const base = path.resolve(import.meta.dirname, "../../../apps/web/src/content") + path.sep;
const { voiceLines } = await import(pathToFileURL(base + "voice.generated.ts").href);
fs.writeFileSync(path.join(out, "site-voice.json"), JSON.stringify(voiceLines));

const slugs = [
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
const chars = {};
for (const slug of slugs) {
  const mod = await import(pathToFileURL(base + `characters/${slug}.ts`).href);
  const c = mod[slug];
  chars[slug] = {
    slug: c.slug,
    name: c.name,
    aspirantName: c.aspirantName,
    jp: c.jp,
    pair: c.pair,
    palette: c.palette,
    order: c.order,
    side: c.side,
  };
}
fs.writeFileSync(path.join(out, "site-chars.json"), JSON.stringify(chars));
console.log("dumped", Object.keys(chars).length, "characters");
