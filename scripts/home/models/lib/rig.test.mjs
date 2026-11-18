// Tests of the pure rig and clip code. Run with: node --test scripts/home/models/
// (`pnpm check` does not run them; the Python helpers in blender/ are covered by the asserts of the build.)
import assert from "node:assert/strict";
import test from "node:test";
import { Document } from "@gltf-transform/core";
import { buildAnimations, restWorld, rowToMatrix } from "./rig.mjs";

const rest = (x, y, z) => [x, y, z, 0, 0, 0, 1, 1, 1, 1];

test("rowToMatrix: translation, rotation and scale land where compose puts them", () => {
  const half = Math.SQRT1_2;
  const m = rowToMatrix([1, 2, 3, 0, 0, half, half, 2, 2, 2]); // a quarter turn about Z, scale 2
  const e = m.elements;
  assert.deepEqual([e[12], e[13], e[14]], [1, 2, 3]);
  assert.ok(
    Math.abs(e[0]) < 1e-9 && Math.abs(e[1] - 2) < 1e-9,
    "x axis points along +Y, scaled by 2",
  );
  assert.ok(
    Math.abs(e[4] + 2) < 1e-9 && Math.abs(e[5]) < 1e-9,
    "y axis points along -X, scaled by 2",
  );
});

test("restWorld: a child sits at its parent's place plus its own offset", () => {
  const bake = {
    bones: ["a", "b", "c"],
    parent: { a: null, b: "a", c: "b" },
    restLocal: { a: rest(1, 0, 0), b: rest(0, 2, 0), c: rest(0, 0, 3) },
  };
  const world = restWorld(bake);
  const at = (name) => [
    world.get(name).elements[12],
    world.get(name).elements[13],
    world.get(name).elements[14],
  ];
  assert.deepEqual(at("a"), [1, 0, 0]);
  assert.deepEqual(at("b"), [1, 2, 0]);
  assert.deepEqual(at("c"), [1, 2, 3]);
});

/** A document with two bones under one scene, and a bake of `frames` frames. */
function tiny(frames, move) {
  const doc = new Document();
  const scene = doc.createScene();
  const a = doc.createNode("a").setTranslation([0, 0, 0]);
  const b = doc.createNode("b").setTranslation([0, 1, 0]);
  a.addChild(b);
  scene.addChild(a);
  const track = (x) => {
    const out = [];
    for (let f = 0; f < frames; f++) out.push(...rest(move ? x(f) : 0, 0, 0));
    return out;
  };
  const bake = {
    fps: 24,
    bones: ["a", "b"],
    parent: { a: null, b: "a" },
    restLocal: { a: rest(0, 0, 0), b: rest(0, 1, 0) },
    clips: {
      go: {
        frames,
        tracks: {
          a: track((f) => f * 0.1),
          b: Array.from({ length: frames }, () => rest(0, 1, 0)).flat(),
        },
      },
    },
  };
  return { doc, bake };
}

test("buildAnimations: one key a frame, 24 a second, a channel only where a bone moves", () => {
  const { doc, bake } = tiny(5, true);
  const report = buildAnimations(doc, bake, { names: { go: "city_go" } });
  const [anim] = doc.getRoot().listAnimations();
  assert.equal(anim.getName(), "city_go");
  assert.equal(report.go.frames, 5);
  assert.equal(
    anim.listChannels().length,
    1,
    "bone a moves in translation; its rotation and scale and all of b equal the rest",
  );
  const sampler = anim.listSamplers()[0];
  assert.equal(sampler.getInput().getCount(), 5);
  assert.deepEqual(
    Array.from(sampler.getInput().getArray()),
    [0, 1 / 24, 2 / 24, 3 / 24, 4 / 24].map(Math.fround),
  );
  // the clip lasts (N - 1) / 24 s: its last key is at 4 / 24
  assert.ok(Math.abs(sampler.getInput().getArray().at(-1) - 4 / 24) < 1e-6);
});

test("buildAnimations: the last key of a loop is the first key again, exactly", () => {
  const { doc, bake } = tiny(5, true);
  const report = buildAnimations(doc, bake, { loops: ["go"] });
  const values = doc.getRoot().listAnimations()[0].listSamplers()[0].getOutput().getArray();
  assert.deepEqual(Array.from(values.slice(12, 15)), Array.from(values.slice(0, 3)));
  assert.ok(report.go.loopGap > 0.3, "the gap that was closed is reported");
});

test("buildAnimations: a wrong key count stops the build", () => {
  const { doc, bake } = tiny(5, true);
  bake.clips.go.tracks.a = bake.clips.go.tracks.a.slice(0, -10); // one key short
  assert.throws(() => buildAnimations(doc, bake, {}), /has 4 keys, not 5/);
});

test("buildAnimations: a clip in which nothing moves stops the build", () => {
  const { doc, bake } = tiny(5, false);
  assert.throws(() => buildAnimations(doc, bake, {}), /nothing moves/);
  const { doc: doc2, bake: bake2 } = tiny(5, false);
  assert.doesNotThrow(
    () => buildAnimations(doc2, bake2, { minMotion: { go: 0 } }),
    "a floor of zero lets a still clip through",
  );
});
