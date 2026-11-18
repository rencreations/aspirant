// The camera of interaction_03 against the recording it was cut from.
//
// short-1.mkv (3840 by 1728, 60 fps) plays the idle pose for 5.9 s, then interaction_03, then the
// idle pose again. So video time = clip time + 5.9 s. The two finished GLBs and cameras.json are
// loaded in real Chrome, the clip is posed at a row of times, the baked camera is applied, the
// 16:9 frame is drawn and its bottom 80 percent (the recording's crop) is put beside the
// recording's own frame. Also measured here: when Silverbolt passes in front of the camera, and
// where the doll's anchor over Selena's right hand is.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { VIDEO_DIR, fail } from "../lib/env.mjs";
import { openStage, pngBytes } from "../lib/browser.mjs";
import { contactSheet } from "../lib/sheet.mjs";

export const VIDEO_OFFSET = 5.9;
/** The doll's anchor over her right hand (metres, in glTF space), found on the recording's frames. */
export const DOLL = {
  bone: "Bip001_R_Hand",
  hover: [-0.06, 0.27, 0],
  drift: [-0.38, 0.28, 0],
  from: 1.2,
  hold: 2.8,
  driftTo: 3.2,
  visible: [1.6, 3.4],
  // Read by eye from the recording's frames (times 1.6 to 3.2 s of the clip), in normalised device
  // coordinates of the 16:9 frame, give or take 0.03: the doll is a sprite in the game and drifts
  // in the picture rather than following the hand. The world recipe above is within about 0.3 m of
  // these; drive the doll from this table if it has to sit on the recording's pixels.
  screenNdc: [
    [1.6, -0.25, 0.41],
    [2.0, -0.36, 0.07],
    [2.4, -0.42, -0.04],
    [2.8, -0.3, 0.02],
    [3.2, -0.41, 0.16],
  ],
};
const MOMENTS = [0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0, 4.4, 5.0];

/** Browser side: camera of a clip at a time, by lerp and slerp between the 30 fps keys. */
function installCamera([cameras, doll]) {
  const T = window.stage.THREE;
  const camAt = (clip, t) => {
    const c = cameras.clips[clip];
    const stride = c.stride;
    const n = c.keys.length / stride;
    const x = Math.min(n - 1, Math.max(0, t * cameras.fps));
    const i = Math.floor(x);
    const j = Math.min(n - 1, i + 1);
    const f = x - i;
    const k = (a) => c.keys.slice(a * stride, a * stride + stride);
    const A = k(i);
    const B = k(j);
    const pos = [0, 1, 2].map((q) => A[q] + (B[q] - A[q]) * f);
    const qa = new T.Quaternion(A[3], A[4], A[5], A[6]);
    const qb = new T.Quaternion(B[3], B[4], B[5], B[6]);
    const q = qa.slerp(qb, f);
    return { pos, quaternion: [q.x, q.y, q.z, q.w] };
  };
  const lerp = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
  const dollAt = (t, hand) => {
    const f = Math.min(1, Math.max(0, (t - doll.hold) / (doll.driftTo - doll.hold)));
    const off = lerp(doll.hover, doll.drift, f * f * (3 - 2 * f));
    return hand.map((v, i) => v + off[i]);
  };
  window.cam = { camAt, dollAt };
}

