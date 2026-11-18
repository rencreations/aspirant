// Finger axes, measured in three on the finished model (never assumed from Blender's bone frames).
//
// For each finger chain the base bone is turned a little about each of its own axes, both ways,
// and the claw tip is followed: the axis that moves the tip toward the palm is the flexion axis
// (sign included); the axis that moves it toward the thumb side is the spread axis. The result
// is in the bone's own frame, so an actor applies it as `bone.quaternion.multiply(q)` after the
// mixer has run.

/** Chains of one hand: five fingers of three bones, thumb first. */
export function handChains(prefix) {
  const f = (n, ...rest) => [`${prefix}${n}`, ...rest.map((r) => `${prefix}${r}`)];
  return {
    thumb: f("Finger0", "Finger01", "Finger02"),
    index: f("Finger1", "Finger11", "Finger12"),
    middle: f("Finger2", "Finger21", "Finger22"),
    ring: f("Finger3", "Finger31", "Finger32"),
    pinky: f("Finger4", "Finger41", "Finger42"),
  };
}

/**
 * Runs in Node, drives the page. `model`: the stage name. `chains`: from handChains (three's
 * sanitised bone names). `palm`: world direction of the palm normal at rest (unit). `meshFilter`
 * is a source string of a function (mesh) => boolean, to look only at the glove if you need to.
 */
export async function measureFingers(
  page,
  { model = "m", chains, palm, thumbSide = null, restPose = () => {} },
) {
  void restPose;
  return page.evaluate(
    ([model, chains, palm, thumbSide]) => {
      const m = window.stage.measureFor(model);
      const { T } = m;
      const out = {};
      const palmN = new T.Vector3(...palm).normalize();
      const angle = 0.25;
      const axes = {
        "+X": [1, 0, 0],
        "-X": [-1, 0, 0],
        "+Y": [0, 1, 0],
        "-Y": [0, -1, 0],
        "+Z": [0, 0, 1],
        "-Z": [0, 0, -1],
      };
      // The thumb side: from the middle of the four fingers' tips toward the thumb's tip.
      const tipOf = (chain) => {
        const pts = chain.flatMap((b) => m.pointsOf(b, 0.5));
        const head = m.headOf(chain[0]);
        let best = 0;
        pts.forEach((p, i) => {
          if (p.distanceTo(head) > pts[best].distanceTo(head)) best = i;
        });
        return { pts, best, head };
      };
      m.reset();
      const rest = Object.fromEntries(
        Object.entries(chains).map(([finger, chain]) => {
          const t = tipOf(chain);
          return [finger, t.pts.length ? t.pts[t.best].clone() : null];
        }),
      );
      const others = ["index", "middle", "ring", "pinky"].map((f) => rest[f]).filter(Boolean);
      const mean = others
        .reduce((a, p) => a.add(p), new T.Vector3())
        .multiplyScalar(1 / Math.max(1, others.length));
      let sideDir = thumbSide
        ? new T.Vector3(...thumbSide)
        : rest.thumb
          ? rest.thumb.clone().sub(mean)
          : new T.Vector3(1, 0, 0);
      sideDir.addScaledVector(palmN, -sideDir.dot(palmN)).normalize();
      for (const [finger, chain] of Object.entries(chains)) {
        m.reset();
        const { pts, best } = tipOf(chain);
        if (!pts.length) {
          out[finger] = { chain, error: "no vertices" };
          continue;
        }
        const tip0 = pts[best].clone();
        const trials = {};
        for (const [label, axis] of Object.entries(axes)) {
          m.reset();
          m.M.bones[chain[0]].rotateOnAxis(new T.Vector3(...axis), angle);
          m.M.root.updateMatrixWorld(true);
          const moved = chain.flatMap((b) => m.pointsOf(b, 0.5));
          trials[label] = moved[best].clone().sub(tip0);
        }
        m.reset();
        // Flexion: the trial that moves the tip most toward the palm.
        let flex = null;
        for (const [label, d] of Object.entries(trials)) {
          const score = d.dot(palmN);
          if (!flex || score > flex.score) flex = { label, score };
        }
        // Spread: of the other two axes, the one that moves the tip most sideways.
        const side = sideDir;
        let spread = null;
        for (const [label, d] of Object.entries(trials)) {
          if (label[1] === flex.label[1]) continue;
          const score = d.dot(side);
          if (!spread || score > spread.score) spread = { label, score };
        }
        out[finger] = {
          chain,
          flexAxisLocal: axes[flex.label],
          flexMovesTipBy: +flex.score.toFixed(4),
          spreadAxisLocal: spread ? axes[spread.label] : null,
          note: "a positive angle about flexAxisLocal curls the finger toward the palm; apply it to every bone of the chain",
        };
      }
      m.reset();
      return out;
    },
    [model, chains, palm, thumbSide],
  );
}
