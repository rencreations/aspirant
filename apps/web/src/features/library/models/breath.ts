import {
  AnimationClip,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  type Bone,
  type Object3D,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Behaviour, BehaviourContext } from "./behaviours";
import { ClipPlayer } from "./clips";
import { boundsOf, lightMaterials } from "./scene-kit";

/**
 * A breathing idle as a clip, from the bones of a Mixamo skeleton: a few degrees on the spine, the
 * neck, the head and the arms, laid on the bones' own pose. Every period divides the clip's length,
 * so it loops with no seam.
 */
interface Breath {
  bone: string;
  axis: [number, number, number];
  /** Degrees. */
  amount: number;
  /** Cycles in the clip (the clip is 7.6 s). */
  cycles: number;
  phase: number;
}

const BREATH_SECONDS = 7.6;

export const BREATH: readonly Breath[] = [
  { bone: "mixamorigSpine", axis: [1, 0, 0], amount: 0.9, cycles: 2, phase: 0 },
  { bone: "mixamorigSpine1", axis: [1, 0, 0], amount: -1.1, cycles: 2, phase: 0.2 },
  { bone: "mixamorigSpine2", axis: [1, 0, 0], amount: -1.3, cycles: 2, phase: 0.35 },
  { bone: "mixamorigSpine", axis: [0, 0, 1], amount: 0.8, cycles: 1, phase: 0 },
  { bone: "mixamorigNeck", axis: [1, 0, 0], amount: 0.9, cycles: 2, phase: 0.6 },
  { bone: "mixamorigHead", axis: [0, 1, 0], amount: 3.2, cycles: 1, phase: 0.1 },
  { bone: "mixamorigHead", axis: [0, 0, 1], amount: 1.4, cycles: 1, phase: 0.4 },
  { bone: "mixamorigLeftShoulder", axis: [0, 0, 1], amount: 1.1, cycles: 2, phase: 0.45 },
  { bone: "mixamorigRightShoulder", axis: [0, 0, 1], amount: -1.1, cycles: 2, phase: 0.45 },
  { bone: "mixamorigLeftArm", axis: [0, 0, 1], amount: 1.6, cycles: 2, phase: 0.1 },
  { bone: "mixamorigRightArm", axis: [0, 0, 1], amount: -1.6, cycles: 2, phase: 0.6 },
  { bone: "mixamorigLeftForeArm", axis: [0, 0, 1], amount: 1.8, cycles: 2, phase: 0.3 },
  { bone: "mixamorigRightForeArm", axis: [0, 0, 1], amount: -1.8, cycles: 2, phase: 0.8 },
];

/** The breathing idle of a skeleton as a clip named `idle`, or null when it has none of the bones. */
export function breathClip(
  root: Object3D,
  rows: readonly Breath[] = BREATH,
  scale = 1,
): AnimationClip | null {
  const bones = new Map<string, Bone>();
  root.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone);
  });
  const fps = 30;
  const frames = Math.round(BREATH_SECONDS * fps);
  const times = Float32Array.from({ length: frames + 1 }, (_, i) => i / fps);
  const byBone = new Map<string, Breath[]>();
  for (const r of rows) {
    if (!bones.has(r.bone)) continue;
    byBone.set(r.bone, [...(byBone.get(r.bone) ?? []), r]);
  }
  if (byBone.size === 0) return null;
  const tracks: QuaternionKeyframeTrack[] = [];
  const q = new Quaternion();
  const turn = new Quaternion();
  const axis = new Vector3();
  for (const [name, list] of byBone) {
    const bone = bones.get(name);
    if (!bone) continue;
    const values = new Float32Array((frames + 1) * 4);
    for (let i = 0; i <= frames; i += 1) {
      const u = i / frames;
      q.copy(bone.quaternion);
      for (const r of list) {
        const s = Math.sin((u * r.cycles + r.phase) * Math.PI * 2);
        turn.setFromAxisAngle(axis.set(...r.axis), ((r.amount * Math.PI) / 180) * s * scale);
        q.multiply(turn);
      }
      q.toArray(values, i * 4);
    }
    tracks.push(new QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }
  return new AnimationClip("idle", BREATH_SECONDS, tracks);
}

/** Ruby and Angela: the breathing idle, looped. */
export function breatheBehaviour(gltf: GLTF, ctx: BehaviourContext): Behaviour {
  lightMaterials(gltf.scene, ctx.anisotropy);
  const bounds = boundsOf(gltf.scene);
  // Twice the table: small enough to stay in her pose, big enough to read as breathing.
  const clip = breathClip(gltf.scene, BREATH, 2);
  const player = clip ? new ClipPlayer(gltf.scene, [clip]) : null;
  player?.play("idle", { fade: 0 });
  return {
    root: gltf.scene,
    bounds: () => bounds,
    update: (dt) => {
      if (!player) return false;
      player.update(dt);
      return player.playing;
    },
    setPlaying: (p) => {
      if (player) player.playing = p;
    },
    dispose: () => {
      player?.dispose();
    },
  };
}
