// Frames of the game's recordings (3840 by 1728, 60 fps). The files are large: ffmpeg always
// seeks before it opens the input and scales the frame down. Frames are kept in the work folder.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { VIDEO_DIR, fail, workDir } from "./env.mjs";

/** The PNG of `video` (a name like "idle") at `seconds`, `width` wide (the 2.2222 frame). */
export function frame(video, seconds, width = 960) {
  const height = Math.round(width / (3840 / 1728));
  const dir = workDir("frames", video);
  const file = path.join(dir, `${seconds.toFixed(3)}-${width}.png`);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  const source = path.join(VIDEO_DIR, `${video}.mkv`);
  const run = spawnSync("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-ss",
    seconds.toFixed(4),
    "-i",
    source,
    "-frames:v",
    "1",
    "-vf",
    `scale=${width}:${height}:flags=area`,
    file,
  ]);
  if (run.status !== 0 || !fs.existsSync(file)) fail(`ffmpeg ${video} ${seconds}: ${run.stderr}`);
  return fs.readFileSync(file);
}
