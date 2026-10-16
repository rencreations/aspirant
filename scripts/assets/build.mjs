#!/usr/bin/env node
// Asset pipeline entry point.
//   node scripts/assets/build.mjs [--only=images,comics,video,audio,models,portal] [--force] [--concurrency=3]
// Originals are read from ASPIRANT_SRC (default D:/ren/aspirant) and never copied wholesale.
import fs from "node:fs";
import path from "node:path";
import { ARGS, CACHE, log, mkdirp } from "./lib.mjs";

const STAGES = ["images", "comics", "video", "audio", "models", "portal"];
const onlyArg = ARGS.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.split("=")[1].split(",").filter(Boolean) : STAGES;
for (const s of only) {
  if (!STAGES.includes(s)) throw new Error(`unknown stage "${s}"; use ${STAGES.join(", ")}`);
}

// One build at a time: concurrent runs share temp names and corrupt each other's output.
await mkdirp(CACHE);
const lock = path.join(CACHE, "build.lock");
if (fs.existsSync(lock)) {
  const pid = Number(fs.readFileSync(lock, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {}
  if (alive && pid !== process.pid)
    throw new Error(`another asset build is running (pid ${pid}); wait for it or delete ${lock}`);
}
fs.writeFileSync(lock, String(process.pid));
const release = () => {
  try {
    fs.unlinkSync(lock);
  } catch {}
};
process.on("exit", release);
process.on("SIGINT", () => process.exit(130));

const t0 = Date.now();
for (const stage of STAGES.filter((s) => only.includes(s))) {
  const t = Date.now();
  const mod = await import(`./${stage}.mjs`);
  await mod.run();
  log(stage, `finished in ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
const { buildManifest } = await import("./manifest.mjs");
await buildManifest();
log("build", `all done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
