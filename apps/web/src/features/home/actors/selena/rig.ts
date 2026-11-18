/**
 * Reads the loaded model into what the actor drives: the bones by name, the rest pose, the four
 * clips as sampler tracks (the animation mixer is not used), the meshes by role. Plumbing only:
 * the maths are in the pure modules beside it.
 */
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type {
  AnimationClip,
  KeyframeTrack,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
} from "three";

import { CLIP_NAMES } from "./constants";
import type { ClipName, ClipTable } from "./player";
import { POSE_STRIDE, makeTrack, type Channel, type ClipData } from "./sampler";

interface RigMeshes {
  head: SkinnedMesh;
  eye: SkinnedMesh;
  hair01: SkinnedMesh;
  hair02: SkinnedMesh;
  body: SkinnedMesh[];
  all: SkinnedMesh[];
}

export interface Rig {
  readonly scene: Object3D;
  /** Every node a clip may move (the bones), in a fixed order: the pose arrays use these indexes. */
  readonly nodes: Object3D[];
  /** The three.js name of each node, in the same order. */
  readonly names: string[];
  /** The index of each node's parent, or -1 (a parent always comes before its children). */
  readonly parent: Int32Array;
  readonly index: Map<string, number>;
  /** The rest pose: ten numbers a node. */
  readonly rest: Float32Array;
  /** 1 for a node some clip scales (the eyes): only those get a scale written. */
  readonly scaled: Uint8Array;
  readonly clips: Record<ClipName, ClipData>;
  readonly info: ClipTable;
  readonly meshes: RigMeshes;
  /** A node by its three.js name, or a thrown error: a missing bone is a broken file. */
  node(name: string): Object3D;
}

const CHANNEL: Record<string, Channel> = { position: "p", quaternion: "q", scale: "s" };

function meshNamed(scene: Object3D, part: string): SkinnedMesh {
  let found: SkinnedMesh | null = null;
  scene.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && o.name.endsWith(part)) found = o as SkinnedMesh;
  });
  if (!found) throw new Error(`selena.glb has no mesh "${part}"`);
  return found;
}

export function buildRig(gltf: GLTF): Rig {
  const scene = gltf.scene;
  const nodes: Object3D[] = [];
  const index = new Map<string, number>();
  scene.traverse((o) => {
    if ((o as SkinnedMesh).isMesh) return;
    if (o === scene) return;
    index.set(o.name, nodes.length);
    nodes.push(o);
  });

  const parent = new Int32Array(nodes.length);
  nodes.forEach((n, i) => {
    parent[i] = n.parent ? (index.get(n.parent.name) ?? -1) : -1;
  });
  const rest = new Float32Array(nodes.length * POSE_STRIDE);
  nodes.forEach((n, i) => {
    const o = i * POSE_STRIDE;
    n.position.toArray(rest, o);
    n.quaternion.toArray(rest, o + 3);
    n.scale.toArray(rest, o + 7);
  });

  const scaled = new Uint8Array(nodes.length);
  const clips = {} as Record<ClipName, ClipData>;
  const info = {} as Record<ClipName, { duration: number; loop: boolean }>;
  for (const name of CLIP_NAMES) {
    const clip = gltf.animations.find((c: AnimationClip) => c.name === name);
    if (!clip) throw new Error(`selena.glb has no clip "${name}"`);
    const tracks = clip.tracks.flatMap((t: KeyframeTrack) => {
      const dot = t.name.lastIndexOf(".");
      const node = index.get(t.name.slice(0, dot));
      const channel = CHANNEL[t.name.slice(dot + 1)];
      if (node === undefined || !channel) return [];
      // The sampler lerps and slerps between keys: a stepped or cubic track would be read wrong.
      const width = channel === "q" ? 4 : 3;
      if (t.values.length !== t.times.length * width) {
        throw new Error(`selena.glb track ${t.name} is not linear`);
      }
      if (channel === "s") scaled[node] = 1;
      return [makeTrack(node, channel, t.times, t.values)];
    });
    const loop = name === "city_idle" || name === "city_interaction_R_loop";
    clips[name] = { name, duration: clip.duration, loop, tracks };
    info[name] = { duration: clip.duration, loop };
  }

  const body: SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && /_body_0\d/.test(o.name)) body.push(o as SkinnedMesh);
  });
  const head = meshNamed(scene, "_head");
  const eye = meshNamed(scene, "_eye");
  const hair01 = meshNamed(scene, "_hair_01");
  const hair02 = meshNamed(scene, "_hair_02");
  const all = [head, eye, hair01, hair02, ...body];

  return {
    scene,
    nodes,
    names: nodes.map((n) => n.name),
    parent,
    index,
    rest,
    scaled,
    clips,
    info,
    meshes: { head, eye, hair01, hair02, body, all },
    node(name) {
      const found = index.get(name);
      const node = found === undefined ? undefined : nodes[found];
      if (!node) throw new Error(`selena.glb has no bone "${name}"`);
      return node;
    },
  };
}

/** The material of a loaded mesh as the loader made it (always a standard material here). */
export function standardOf(mesh: SkinnedMesh): MeshStandardMaterial {
  return mesh.material as MeshStandardMaterial;
}
