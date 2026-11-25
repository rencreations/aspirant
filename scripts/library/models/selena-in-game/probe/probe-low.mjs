// Which mesh and which joint holds the lowest point of a form at a time of a clip.
// Usage: node probe-low.mjs <built.glb> <form> <clip> <t> [t2 ...]
import { openStage } from "../lib/browser.mjs";
const [file, form, clip, ...times] = process.argv.slice(2);
const stage = await openStage({ "m.glb": file });
try {
  await stage.page.evaluate(() => window.stage.load("m", "/file/m.glb"));
  for (const t of times.map(Number)) {
    const r = await stage.page.evaluate(
      ([f, c, time]) => {
        const S = window.stage,
          M = S.models.m,
          T = S.THREE;
        const root = M.root.getObjectByName(f);
        const mixer = new T.AnimationMixer(root);
        const a = mixer.clipAction(M.clips[c], root);
        a.setLoop(T.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.play();
        a.time = time;
        mixer.update(0);
        M.root.updateMatrixWorld(true);
        const v = new T.Vector3();
        const out = [];
        root.traverse((o) => {
          if (!o.isSkinnedMesh) return;
          let low = Infinity,
            at = -1;
          const pos = o.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            v.fromBufferAttribute(pos, i);
            o.applyBoneTransform(i, v);
            v.applyMatrix4(o.matrixWorld);
            if (v.y < low) {
              low = v.y;
              at = i;
            }
          }
          const si = o.geometry.attributes.skinIndex,
            sw = o.geometry.attributes.skinWeight;
          const bones = [0, 1, 2, 3]
            .map((k) => [
              o.skeleton.bones[si.getComponent(at, k)]?.userData.name,
              +sw.getComponent(at, k).toFixed(2),
            ])
            .filter((b) => b[1] > 0);
          out.push([o.name, o.material.name, +low.toFixed(3), JSON.stringify(bones)]);
        });
        mixer.stopAllAction();
        mixer.uncacheRoot(root);
        return out;
      },
      [form, clip, t],
    );
    console.log(`t=${t}`);
    for (const row of r) console.log("  ", ...row);
  }
} finally {
  await stage.close();
}
