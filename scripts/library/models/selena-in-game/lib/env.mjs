// Paths and tools shared by the steps of this pipeline. Nothing here reads the sources.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

export const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(HERE, "../../../..");
export const WEB = path.join(REPO, "apps/web");

/** The owner's source folder. Read only. `SELENA_SOURCE` names another. */
export const SOURCE =
  process.env.SELENA_SOURCE ??
  "D:\\ren\\aspirant\\3d\\selena_silverbolt_raiko\\selena_silverbolt_raiko";
export const IN_GAME = path.join(SOURCE, "in_game");
export const NORMAL_GLB = path.join(IN_GAME, "selena_silverbolt_raiko_in_game.glb");
export const ABYSSAL_GLB = path.join(IN_GAME, "selena_silverbolt_raiko_in_game_abyssal_form.glb");
export const ENTRANCE_GLB = path.join(SOURCE, "entrance", "selena_silverbolt_raiko_entrance.glb");

/** The R2 mirror folder of the room's models. `MODELS_OUT` names another (a trial). */
export const OUT = process.env.MODELS_OUT ?? "D:\\ren\\aspirant-r2\\library\\v1\\models\\v1";
/** Frame sheets and work files. C: is nearly full on this machine, so they live on D:. */
export const WORK = process.env.MODELS_WORK ?? "D:\\ren\\aspirant-work\\models-room\\in-game";

// Playwright and three come from apps/web, as in the other model builds.
const web = createRequire(path.join(WEB, "package.json"));
export const { chromium } = web("@playwright/test");
export const THREE_DIR = fs.realpathSync(path.join(WEB, "node_modules/three"));
export const THREE = await import(
  pathToFileURL(path.join(THREE_DIR, "build/three.module.js")).href
);

export function fail(message) {
  throw new Error(`selena in-game: ${message}`);
}

/** A reader and writer that know every extension and can read and write meshopt streams. */
export function makeIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
}

export function workDir(...parts) {
  const dir = path.join(WORK, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeWhole(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const part = `${file}.part`;
  fs.writeFileSync(part, data);
  fs.renameSync(part, file);
}
