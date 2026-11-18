// Paths and tools shared by the build steps. Nothing here reads the sources.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODELS = path.resolve(HERE, "..");
export const REPO = path.resolve(MODELS, "../../..");
export const WEB = path.join(REPO, "apps/web");
export const OUT_DEFAULT = path.join(WEB, "public/models/home");

/** The owner's source folder. Read only. `HOME_SOURCE` names another. */
export const SOURCE =
  process.env.HOME_SOURCE ??
  "D:\\ren\\aspirant\\3d\\selena_silverbolt_raiko\\selena_silverbolt_raiko";
export const BLEND = path.join(SOURCE, "entrance", "selena_silverbolt_raiko_entrance.blend");
export const ENTRANCE_GLB = path.join(SOURCE, "entrance", "selena_silverbolt_raiko_entrance.glb");
export const BLENDER =
  process.env.BLENDER ?? "C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe";
/** The recordings of the game's own animation, for the camera and pose checks. */
export const VIDEO_DIR = "D:\\ren\\aspirant\\media\\_others\\in-game-animation\\selena";

// Playwright and three come from apps/web, as in the other model builds.
const web = createRequire(path.join(WEB, "package.json"));
export const { chromium } = web("@playwright/test");
export const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));
export const THREE = await import(
  pathToFileURL(path.join(THREE_DIR, "build/three.module.js")).href
);

export function fail(message) {
  throw new Error(`home models: ${message}`);
}

export function option(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

/** Work files (raw exports, renders) live outside the repository. */
export function workDir(...parts) {
  const base = path.resolve(
    String(option("work", process.env.HOME_WORK ?? path.join(os.tmpdir(), "aspirant-home-models"))),
  );
  const dir = path.join(base, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Runs a Blender script on the entrance file (or another .blend) and stops on any error. */
export function runBlender(script, args, { blend = BLEND } = {}) {
  if (!fs.existsSync(blend)) fail(`missing ${blend}`);
  const flat = Object.entries(args).flatMap(([key, value]) => [`--${key}`, String(value)]);
  const result = spawnSync(
    BLENDER,
    ["-b", blend, "--python", path.join(MODELS, "blender", script), "--", ...flat],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  // "Engine 'BLENDER_EEVEE' not available" is printed by every load of this file (it was
  // saved by Blender 5.1) and is harmless. A Python traceback is not.
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
  fs.renameSync(part, file);
}
