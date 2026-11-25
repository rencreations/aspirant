// Every frame (30 a second) of the four transform clips of the built file, one sheet a change:
// the first clip until its form is sent under the ground, then the second clip from its start.
// Used to choose hideAt and secondFrom. Usage: node probe-candidates.mjs <built.glb>
import fs from "node:fs";
import path from "node:path";
import { workDir } from "../lib/env.mjs";
import { openStage } from "../lib/browser.mjs";
import { renderFrames } from "../lib/frames.mjs";
import { contactSheet } from "../lib/sheet.mjs";

const file = process.argv[2];
const out = workDir("probe");
const stage = await openStage({ "m.glb": file });
try {
  const info = await stage.page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  const d = Object.fromEntries(info.clips.map(([n, dur]) => [n, dur]));
  for (const [name, firstForm, first, secondForm, second] of [
    ["to-abyssal", "normal", "normal/to-abyssal", "abyssal", "abyssal/from-normal"],
    ["to-normal", "abyssal", "abyssal/to-normal", "normal", "normal/from-abyssal"],
  ]) {
    const frames = [];
    for (let i = 0; i * (1 / 30) <= d[first] + 1e-6; i++)
      frames.push({
        label: `${first} ${(i / 30).toFixed(3)}`,
        [firstForm]: { clip: first, t: i / 30 },
      });
    for (let i = 0; i * (1 / 30) <= d[second] + 1e-6; i++)
      frames.push({
        label: `${second} ${(i / 30).toFixed(3)}`,
        [secondForm]: { clip: second, t: i / 30 },
        color: "#7fd7ff",
      });
    const tiles = await renderFrames(stage.page, frames, { width: 300, height: 340 });
    fs.writeFileSync(
      path.join(out, `candidates-${name}.png`),
      await contactSheet(tiles, { columns: 8, width: 240, height: 272 }),
    );
  }
} finally {
  await stage.close();
}
