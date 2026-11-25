// A first look at the two source files in Chrome with the site's three: where each form stands,
// which way she faces, and a picture of each at the first key of its idle. Writes into the work
// folder (sources-*.png) and prints the numbers. Read only on the sources.
import fs from "node:fs";
import path from "node:path";
import { ABYSSAL_GLB, NORMAL_GLB, workDir } from "../lib/env.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";

const out = workDir("probe");
const stage = await openStage({ "normal.glb": NORMAL_GLB, "abyssal.glb": ABYSSAL_GLB });
const { page } = stage;
try {
  const info = {
    normal: await page.evaluate(() => window.stage.load("normal", "/file/normal.glb")),
    abyssal: await page.evaluate(() => window.stage.load("abyssal", "/file/abyssal.glb")),
  };
  console.log(JSON.stringify(info, null, 1));
  const idle = {
    normal: "selena_silverbolt_raiko_in_game_fight_idle",
    abyssal: "selena_silverbolt_raiko_in_game_in_game_abyssal_form_fight_idle",
  };
  for (const name of ["normal", "abyssal"]) {
    const other = name === "normal" ? "abyssal" : "normal";
    await page.evaluate(
      ([a, b]) => {
        window.stage.show(a, null, true);
        window.stage.show(b, null, false);
      },
      [name, other],
    );
    for (const [label, clip, t] of [
      ["rest", null, 0],
      ["idle", idle[name], 0],
    ]) {
      const data = await page.evaluate(
        ([n, c, time]) => {
          window.stage.pose(n, c, time);
          return {
            box: window.stage.box(n),
            world: window.stage.world(n, [
              "Bip001 Pelvis",
              "Bip001 Head",
              "Bip001 L Foot",
              "Bip001 R Foot",
              "Bip001 L Hand",
              "Bip001 R Hand",
            ]),
          };
        },
        [name, clip, t],
      );
      console.log(name, label, JSON.stringify(data));
      for (const [view, pos] of [
        ["front", [0, 1.0, 4.5]],
        ["side", [4.5, 1.0, 0]],
        ["top", [0.01, 6, 0]],
      ]) {
        const png = await page.evaluate(
          (p) => window.stage.shot({ pos: p, target: [0, 0.9, 0], width: 400, height: 400 }),
          pos,
        );
        fs.writeFileSync(path.join(out, `sources-${name}-${label}-${view}.png`), pngBytes(png));
      }
    }
  }
} finally {
  await stage.close();
}
