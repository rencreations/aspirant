// Round seven's cameras: cameras-r7.json beside cameras.json (fitted to the recording).
//
//   node scripts/home/models/cameras-r7.mjs [--out DIR] [--work DIR]
//
// Runs `blender/cameras_r7.py` on the entrance file with `cameras-r7/fits.json` (the correction of
// each loop's camera and the sky's orientation, found against horizontal.mkv: see cameras-r7/README.md)
// and copies the result into the models folder. A new file name, so no cache name needs a bump.
// Never edit the output by hand.
import fs from "node:fs";
import path from "node:path";
import { HERE, OUT_DEFAULT, option, runBlender, workDir, writeWhole } from "./lib/env.mjs";

const work = workDir("cameras-r7");
const fits = path.join(HERE, "..", "cameras-r7", "fits.json");
runBlender("cameras_r7.py", { work, fits });
const out = path.resolve(String(option("out", OUT_DEFAULT)));
const data = fs.readFileSync(path.join(work, "cameras-r7.json"));
writeWhole(path.join(out, "cameras-r7.json"), data);
console.log(`cameras-r7.json ${data.length} bytes -> ${out}`);
