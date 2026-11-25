// Frame sheets of the built In Game file, rendered in real Chrome with the site's three
// (GLTFLoader and the meshopt decoder), from a fixed three quarter camera.
//   change-to-abyssal.png  normal idle, the blend into normal/to-abyssal, the swap at hideAt,
//                          abyssal/from-normal from secondFrom, the blend into the abyssal idle
//   change-to-normal.png   the same the other way
//   seam-<change>.png      30 frames a second around the swap, with the front view
//   clips-normal.png, clips-abyssal.png   every clip at four times
// Usage: node sheets.mjs [file.glb] [--out DIR] [--tag NAME]
import fs from "node:fs";
import path from "node:path";
import { OUT, WORK } from "./lib/env.mjs";
import { openStage } from "./lib/browser.mjs";
import { renderFrames } from "./lib/frames.mjs";
import { contactSheet } from "./lib/sheet.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const file =
  process.argv[2] && !process.argv[2].startsWith("--")
    ? process.argv[2]
    : path.join(OUT, "selena-in-game.glb");
const outDir = arg("out", WORK);
const tag = arg("tag", "");
fs.mkdirSync(outDir, { recursive: true });
const FRONT = { pos: [0, 1.3, 4.6], target: [0, 1.15, 0], fov: 38 };

/** The room's blend: `seconds` long crossfade, linear weights. */
const BLEND = 0.15;

function changeFrames(forms, d, key, fps) {
  const c = forms[key];
  const [a, b] = key === "toAbyssal" ? ["normal", "abyssal"] : ["abyssal", "normal"];
  const idleA = `${a}/idle`;
  const idleB = `${b}/idle`;
  const frames = [];
  const dt = 1 / fps;
  let clock = 0;
  const push = (label, pose, color) => {
    frames.push({ label: `${clock.toFixed(2)} ${label}`, ...pose, color });
    clock += dt;
  };
  // 1. The idle of the first form, one loop.
  for (let t = 0; t < d[idleA] - 1e-6; t += dt)
    push(`${idleA} ${t.toFixed(3)}`, { [a]: { clip: idleA, t } });
  const idleEnd = d[idleA];
  // 2. The idle blends into the first transform clip, which starts at 0.
  for (let t = 0; t < BLEND - 1e-6; t += dt)
    push(`blend ${c.first} ${t.toFixed(3)}`, {
      [a]: { clip: idleA, t: (idleEnd + t) % d[idleA], mix: { clip: c.first, t, w: t / BLEND } },
    });
  // 3. The first clip until hideAt.
  for (let t = BLEND; t <= c.hideAt + 1e-6; t += dt)
    push(`${c.first} ${t.toFixed(3)}`, { [a]: { clip: c.first, t } }, "#ffd866");
  // 4. The swap: the second form, from secondFrom, the first form hidden.
  const start = c.secondFrom;
  for (let s = start; s < d[c.second] - BLEND - 1e-6; s += dt)
    push(`${c.second} ${s.toFixed(3)}`, { [b]: { clip: c.second, t: s } }, "#7fd7ff");
  // 5. The second clip's last part blends into the second form's idle.
  const blendFrom = d[c.second] - BLEND;
  for (let t = 0; t < BLEND - 1e-6; t += dt)
    push(
      `blend ${idleB} ${t.toFixed(3)}`,
      {
        [b]: { clip: c.second, t: blendFrom + t, mix: { clip: idleB, t, w: t / BLEND } },
      },
      "#7fd7ff",
    );
  // 6. The idle of the second form, one loop.
  for (let t = BLEND; t < d[idleB] + BLEND - 1e-6; t += dt)
    push(`${idleB} ${(t % d[idleB]).toFixed(3)}`, { [b]: { clip: idleB, t: t % d[idleB] } });
  return frames;
}

function seamFrames(forms, d, key) {
  const c = forms[key];
  const [a, b] = key === "toAbyssal" ? ["normal", "abyssal"] : ["abyssal", "normal"];
  const frames = [];
  for (let i = 0; i * (1 / 30) <= c.hideAt + 1e-6; i++)
    frames.push({
      label: `${c.first} ${(i / 30).toFixed(3)}`,
      [a]: { clip: c.first, t: i / 30 },
      color: "#ffd866",
    });
  for (let s = c.secondFrom; s <= d[c.second] + 1e-6; s += 1 / 30)
    frames.push({
      label: `${c.second} ${s.toFixed(3)}`,
      [b]: { clip: c.second, t: s },
      color: "#7fd7ff",
    });
  return frames;
}

const stage = await openStage({ "m.glb": file });
try {
  const info = await stage.page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  const d = Object.fromEntries(info.clips.map(([n, dur]) => [n, dur]));
  const forms = info.extras.forms;
  if (!forms) throw new Error("no extras.forms in the file");
  const written = [];
  const write = async (name, tiles, opts) => {
    const target = path.join(outDir, `${name}${tag}.png`);
    fs.writeFileSync(target, await contactSheet(tiles, opts));
    written.push(target);
  };
  for (const [key, name] of [
    ["toAbyssal", "change-to-abyssal"],
    ["toNormal", "change-to-normal"],
  ]) {
    const c = forms[key];
    const title = `${key}: ${c.first} to hideAt ${c.hideAt}, then ${c.second} from ${c.secondFrom}${c.carry ? `, carry ${c.carry} over ${c.carryFor} s` : ""} (12 fps, blends ${BLEND} s)`;
    const tiles = await renderFrames(stage.page, changeFrames(forms, d, key, 12), {
      width: 300,
      height: 340,
    });
    await write(name, tiles, { columns: 8, width: 240, height: 272, title });
    const seam = seamFrames(forms, d, key);
    const three = await renderFrames(stage.page, seam, { width: 300, height: 340 });
    const front = await renderFrames(stage.page, seam, { width: 300, height: 340, camera: FRONT });
    const both = three.flatMap((t, i) => [t, { ...front[i], label: `${front[i].label} front` }]);
    await write(`seam-${name.replace("change-", "")}`, both, {
      columns: 8,
      width: 200,
      height: 226,
      title: `${title.split(" (")[0]} (30 fps, three quarter and front)`,
    });
  }
  for (const form of ["normal", "abyssal"]) {
    const frames = [];
    for (const [clip, dur] of info.clips.filter(([n]) => n.startsWith(`${form}/`)))
      for (const f of [0, 1 / 3, 2 / 3, 1])
        frames.push({
          label: `${clip} ${(dur * f).toFixed(3)}/${dur.toFixed(3)}`,
          [form]: { clip, t: dur * f },
        });
    const tiles = await renderFrames(stage.page, frames, {
      width: 300,
      height: 340,
      camera: { pos: [2.8, 2.0, 4.8], target: [0, 1.0, 0], fov: 40 },
    });
    await write(`clips-${form}`, tiles, {
      columns: 8,
      width: 200,
      height: 226,
      title: `every ${form} clip at 0, 1/3, 2/3 and its end`,
    });
  }
  console.log(written.join("\n"));
} finally {
  await stage.close();
}
