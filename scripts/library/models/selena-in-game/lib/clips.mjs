// The clips: when a clip really stops moving, and the cuts that follow from it.

/** Largest change between two keys of one channel, in the channel's own units. */
function step(out, size, i) {
  let d = 0;
  for (let k = 0; k < size; k++)
    d = Math.max(d, Math.abs(out[i * size + k] - out[(i - 1) * size + k]));
  return d;
}

/**
 * When the clip stops moving: the time of the last key at which any channel still changes by
 * more than `eps` from the key before it. Returns { start, end, last, by } where `by` names the
 * channel that moves last.
 */
export function stillTail(animation, eps = 1e-4) {
  let start = Infinity;
  let last = -Infinity;
  let end = -Infinity;
  let by = null;
  for (const channel of animation.listChannels()) {
    const sampler = channel.getSampler();
    const input = sampler.getInput().getArray();
    const out = sampler.getOutput().getArray();
    const size = sampler.getOutput().getElementSize();
    const keys = input.length;
    start = Math.min(start, input[0]);
    last = Math.max(last, input[keys - 1]);
    let settle = input[0];
    // A cubic spline sampler stores three values a key; this pipeline never meets one.
    if (sampler.getInterpolation() === "CUBICSPLINE") throw new Error("cubic spline clip");
    for (let i = 1; i < keys; i++) if (step(out, size, i) > eps) settle = input[i];
    if (settle > end) {
      end = settle;
      by = `${channel.getTargetNode()?.getName()}.${channel.getTargetPath()}`;
    }
  }
  return { start, end, last, by };
}

/**
 * Cuts every channel of a clip to [from, to] (seconds) and moves it to start at 0. A key is
 * added at `to` (the value there, interpolated) when the channel has none. STEP and LINEAR
 * samplers only. Quaternions are interpolated linearly and normalised, as three does between
 * two keys that close.
 */
export function cutClip(doc, animation, from, to) {
  const done = new Set();
  for (const channel of animation.listChannels()) {
    const sampler = channel.getSampler();
    if (done.has(sampler)) continue;
    done.add(sampler);
    const input = sampler.getInput().getArray();
    const out = sampler.getOutput().getArray();
    const size = sampler.getOutput().getElementSize();
    const isQuat = channel.getTargetPath() === "rotation";
    const valueAt = (t) => {
      if (t <= input[0]) return Array.from(out.slice(0, size));
      if (t >= input[input.length - 1]) return Array.from(out.slice((input.length - 1) * size));
      let i = 1;
      while (input[i] < t) i++;
      const a = input[i - 1];
      const b = input[i];
      if (sampler.getInterpolation() === "STEP" && t < b)
        return Array.from(out.slice((i - 1) * size, i * size));
      const f = (t - a) / (b - a);
      const v = [];
      let dot = 0;
      for (let k = 0; k < size; k++) dot += out[(i - 1) * size + k] * out[i * size + k];
      const sign = isQuat && dot < 0 ? -1 : 1;
      for (let k = 0; k < size; k++)
        v.push(out[(i - 1) * size + k] * (1 - f) + sign * out[i * size + k] * f);
      if (isQuat) {
        const n = Math.hypot(...v);
        for (let k = 0; k < size; k++) v[k] /= n;
      }
      return v;
    };
    const times = [];
    const values = [];
    const near = (x, y) => Math.abs(x - y) < 1e-5;
    times.push(0);
    values.push(...valueAt(from));
    for (let i = 0; i < input.length; i++) {
      if (input[i] <= from + 1e-5 || input[i] >= to - 1e-5) continue;
      times.push(input[i] - from);
      values.push(...out.slice(i * size, (i + 1) * size));
    }
    if (!near(times[times.length - 1], to - from) && to - from > 1e-5) {
      times.push(to - from);
      values.push(...valueAt(to));
    }
    // Round the times to the 1/30 s grid when they lie on it (floating point drift from the shift).
    const grid = times.map((t) =>
      Math.abs(t * 30 - Math.round(t * 30)) < 1e-3 ? Math.round(t * 30) / 30 : t,
    );
    const newIn = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(grid));
    const newOut = doc
      .createAccessor()
      .setType(sampler.getOutput().getType())
      .setArray(new Float32Array(values));
    const oldIn = sampler.getInput();
    const oldOut = sampler.getOutput();
    sampler.setInput(newIn).setOutput(newOut);
    if (oldIn.listParents().length <= 1) oldIn.dispose();
    if (oldOut.listParents().length <= 1) oldOut.dispose();
  }
}

/**
 * How far the pose at `t` is from the pose at the first key: the largest turn of any rotation
 * channel (degrees) and the largest move of any translation channel (metres).
 */
export function seam(animation, t) {
  let turn = 0;
  let move = 0;
  for (const channel of animation.listChannels()) {
    const sampler = channel.getSampler();
    const input = sampler.getInput().getArray();
    const out = sampler.getOutput().getArray();
    const size = sampler.getOutput().getElementSize();
    let i = input.findIndex((x) => x >= t - 1e-5);
    if (i < 0) i = input.length - 1;
    const a = out.slice(0, size);
    const b = out.slice(i * size, (i + 1) * size);
    if (channel.getTargetPath() === "rotation") {
      const dot = Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]));
      turn = Math.max(turn, (2 * Math.acos(dot) * 180) / Math.PI);
    } else if (channel.getTargetPath() === "translation") {
      move = Math.max(move, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
  }
  return { turn, move };
}