export async function check({
  selenaGlb,
  silverboltGlb,
  cameras,
  renders,
  videoPath = path.join(VIDEO_DIR, "short-1.mkv"),
  quiet = false,
}) {
  fs.mkdirSync(renders, { recursive: true });
  const stage = await openStage({ sel: selenaGlb, sb: silverboltGlb });
  const { page } = stage;
  const log = (...a) => quiet || console.log("  [cameras]", ...a);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  try {
    await ev(async () => {
      await window.stage.load("sel", "/file/sel");
      await window.stage.load("sb", "/file/sb");
    });
    await ev(installCamera, [cameras, DOLL]);
    await ev(() => {
      window.stage.setBackground(0x6b7280);
      window.stage.useEnvironment(true);
      window.measureSel = window.stage.measureFor("sel");
      window.measureSb = window.stage.measureFor("sb");
    });
    const CLIP = "city_intercation03";
    const vfov = cameras.vfovDeg;
    const pose = (t) =>
      ev(
        ([t]) => {
          window.stage.pose("sel", "city_intercation03", t);
          window.stage.pose("sb", "city_intercation03", t);
          const hand = window.measureSel.headOf("Bip001_R_Hand").toArray();
          const head = window.measureSel.headOf("Bip001_Head").toArray();
          const she = window.measureSb.headOf("Bone02_She_01").toArray();
          const cam = window.cam.camAt("city_intercation03", t);
          return { hand, head, she, cam, doll: window.cam.dollAt(t, hand) };
        },
        [t],
      );

    // 1. Side by side with the recording.
    const haveVideo = fs.existsSync(videoPath);
    if (!haveVideo) log("the recording is not here, the side by side is skipped:", videoPath);
    const tiles = [];
    const frames = [];
    for (const t of MOMENTS) {
      const p = await pose(t);
      const marks = t >= DOLL.visible[0] && t <= DOLL.visible[1];
      await ev(
        ([doll, hand, marks]) => {
          window.stage.marker("doll", 0xff2a55, 0.06, marks ? doll : null);
          window.stage.marker("hand", 0x00e5ff, 0.012, hand);
        },
        [p.doll, p.hand, marks],
      );
      const full = pngBytes(
        await ev((o) => window.stage.shot(o), {
          width: 1280,
          height: 720,
          pos: p.cam.pos,
          quaternion: p.cam.quaternion,
          fov: vfov,
        }),
      );
      const crop = await sharp(full)
        .extract({ left: 0, top: 144, width: 1280, height: 576 })
        .png()
        .toBuffer();
      if (haveVideo) {
        const out = path.join(renders, `video-${t.toFixed(1)}.png`);
        const run = spawnSync("ffmpeg", [
          "-y",
          "-v",
          "error",
          "-ss",
          String(t + VIDEO_OFFSET),
          "-i",
          videoPath,
          "-frames:v",
          "1",
          "-vf",
          "scale=1280:576",
          out,
        ]);
        if (run.status !== 0) fail(`ffmpeg: ${run.stderr}`);
        tiles.push({
          png: fs.readFileSync(out),
          label: `recording ${(t + VIDEO_OFFSET).toFixed(1)} s = clip ${t.toFixed(1)} s`,
        });
      }
      tiles.push({
        png: crop,
        label: `three: clip ${t.toFixed(1)} s, camera key ${(t * cameras.fps).toFixed(1)}${marks ? " (red = doll anchor, cyan = right hand)" : ""}`,
      });
      frames.push(crop);
    }
    const perSheet = haveVideo ? 8 : 6;
    for (let s = 0; s * perSheet < tiles.length; s++) {
      const part = tiles.slice(s * perSheet, (s + 1) * perSheet);
      fs.writeFileSync(
        path.join(renders, `cameras-vs-recording-${s + 1}.png`),
        await contactSheet(part, { columns: 2, width: 640, height: 288 }),
      );
    }
    await ev(() => {
      window.stage.marker("doll", 0xff2a55, 0.06, null);
      window.stage.marker("hand", 0x00e5ff, 0.012, null);
    });

    // 2. Silverbolt's pass in front of the camera, every 1/48 s.
    const pass = await ev(
      ([vfov, aspect]) => {
        const T = window.stage.THREE;
        const rows = [];
        const duration = window.stage.models.sb.clips.city_intercation03.duration;
        for (let t = 0; t <= duration + 1e-9; t += 1 / 48) {
          window.stage.pose("sb", "city_intercation03", t);
          const she = window.measureSb.headOf("Bone02_She_01");
          const c = window.cam.camAt("city_intercation03", t);
          const cam = new T.PerspectiveCamera(vfov, aspect, 0.05, 100);
          cam.position.set(...c.pos);
          cam.quaternion.set(...c.quaternion);
          cam.updateMatrixWorld(true);
          const ndc = she.clone().project(cam);
          rows.push({ t, d: she.distanceTo(cam.position), x: ndc.x, y: ndc.y, behind: ndc.z > 1 });
        }
        return rows;
      },
      [vfov, 16 / 9],
    );
    const inFrame = pass.filter((r) => Math.abs(r.x) < 1 && Math.abs(r.y) < 1 && !r.behind);
    const closest = inFrame.reduce((a, r) => (r.d < a.d ? r : a), inFrame[0]);
    const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
    const leaveLeft = pass.find((r) => r.t > closest.t && r.x < -1);
    const silverbolt = {
      bone: "Bone02_She_01",
      firstInFrame: round(inFrame[0].t),
      closest: {
        t: round(closest.t),
        distance: round(closest.d),
        ndc: [round(closest.x), round(closest.y)],
      },
      leavesFrameLeft: leaveLeft ? round(leaveLeft.t) : null,
      note: "ndc is in the 16:9 frame (before the bottom 80 percent crop). The head is closest to the camera at `closest.t`; the hair whip that covers the cut is at about 4.0 s.",
    };
    log("Silverbolt", JSON.stringify(silverbolt));
    return { frames: tiles.length, silverbolt, doll: DOLL, videoOffsetSeconds: VIDEO_OFFSET };
  } finally {
    await stage.close();
  }
}
