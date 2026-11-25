// Renders frames of the built In Game file: each frame names, for each form, a clip and a time
// (or a crossfade of two clips) and whether the form is shown. The camera is fixed.
import { pngBytes } from "./browser.mjs";

/** The fixed three quarter camera of the sheets: front left of her, a little above. */
export const THREE_QUARTER = { pos: [2.3, 1.75, 3.9], target: [0, 1.1, 0], fov: 38 };

/**
 * frames: [{ label, normal?: pose, abyssal?: pose }], pose = { clip, t } or
 * { clip, t, mix: { clip, t, w } } (w = weight of the second clip). A form with no pose is hidden.
 */
export async function renderFrames(
  page,
  frames,
  { camera = THREE_QUARTER, width = 360, height = 400, model = "m" } = {},
) {
  const out = [];
  for (const frame of frames) {
    const png = await page.evaluate(
      ([f, cam, w, h, m]) => {
        const S = window.stage;
        const M = S.models[m];
        const roots = {
          normal: M.root.getObjectByName("normal"),
          abyssal: M.root.getObjectByName("abyssal"),
        };
        // One mixer per form root, so each form keeps its own pose.
        M.mixers ??= {
          normal: new S.THREE.AnimationMixer(roots.normal),
          abyssal: new S.THREE.AnimationMixer(roots.abyssal),
        };
        for (const form of ["normal", "abyssal"]) {
          const pose = f[form];
          roots[form].visible = !!pose;
          if (!pose) continue;
          const mixer = M.mixers[form];
          mixer.stopAllAction();
          const play = (clip, t, weight) => {
            const action = mixer.clipAction(M.clips[clip], roots[form]);
            action.setLoop(S.THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.reset().play();
            action.setEffectiveWeight(weight);
            action.time = Math.min(t, M.clips[clip].duration);
          };
          play(pose.clip, pose.t, pose.mix ? 1 - pose.mix.w : 1);
          if (pose.mix) play(pose.mix.clip, pose.mix.t, pose.mix.w);
          mixer.update(0);
        }
        M.root.updateMatrixWorld(true);
        return S.shot({ ...cam, width: w, height: h });
      },
      [frame, camera, width, height, model],
    );
    out.push({ png: pngBytes(png), label: frame.label, color: frame.color });
  }
  return out;
}
