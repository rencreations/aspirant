// Builds the models of the home page: Silverbolt, Selena, Selena's hand and the camera clips.
//
//   node scripts/home/models/build.mjs [silverbolt] [selena] [hand] [cameras]
//        [--out DIR] [--work DIR] [--renders DIR] [--skip-blender]
//
// With no names it builds all four, in that order (the cameras are checked against the two
// finished characters). Reads the owner's source folder (read only: HOME_SOURCE names another)
// and writes apps/web/public/models/home/ (--out DIR writes there instead, for a trial). Blender
// 4.5 does the rig work in the background (BLENDER names another install), gltf-transform does
// the size pass, and every file is loaded back in real Chrome with the site's own three and
// checked. A failed check stops the build. README.md in this folder has the rest.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { OUT_DEFAULT, fail, option, workDir } from "./lib/env.mjs";
import { build as buildCameras } from "./cameras.mjs";
import { build as buildHand } from "./hand.mjs";
import { build as buildSelena } from "./selena.mjs";
import { build as buildSilverbolt } from "./silverbolt.mjs";
import { check as checkFinal } from "./verify/final-check.mjs";

/** Largest sizes in bytes, over the budget of the loading list (about 0.3, 2, 0.3 MB and 12 KB gzip). */
const BUDGET = { silverbolt: 420_000, selena: 2_400_000, hand: 420_000, cameras_gzip: 16_000 };

function names() {
  const known = ["silverbolt", "selena", "hand", "cameras"];
  const asked = process.argv.slice(2).filter((a) => !a.startsWith("--") && known.includes(a));
  return asked.length ? known.filter((n) => asked.includes(n)) : known;
}

async function main() {
  const wanted = names();
  const out = path.resolve(String(option("out", OUT_DEFAULT)));
  if (!option("work", null) && !process.env.HOME_WORK && fs.existsSync("D:\\ren\\aspirant-work")) {
    process.env.HOME_WORK = "D:\\ren\\aspirant-work\\home\\models";
  }
  const renders = path.resolve(String(option("renders", path.join(workDir("renders")))));
  const skipBlender = Boolean(option("skip-blender", false));
  fs.mkdirSync(out, { recursive: true });
  console.log(`home models -> ${out} (work ${workDir()}, renders ${renders}, tmp ${os.tmpdir()})`);

  const sizes = {};
  const common = (name) => ({
    out,
    work: workDir(name),
    renders: path.join(renders, name),
    skipBlender,
  });
  const bakes = {};
  if (wanted.includes("silverbolt")) {
    const result = await buildSilverbolt(common("silverbolt"));
    sizes.silverbolt = result.bytes;
    bakes.silverbolt = result.bake;
  }
  if (wanted.includes("selena")) {
    const result = await buildSelena(common("selena"));
    sizes.selena = result.bytes;
    bakes.selena = result.bake;
  }
  if (wanted.includes("hand")) sizes.hand = (await buildHand(common("hand"))).bytes;
  if (wanted.includes("cameras")) {
    const models = {
      selena: path.join(out, "selena.glb"),
      silverbolt: path.join(out, "silverbolt.glb"),
    };
    for (const file of Object.values(models))
      if (!fs.existsSync(file)) fail(`the cameras are drawn with ${file}: build it first`);
    const result = await buildCameras({ ...common("cameras"), models });
    sizes.cameras = result.bytes;
    sizes.cameras_gzip = zlib.gzipSync(fs.readFileSync(result.file)).byteLength;
  }
  const characters = ["silverbolt", "selena", "hand"].filter((n) => wanted.includes(n));
  if (characters.length) {
    console.log("\nfinal files, loaded again:");
    for (const row of await checkFinal({ out, names: characters, bakes })) {
      console.log(
        `  ${row.name}: ${row.bytes} bytes, ${row.bones} bones, ${row.meshes} meshes, clips ${row.clips.join(", ")}`,
      );
      if (row.against) {
        console.log(
          `    against the owner's entrance.glb (Blender 5.1), three frames of every clip: worst ${row.against.worst.toFixed(4)} m (${row.against.where})`,
        );
      }
    }
  }
  console.log("\nsizes (bytes):");
  for (const [name, bytes] of Object.entries(sizes)) {
    const limit = BUDGET[name];
    console.log(
      `  ${name.padEnd(14)} ${String(bytes).padStart(9)}${limit ? `   budget ${limit}` : ""}`,
    );
    if (limit && bytes > limit) fail(`${name} is ${bytes} bytes, over the budget of ${limit}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
