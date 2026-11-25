// Paths and tools of the Entrance build. Nothing here reads the sources.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(HERE, "../../../..");
export const WEB = path.join(REPO, "apps/web");

/** The owner's source folder. Read only. `ENTRANCE_SOURCE` names another. */
export const SOURCE =
  process.env.ENTRANCE_SOURCE ??
  "D:\\ren\\aspirant\\3d\\selena_silverbolt_raiko\\selena_silverbolt_raiko\\entrance";
export const SOURCE_GLB = path.join(SOURCE, "selena_silverbolt_raiko_entrance.glb");
export const SOURCE_BLEND = path.join(SOURCE, "selena_silverbolt_raiko_entrance.blend");
export const BLENDER =
  process.env.BLENDER ?? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe";
/** The recordings of the game's own animation. */
export const VIDEO_DIR = "D:\\ren\\aspirant\\media\\_others\\in-game-animation\\selena";
/** The R2 mirror: the file the room loads is models/v1/selena-entrance.glb under library/v1. */
export const MIRROR = process.env.LIBRARY_MIRROR ?? "D:\\ren\\aspirant-r2\\library\\v1";
export const OUT_FILE = path.join(MIRROR, "models", "v1", "selena-entrance.glb");
/** Work files and check pictures (C: is nearly full on this machine). */
export const WORK = path.resolve(
  option("work", process.env.ENTRANCE_WORK ?? "D:\\ren\\aspirant-work\\models-room\\entrance"),
);

// Playwright and three come from apps/web, as in the other model builds.
const web = createRequire(path.join(WEB, "package.json"));
export const { chromium } = web("@playwright/test");
export const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));
export const THREE = await import(
  pathToFileURL(path.join(THREE_DIR, "build/three.module.js")).href
);

export function fail(message) {
  throw new Error(`selena entrance: ${message}`);
}

export function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

export function workDir(...parts) {
  const dir = path.join(WORK, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Runs a Blender script of this folder on the entrance file and stops on any error. */
export function runBlender(script, args) {
  if (!fs.existsSync(SOURCE_BLEND)) fail(`missing ${SOURCE_BLEND}`);
  const flat = Object.entries(args).flatMap(([key, value]) => [`--${key}`, String(value)]);
  const result = spawnSync(
    BLENDER,
    ["-b", SOURCE_BLEND, "--python", path.join(HERE, "blender", script), "--", ...flat],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  // "Engine 'BLENDER_EEVEE' not available" is printed by every load of this file (it was saved
  // by Blender 5.1) and is harmless. A Python traceback is not.
  if (result.status !== 0 || /Traceback \(most recent call last\)/.test(text)) {
    console.error(text.split("\n").slice(-60).join("\n"));
    fail(`Blender failed in ${script}`);
  }
  return text;
}

export function writeWhole(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  fs.writeFileSync(part, data);
  try {
    fs.renameSync(part, file);
  } catch (error) {
    // Windows refuses to rename over a file another program holds open (a local server of the
    // mirror, a poster run): copy over it instead, then drop the part.
    if (error.code !== "EPERM" && error.code !== "EBUSY") throw error;
    fs.copyFileSync(part, file);
    fs.unlinkSync(part);
  }
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
