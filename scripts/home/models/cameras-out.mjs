// The camera of the out clip (round seven): cameras-out.json beside cameras.json.
//
//   node scripts/home/models/cameras-out.mjs [--out DIR] [--work DIR]
//
// Runs `blender/cameras_out.py` on the entrance file and copies the result into the models folder.
// A new file name, so no cache name needs a bump. Never edit the output by hand.
import fs from "node:fs";
import path from "node:path";
import { OUT_DEFAULT, option, runBlender, workDir, writeWhole } from "./lib/env.mjs";

const work = workDir("cameras-out");
runBlender("cameras_out.py", { work });
const out = path.resolve(String(option("out", OUT_DEFAULT)));
const data = fs.readFileSync(path.join(work, "cameras-out.json"));
writeWhole(path.join(out, "cameras-out.json"), data);
console.log(`cameras-out.json ${data.length} bytes -> ${out}`);
