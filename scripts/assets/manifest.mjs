// Merge the per-stage records into public/data/manifest.json.
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { CACHE, PUB, getSharp, log, mediaInfo, pool, pub, rel, writeJson, fmtMB } from "./lib.mjs";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const KIND_BY_TOP = { img: "image", video: "video", audio: "audio", models: "model", data: "data" };

export async function buildManifest() {
  const sharp = await getSharp();
  const records = [];
  const skipped = [];
  const notes = [];
  if (fs.existsSync(CACHE)) {
    for (const f of fs
      .readdirSync(CACHE)
      .filter((x) => x.endsWith(".json"))
      .sort()) {
      const j = JSON.parse(await fsp.readFile(path.join(CACHE, f), "utf8"));
      for (const r of j.records) records.push(r);
      for (const s of j.skipped ?? []) skipped.push({ stage: j.stage, ...s });
      for (const n of j.notes ?? []) notes.push({ stage: j.stage, ...n });
    }
  }

  // Drop records whose file vanished, and fill bytes / dimensions / duration.
  const live = [];
  await pool(records, 4, async (r) => {
    const abs = pub(r.path);
    let st;
    try {
      st = await fsp.stat(abs);
    } catch {
      return;
    }
    r.bytes = st.size;
    if (r.kind === "image" && (!r.width || !r.height)) {
      const m = await sharp(abs).metadata();
      r.width = m.width;
      r.height = m.height;
    }
    if (
      (r.kind === "video" || r.kind === "audio") &&
      r.durationSec == null &&
      /\.(mp4|m4a)$/.test(abs)
    ) {
      const m = await mediaInfo(abs);
      r.durationSec = Math.round(m.duration * 100) / 100;
      if (r.kind === "video") {
        r.width ??= m.width;
        r.height ??= m.height;
      }
    }
    live.push(r);
  });
  live.sort((a, b) => a.path.localeCompare(b.path));

  // Record stray files that exist in the output folders but no stage claimed (data, other agents' files are ignored).
  const claimed = new Set(live.map((r) => r.path));
  const unclaimed = [];
  for (const top of Object.keys(KIND_BY_TOP)) {
    const dir = pub(top);
    if (!fs.existsSync(dir)) continue;
    for (const f of walk(dir)) {
      const p = rel(f);
      if (p === "data/manifest.json" || claimed.has(p)) continue;
      unclaimed.push(p);
    }
  }

  const assets = live.map((r) => {
    const { fanart, ...rest } = r;
    // Stable key order, drop undefined.
    const order = [
      "id",
      "kind",
      "path",
      "bytes",
      "width",
      "height",
      "durationSec",
      "pair",
      "slug",
      "role",
      "credit",
      "color",
      "source",
      "notes",
    ];
    const o = {};
    for (const k of order) if (rest[k] !== undefined && rest[k] !== null) o[k] = rest[k];
    for (const k of Object.keys(rest))
      if (!(k in o) && rest[k] !== undefined && rest[k] !== null) o[k] = rest[k];
    return o;
  });

  const byCategory = {};
  let bytes = 0;
  for (const a of assets) {
    const cat = a.path
      .split("/")
      .slice(0, a.path.startsWith("img/") ? 2 : a.path.startsWith("audio/") ? 2 : 1)
      .join("/");
    byCategory[cat] ??= { files: 0, bytes: 0 };
    byCategory[cat].files++;
    byCategory[cat].bytes += a.bytes;
    bytes += a.bytes;
  }
  const publicFiles = walk(PUB).filter((f) => rel(f) !== "data/manifest.json");
  const publicBytes = publicFiles.reduce((s, f) => s + fs.statSync(f).size, 0);

  const manifest = {
    generatedAt: new Date().toISOString(),
    totals: {
      files: assets.length,
      bytes,
      byCategory,
      publicDirFiles: publicFiles.length,
      publicDirBytes: publicBytes,
    },
    skipped,
    notes,
    unlistedFiles: unclaimed,
    assets,
  };
  await writeJson(pub("data", "manifest.json"), manifest);
  log(
    "manifest",
    `${assets.length} assets, ${fmtMB(bytes)} listed; public/ on disk ${publicFiles.length} files, ${fmtMB(publicBytes)}`,
  );
  if (unclaimed.length)
    log(
      "manifest",
      `${unclaimed.length} files in output folders are not listed (see unlistedFiles)`,
    );
}
