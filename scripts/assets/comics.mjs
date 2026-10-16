// Webtoon strips -> WebP pages under public/img/comic/<id>/NN.webp and public/data/comics.json.
import fs from "node:fs";
import path from "node:path";
import {
  CONCURRENCY,
  ensureDirFor,
  fileSize,
  getSharp,
  isFresh,
  log,
  pad2,
  pool,
  pub,
  rel,
  saveStage,
  src,
  srcRel,
  writeJson,
} from "./lib.mjs";

const COMICS = [
  {
    id: "aspirant",
    title: "The Aspirant",
    dir: "story/the-aspirant-comic",
    note: "Original page numbering 1 to 42.",
  },
  {
    id: "guinevere-vexana",
    title: "Guinevere and Vexana",
    dir: "story/guinevere-vexana-comic",
    note: "Original page numbering is kept. Pages 3, 23 and 40 are missing in the source.",
  },
];

const MAX_W = 1000;
const MAX_STRIP_H = 12000;
const SLICE_H = 6000;
const WEBP = { quality: 78, effort: 5, smartSubsample: true };

export async function run() {
  const sharp = await getSharp();
  const records = [];
  const out = { generatedFrom: "scripts/assets/comics.mjs", comics: {} };
  let wrote = 0;

  for (const c of COMICS) {
    const dir = src(c.dir);
    const files = fs
      .readdirSync(dir)
      .filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b));
    const pages = [];
    await pool(files, CONCURRENCY, async (f) => {
      const n = parseInt(f);
      const input = path.join(dir, f);
      const meta = await sharp(input).metadata();
      const scale = Math.min(1, MAX_W / meta.width);
      const w = Math.round(meta.width * scale);
      const h = Math.round(meta.height * scale);
      const parts = h > MAX_STRIP_H ? Math.ceil(h / SLICE_H) : 1;
      const entries = [];
      for (let p = 0; p < parts; p++) {
        const letter = parts > 1 ? String.fromCharCode(97 + p) : "";
        const outFile = pub("img", "comic", c.id, `${pad2(n)}${letter}.webp`);
        let top = 0,
          ph = h;
        if (parts > 1) {
          top = Math.round((h / parts) * p);
          ph = Math.round((h / parts) * (p + 1)) - top;
        }
        if (!isFresh(outFile, input)) {
          await ensureDirFor(outFile);
          let img = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
          if (parts > 1) {
            // Resize first, then cut the slice from the resized buffer.
            const buf = await img.png().toBuffer();
            img = sharp(buf).extract({ left: 0, top, width: w, height: ph });
          }
          await img.webp(WEBP).toFile(outFile);
          wrote++;
        }
        const m = await sharp(outFile).metadata();
        const entry = {
          file: rel(outFile),
          width: m.width,
          height: m.height,
          page: n,
          ...(parts > 1 ? { part: letter } : {}),
        };
        entries.push(entry);
        records.push({
          id: `comic-${c.id}-${pad2(n)}${letter}`,
          kind: "image",
          path: entry.file,
          bytes: await fileSize(outFile),
          width: m.width,
          height: m.height,
          role: "comic-page",
          source: srcRel(input),
          pair: c.id === "aspirant" ? undefined : "guinevere-vexana",
          notes:
            parts > 1
              ? `Part ${letter} of a strip that was ${h}px tall at ${w}px wide.`
              : undefined,
        });
      }
      pages.push(...entries);
    });
    pages.sort((a, b) => a.page - b.page || (a.part ?? "").localeCompare(b.part ?? ""));
    const nums = files.map((f) => parseInt(f));
    const missing = [];
    for (let i = 1; i <= Math.max(...nums); i++) if (!nums.includes(i)) missing.push(i);
    out.comics[c.id] = {
      title: c.title,
      note: c.note,
      source: c.dir,
      pageCount: nums.length,
      missingPages: missing,
      pages: pages.map(({ file, width, height, page, part }) => ({
        file,
        width,
        height,
        page,
        ...(part ? { part } : {}),
      })),
    };
    log(
      "comics",
      `${c.id}: ${nums.length} source pages -> ${pages.length} files, missing ${missing.join(",") || "none"}`,
    );
  }

  await writeJson(pub("data", "comics.json"), out);
  records.push({
    id: "data-comics",
    kind: "data",
    path: "data/comics.json",
    role: "comic-index",
    source: "scripts/assets/comics.mjs",
    notes: "Ordered page lists with width and height for each comic.",
  });
  log("comics", `${wrote} files written`);
  await saveStage("comics", records);
}
