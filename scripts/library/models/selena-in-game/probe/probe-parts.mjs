// Each mesh (each primitive) of a source alone, at the first key of the idle, from the front and
// the back, on a light and a magenta ground (a black or untextured part shows at once).
// Usage: node probe-parts.mjs normal|abyssal
import fs from "node:fs";
import path from "node:path";
import { ABYSSAL_GLB, NORMAL_GLB, workDir } from "../lib/env.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const which = process.argv[2] ?? "abyssal";
const file = which === "normal" ? NORMAL_GLB : ABYSSAL_GLB;
const idle =
  which === "normal"
    ? "selena_silverbolt_raiko_in_game_fight_idle"
    : "selena_silverbolt_raiko_in_game_in_game_abyssal_form_fight_idle";
const out = workDir("probe");
const stage = await openStage({ "m.glb": file });
const { page } = stage;
try {
  await page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  const count = await page.evaluate((clip) => {
    window.stage.pose("m", clip, 0);
    return window.stage.models.m.meshes.length;
  }, idle);
  const tiles = [];
  for (let i = -1; i < count; i++) {
    const label = await page.evaluate((k) => {
      const ms = window.stage.models.m.meshes;
      ms.forEach((m, j) => (m.visible = k < 0 || j === k));
      return k < 0 ? "all" : `${ms[k].name} | ${ms[k].material.name}`;
    }, i);
    for (const [bg, pos] of [
      [0xe9e7e2, [0.6, 1.3, 3.6]],
      [0xff00ff, [-0.6, 1.3, -3.6]],
    ]) {
      const png = await page.evaluate(
        ([b, p]) => {
          window.stage.setBackground(b);
          return window.stage.shot({ pos: p, target: [0.1, 1.05, 0], width: 520, height: 520 });
        },
        [bg, pos],
      );
      tiles.push({ png: pngBytes(png), label: `${label} ${bg === 0xff00ff ? "back" : "front"}` });
    }
  }
  fs.writeFileSync(
    path.join(out, `parts-${which}.png`),
    await contactSheet(tiles, { columns: 4, width: 420, height: 420 }),
  );
} finally {
  await stage.close();
}
