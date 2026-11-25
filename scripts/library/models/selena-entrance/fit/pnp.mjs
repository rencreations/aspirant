// Fitting aid: the recording's camera at frames of a clip, solved from our renders (fit/pnp.py).
//
//   node fit/pnp.mjs JOB.json
//
// JOB: { clip, video, pairs: [[clipTime, videoTime], ...], fit (fits.json entry used as the
//        first guess), out, rounds (2: the second round renders through the first answer),
//        width (960), fixFov (hold the field of view), start ({ clipTime: camera } first guesses),
//        chain (each frame starts from the last answer: true moves it by the game's own motion
//        between the two times, "hold" keeps it) }
// Writes OUT/result.json: per pair the solved camera { t, video, p, q, vfov, inliers, rms960 }
// (or why it failed), and OUT/sheet.png: the recording | ours through the solved camera | 50
// percent | our outline on the recording.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compose, fittedAt, gameAt, invert, readFits } from "../cameras.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { onGround, outline, overlay, raw, toPng } from "../lib/compose.mjs";
import { HERE, WORK, readJson, writeWhole } from "../lib/env.mjs";
import { contactSheet } from "../lib/sheet.mjs";
import { frame } from "../lib/video.mjs";

const PYTHON = process.env.PYTHON ?? "C:\\Users\\muham\\anaconda3\\python.exe";

export async function solveFrames(job) {
  const width = job.width ?? 960;
  const height = Math.round(width / (3840 / 1728));
  fs.mkdirSync(job.out, { recursive: true });
  const file = job.file ?? path.join(WORK, "work", "model.glb");
  const stage = await openStage({ model: file });
  const { page } = stage;
  const bake = readJson(path.join(WORK, "work", "cameras.game.json"));
  const fit = job.fit === undefined ? readFits().clips[job.clip] : job.fit;
  const results = [];
  const tiles = [];
  try {
    await page.evaluate(async () => {
      await window.stage.load("m", "/file/model");
      window.stage.look("m", "unlit");
      window.stage.setBackground(null);
    });
    let previous = null;
    for (const [ct, vt] of job.pairs) {
      let cam = job.start?.[String(ct)] ?? fittedAt(fit, bake.clips[job.clip], ct);
      // chained: the last answer moved by the game's own motion between the two times
      if (job.chain && previous?.answer?.ok) {
        const game = bake.clips[job.clip];
        const step =
          job.chain === "hold"
            ? { p: [0, 0, 0], q: [0, 0, 0, 1] }
            : compose(invert(gameAt(game, previous.t)), gameAt(game, ct));
        const moved = compose({ p: previous.answer.p, q: previous.answer.q }, step);
        cam = { ...moved, vfov: previous.answer.vfov };
      }
      const videoPng = frame(job.video, vt, width);
      const videoFile = path.join(job.out, `video-${vt.toFixed(3)}.png`);
      fs.writeFileSync(videoFile, videoPng);
      let answer = null;
      for (let round = 0; round < (job.rounds ?? 2); round++) {
        const shot = await page.evaluate(
          ({ clip, ct, cam, width, height }) => {
            window.stage.pose("m", clip, ct);
            const png = window.stage.shot({
              width,
              height,
              pos: cam.p,
              quaternion: cam.q,
              vfov: cam.vfov,
            });
            return { png, pos: window.stage.positions("m") };
          },
          { clip: job.clip, ct, cam, width, height },
        );
        const renderFile = path.join(job.out, `render-${ct.toFixed(4)}.png`);
        const posFile = path.join(job.out, `pos-${ct.toFixed(4)}.bin`);
        fs.writeFileSync(renderFile, pngBytes(shot.png));
        fs.writeFileSync(posFile, Buffer.from(shot.pos.data, "base64"));
        const run = spawnSync(
          PYTHON,
          [
            "-I",
            path.join(HERE, "fit", "pnp.py"),
            renderFile,
            posFile,
            videoFile,
            String(job.fixFov ?? cam.vfov),
            ...(job.fixFov ? ["fixed"] : []),
          ],
          { encoding: "utf8" },
        );
        const line = run.stdout.trim().split("\n").pop();
        let solved;
        try {
          solved = JSON.parse(line);
        } catch {
          solved = { ok: false, why: run.stderr.slice(-300) };
        }
        // A solve from a few points, or one that leaps away from where it started, is a false one.
        if (solved.ok && solved.inliers < (job.minInliers ?? 20))
          solved = { ok: false, why: `${solved.inliers} inliers` };
        if (solved.ok && Math.hypot(...solved.p.map((v, k) => v - cam.p[k])) > (job.maxJump ?? 0.2))
          solved = { ok: false, why: "jumped" };
        if (!solved.ok) {
          answer = answer ?? { ok: false, why: solved.why };
          break;
        }
        answer = solved;
        cam = { p: solved.p, q: solved.q, vfov: solved.vfov };
      }
      results.push({ t: ct, video: vt, ...answer });
      if (answer?.ok) previous = { t: ct, answer };
      console.log(JSON.stringify({ t: ct, video: vt, ...answer }));
      // the sheet row through the final camera
      const png = await page.evaluate(
        ({ clip, ct, cam, width, height }) => {
          window.stage.pose("m", clip, ct);
          return window.stage.shot({
            width,
            height,
            pos: cam.p,
            quaternion: cam.q,
            vfov: cam.vfov,
          });
        },
        { clip: job.clip, ct, cam, width, height },
      );
      const W = 480;
      const H = 216;
      const ours = await raw(pngBytes(png), W, H);
      const video = await raw(videoPng, W, H);
      const tag = answer?.ok
        ? `${answer.inliers} pts, ${answer.rms960} px`
        : `failed: ${answer?.why}`;
      tiles.push({ png: await toPng(video), label: `${job.video}.mkv ${vt.toFixed(2)} s` });
      tiles.push({
        png: await toPng(onGround(ours)),
        label: `ours ${job.clip} ${ct.toFixed(3)} s (${tag})`,
      });
      tiles.push({ png: await toPng(overlay(video, ours)), label: "50 percent" });
      tiles.push({ png: await toPng(outline(video, ours)), label: "our outline on the recording" });
    }
  } finally {
    await stage.close();
  }
  writeWhole(path.join(job.out, "result.json"), JSON.stringify(results, null, 1));
  writeWhole(
    path.join(job.out, "sheet.png"),
    await contactSheet(tiles, { columns: 4, width: 480, height: 216 }),
  );
  return results;
}

if (process.argv[1] && path.basename(process.argv[1]) === "pnp.mjs") {
  await solveFrames(readJson(process.argv[2]));
}
