// Fitting aid: renders a clip at many times through a camera into a folder of PNGs (transparent
// ground, base colour), and cuts a stretch of a recording into frames of the same size.
//
//   node fit/renders.mjs SPEC.json
//
// SPEC: { clip, fit (a fits.json entry, or omitted for the file's own), times: [..] or
//         { from, to, step }, out, width, height, look ("unlit" or "mask"),
//         video: { name, from, to, fps } (optional: the recording's frames into out/video) }
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fittedAt, readFits } from "../cameras.mjs";
import { VIDEO_DIR, WORK, fail, readJson, writeWhole } from "../lib/env.mjs";
import { closeStage, render, stageFor } from "../verify/compare.mjs";

const spec = readJson(process.argv[2]);
const width = spec.width ?? 480;
const height = spec.height ?? Math.round(width / (3840 / 1728));
fs.mkdirSync(spec.out, { recursive: true });

if (spec.video) {
  const dir = path.join(spec.out, "video");
  fs.mkdirSync(dir, { recursive: true });
  const { name, from, to, fps = 60 } = spec.video;
  const run = spawnSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    String(from),
    "-i",
    path.join(VIDEO_DIR, `${name}.mkv`),
    "-t",
    String(to - from),
    "-vf",
    `fps=${fps},scale=${width}:${height}:flags=area`,
    path.join(dir, "%05d.png"),
  ]);
  if (run.status !== 0) fail(`ffmpeg: ${run.stderr}`);
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ name, from, to, fps }));
}

if (spec.clip) {
  const times = Array.isArray(spec.times)
    ? spec.times
    : Array.from(
        { length: Math.floor((spec.times.to - spec.times.from) / spec.times.step + 1e-6) + 1 },
        (_, i) => spec.times.from + i * spec.times.step,
      );
  const file = spec.file ?? path.join(WORK, "work", "model.glb");
  const { stage } = await stageFor(file);
  const bake = readJson(path.join(WORK, "work", "cameras.game.json"));
  const fit = spec.fit === undefined ? readFits().clips[spec.clip] : spec.fit;
  const index = [];
  for (const t of times) {
    const cam = fittedAt(fit, bake.clips[spec.clip], t);
    const png = await render(stage, spec.clip, t, cam, {
      width,
      height,
      look: spec.look ?? "unlit",
    });
    const name = `${t.toFixed(4)}.png`;
    writeWhole(path.join(spec.out, name), png);
    index.push({ t, file: name, cam });
  }
  fs.writeFileSync(path.join(spec.out, "index.json"), JSON.stringify(index));
  await closeStage();
}
console.log("done", spec.out);
