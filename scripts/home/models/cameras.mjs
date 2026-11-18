// The camera clips: baked in Blender, written as a small JSON, checked against the recording.
import fs from "node:fs";
import path from "node:path";
import { check } from "./verify/cameras-check.mjs";
import { pretty, writeFacts } from "./lib/facts.mjs";
import { runBlender, workDir, writeWhole } from "./lib/env.mjs";

const NAME = "cameras";

/**
 * `models`: the finished GLBs { selena, silverbolt } to draw with. Returns the file's bytes (and the
 * gzip size, which is what the site pays) and the facts.
 */
export async function build({ out, work, renders, models, skipBlender = false } = {}) {
  work ??= workDir(NAME);
  if (!skipBlender) runBlender("cameras.py", { work });
  const raw = JSON.parse(fs.readFileSync(path.join(work, "cameras.raw.json"), "utf8"));
  const file = path.join(out ?? path.join(work, "out"), `${NAME}.json`);
  writeWhole(file, await pretty(JSON.stringify(raw)));

  const checked = await check({
    selenaGlb: models.selena,
    silverboltGlb: models.silverbolt,
    cameras: raw,
    renders: renders ?? path.join(work, "renders"),
  });
  const clips = Object.fromEntries(
    Object.entries(raw.clips).map(([name, c]) => [
      name,
      { frames: c.frames, duration: c.duration, static: c.static, keys: c.keys.length / c.stride },
    ]),
  );
  const facts = {
    model: NAME,
    schema: 1,
    space:
      "glTF world, the same as selena.glb and silverbolt.glb: metres, Y up, the camera looks down its own -Z.",
    file: "cameras.json: { fps, vfovDeg, clips: { <bone clip name>: { frames, duration, static, stride: 7, keys: flat [px, py, pz, qx, qy, qz, qw, ...] } } }. A static clip has one key.",
    time: "key i is at i / 30 s, the bone clip's own time. Interpolate with lerp for the position and slerp for the quaternion.",
    frame: {
      vfovDeg: raw.vfovDeg,
      aspect: "16 / 9",
      note: "The game reads the 30 mm lens on the 36 mm sensor as the VERTICAL field of view of a 16:9 frame (this is what matches the recording). The recording shows the bottom 80 percent of that frame (3840 by 1728, aspect 2.222). For a canvas of W by H at that aspect: camera.aspect = W / (1.25 * H); camera.fov = vfovDeg; camera.setViewOffset(W, 1.25 * H, 0, 0.25 * H, W, H). For any other canvas decide the crop yourself; the vertical field of view is what the clips were made for.",
    },
    match: {
      method:
        "twelve moments of interaction_03 drawn with the baked camera next to the recording (short-1.mkv, video time = clip time + 5.9 s): cameras-vs-recording-1..3.png.",
      verdict:
        "From 1.0 s to 3.2 s Selena, the framing, the arm and Silverbolt's head agree with the recording within about 10 percent of the frame. At 0 to 0.3 s the lying pose and the framing agree. From 0.4 s to 0.9 s the recording lags the clip by about 0.2 s (the hair whips and the rise are slower there). After 3.4 s the recording keeps Silverbolt higher and farther away while the clip swings it down and toward the camera (the pass below), and after 4.4 s the recording lags the clip by about 0.4 s. The owner asks for that last part to be changed anyway.",
      goodFrom: 1.0,
      goodTo: 3.2,
    },
    usage: {
      interaction_03:
        "use the baked camera: it matches the recording (cameras-vs-recording-*.png) in the range of match.goodFrom to goodTo.",
      loops:
        "the baked cameras of the loops are static and about 1.7 times tighter than the recording; use your own camera for hands_to_mouth_loop, hands_to_mouth_release and idle.",
    },
    clips,
    videoOffsetSeconds: checked.videoOffsetSeconds,
    interaction_03: {
      silverboltPass: checked.silverbolt,
      dollAnchor: {
        ...checked.doll,
        note: "In three space: doll = world position of `bone` + hover, from `from` to `hold` seconds, then blended smoothly to + drift by `driftTo`. The doll is a flat sprite in the game, about 12 cm tall, red glow. It shows from visible[0] to visible[1].",
      },
    },
  };
  await writeFacts(path.join(path.dirname(file), `${NAME}.facts.json`), facts);
  const bytes = fs.statSync(file).size;
  console.log(NAME, "bytes", bytes);
  return { file, bytes, facts };
}
