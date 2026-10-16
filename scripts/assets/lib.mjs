// Shared helpers for the asset pipeline. Node 22+, ESM.
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(here, "..", "..");
export const PUB = path.join(REPO, "apps", "web", "public");
export const CACHE = path.join(here, ".cache");
/** Originals. Read only. Override with ASPIRANT_SRC. */
export const SRC = process.env.ASPIRANT_SRC ?? "D:/ren/aspirant";
/** Scratch space for temp files. Never inside the repo. Override with ASSET_TMP. */
export const TMP = process.env.ASSET_TMP ?? path.join(os.tmpdir(), "aspirant-assets");

export const BLENDER =
  process.env.BLENDER ?? "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe";
export const PYTHON = process.env.ASSET_PYTHON ?? "C:/Users/muham/anaconda3/python";
/** Python venv with torch + transformers for depth maps (optional). */
export const DEPTH_PYTHON = process.env.DEPTH_PYTHON ?? "";

export const ARGS = process.argv.slice(2);
export const FORCE = ARGS.includes("--force");
export const CONCURRENCY =
  Number((ARGS.find((a) => a.startsWith("--concurrency=")) ?? "").split("=")[1]) || 3;

const require = createRequire(import.meta.url);
let sharpMod;
export async function getSharp() {
  if (!sharpMod) {
    const m = await import("sharp").catch(
      () => import(require.resolve("sharp", { paths: [REPO] })),
    );
    sharpMod = m.default;
    sharpMod.cache(false);
    sharpMod.concurrency(2);
  }
  return sharpMod;
}

export const src = (...p) => path.join(SRC, ...p);
export const pub = (...p) => path.join(PUB, ...p);
export const rel = (abs) => path.relative(PUB, abs).split(path.sep).join("/");
export const srcRel = (abs) => path.relative(SRC, abs).split(path.sep).join("/");

export async function mkdirp(dir) {
  await fsp.mkdir(dir, { recursive: true });
}
export async function ensureDirFor(file) {
  await mkdirp(path.dirname(file));
}

/** True when `out` exists, is non-empty, and is newer than every input. */
export function isFresh(out, ...inputs) {
  if (FORCE) return false;
  try {
    const o = fs.statSync(out);
    if (o.size === 0) return false;
    for (const i of inputs.flat()) {
      if (i && fs.statSync(i).mtimeMs > o.mtimeMs) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function exec(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    const out = [];
    const err = [];
    child.stdout?.on("data", (d) => out.push(d));
    child.stderr?.on("data", (d) => err.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = opts.binary ? Buffer.concat(out) : Buffer.concat(out).toString("utf8");
      const stderr = Buffer.concat(err).toString("utf8");
      if (code === 0) resolve({ stdout, stderr });
      else
        reject(
          new Error(
            `${cmd} ${args.slice(0, 6).join(" ")} ... exited ${code}\n${stderr.slice(-1500)}`,
          ),
        );
    });
  });
}

export const ffmpeg = (args, opts) =>
  exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], opts);

export async function ffprobeJson(file) {
  const { stdout } = await exec("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  return JSON.parse(stdout);
}

export async function mediaInfo(file) {
  const j = await ffprobeJson(file);
  const v = j.streams.find((s) => s.codec_type === "video");
  return {
    duration: parseFloat(j.format.duration),
    width: v?.width,
    height: v?.height,
    fps: v ? eval(v.r_frame_rate) : undefined,
    hasAudio: j.streams.some((s) => s.codec_type === "audio"),
  };
}

/** Run `fn(item, index)` over `items` with at most `n` in flight. */
export async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fileSize(p) {
  return (await fsp.stat(p)).size;
}

export const fmtMB = (b) => (b / 1048576).toFixed(1) + " MB";
export const pad2 = (n) => String(n).padStart(2, "0");

export function log(stage, msg) {
  console.log(`[${stage}] ${msg}`);
}

/** Persist the records of a stage so the manifest step can merge them. */
export async function saveStage(name, records, extra = {}) {
  await mkdirp(CACHE);
  await fsp.writeFile(
    path.join(CACHE, `${name}.json`),
    JSON.stringify({ stage: name, savedAt: new Date().toISOString(), records, ...extra }, null, 1),
  );
}

export async function writeJson(file, data) {
  await ensureDirFor(file);
  await fsp.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

/** Replace en and em dashes and the "conviction" wording in shipped text (canon rules 2 and 3). */
export function cleanText(s) {
  return s
    .replace(/\s*[\u2014\u2013]\s*/g, " - ")
    .replace(/\bconvictions\b/gi, "aspirant powers")
    .replace(/\bconviction\b/gi, "aspirant power");
}
