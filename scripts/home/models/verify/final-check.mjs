// The last look: every file the build wrote is loaded again, as the page loads it (the site's three,
// GLTFLoader, the meshopt decoder), and
//  - what the facts file says is compared with what the loader built;
//  - for Silverbolt and Selena, the clips are compared with a second opinion that does not come
//    from this build: the owner's own entrance.glb, exported by Blender 5.1 (its keys start at
//    1/24 s, so frame f of ours is its time (f + 1) / 24). The bake in blender/common.py is the
//    one thing the build cannot check against itself (the entrance file's actions are slotted and
//    a wrong evaluation would pass every comparison with its own numbers).
// Stops the build on any difference.
import fs from "node:fs";
import path from "node:path";
import { openStage } from "../lib/browser.mjs";
import { ENTRANCE_GLB, fail } from "../lib/env.mjs";

const REFERENCE_LIMIT = 0.006; // metres: the file is quantised and compressed, the reference is not
const sane = (name) => name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");

export async function check({ out, names, bakes = {} }) {
  const files = Object.fromEntries(names.map((n) => [n, path.join(out, `${n}.glb`)]));
  const reference = names.some((n) => bakes[n]) && fs.existsSync(ENTRANCE_GLB);
  if (reference) files.ref = ENTRANCE_GLB;
  else if (names.some((n) => bakes[n]))
    console.log("  [final] the entrance.glb is not here: the second opinion is skipped");
  const stage = await openStage(files);
  const rows = [];
  try {
    if (reference)
      await stage.page.evaluate(async () => await window.stage.load("ref", "/file/ref"));
    for (const name of names) {
      const info = await stage.page.evaluate(async (name) => {
        const r = await window.stage.load(name, `/file/${name}`);
        const home = r.extras.home;
        const M = window.stage.models[name];
        return {
          clips: r.clips,
          bones: r.bones,
          meshes: r.meshes,
          home: home
            ? {
                model: home.model,
                schema: home.schema,
                clips: Object.keys(home.clips ?? {}),
                bones: Object.keys(home.bones ?? {}).length,
              }
            : null,
          // after loading, the loader's materials are all plain Standard
          types: [...new Set(M.meshes.map((m) => m.material.type))],
        };
      }, name);
      if (!info.home) fail(`${name}.glb has no facts in its scene extras`);
      if (info.home.model !== name || info.home.schema !== 1)
        fail(`${name}.glb carries the facts of ${info.home.model}`);
      const loaded = info.clips.map((c) => c[0]).sort();
      const stated = info.home.clips.slice().sort();
      if (JSON.stringify(loaded) !== JSON.stringify(stated))
        fail(`${name}: the loader has clips ${loaded}, the facts say ${stated}`);
      if (info.home.bones !== info.bones)
        fail(`${name}: ${info.bones} bones loaded, ${info.home.bones} in the facts`);
      if (info.types.some((t) => t !== "MeshStandardMaterial"))
        fail(`${name}: the loader built ${info.types}`);
      const written = JSON.parse(fs.readFileSync(path.join(out, `${name}.facts.json`), "utf8"));
      if (written.model !== name || Object.keys(written.clips).length !== stated.length)
        fail(`${name}.facts.json and the facts in the file differ`);

      let against = null;
      if (reference && bakes[name])
        against = await compareWithEntrance(stage.page, name, bakes[name]);
      rows.push({
        name,
        bytes: fs.statSync(files[name]).size,
        clips: loaded,
        bones: info.bones,
        meshes: info.meshes.length,
        against,
      });
    }
  } finally {
    await stage.close();
  }
  return rows;
}

/** Bone heads of the finished file against the entrance.glb at three frames of every clip. */
async function compareWithEntrance(page, name, bake) {
  const bones = bake.bones.map((b) => [b, sane(b)]);
  let worst = 0;
  let where = null;
  for (const [clip, data] of Object.entries(bake.clips)) {
    // The last key of a loop is made equal to the first one here: look at the one before it.
    const frames = [0, Math.floor(data.frames / 2), data.frames - 2];
    for (const f of frames) {
      const got = await page.evaluate(
        ([name, clip, f, bones]) => {
          const S = window.stage;
          const heads = (model) => {
            const out = {};
            for (const [, three] of bones) {
              const bone = S.models[model].bones[three];
              if (bone) out[three] = S.worldOf(model, three);
            }
            return out;
          };
          S.pose(name, `city_${clip}`, f / 24);
          const ours = heads(name);
          S.pose("ref", `selena_silverbolt_raiko_entrance_city_${clip}`, (f + 1) / 24);
          const theirs = heads("ref");
          return { ours, theirs };
        },
        [name, clip, f, bones],
      );
      for (const [, three] of bones) {
        // The two eye bones are ours: the entrance file has no such bones.
        if (three.startsWith("sb_")) continue;
        const a = got.ours[three];
        const b = got.theirs[three];
        if (!a || !b)
          fail(`${name}: bone ${three} is missing in ${a ? "the entrance file" : "our file"}`);
        const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (d > worst) {
          worst = d;
          where = `${clip} frame ${f} ${three}`;
        }
        if (d > REFERENCE_LIMIT)
          fail(`${name}: ${clip} frame ${f}: ${three} is ${d.toFixed(4)} m from the entrance.glb`);
      }
    }
  }
  return { worst, where };
}
