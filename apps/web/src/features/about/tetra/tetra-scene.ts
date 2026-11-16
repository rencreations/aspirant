import {
  BackSide,
  BufferAttribute,
  Euler,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SkinnedMesh,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type AnimationClip,
  type Bone,
  type BufferGeometry,
  type Interpolant,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { loadMedia } from "@/lib/media-store";

import { CLIP_LIFT, TETRA_HEIGHT, TETRA_MODEL, TETRA_MODEL_BYTES, type ClipName } from "./model";
import type { TetraMarks, TetraPose, Turn } from "./pose";
import { Springs, type ColliderRow, type SpringRow } from "./spring";

/**
 * Tetra, drawn. This is the lazy part of her stage: three, the loader and the model. It knows
 * nothing of the story she plays: every frame it is handed a pose (`pose.ts`) and draws it, and
 * says where her head, hands and feet came out on the canvas, so the shadow, the comic marks and
 * the button can be laid there.
 *
 * A frame is built from nothing each time: every bone goes back to its rest, then the clip (if
 * any) is laid on it, then the turns, and only then the springs of the hair, the ears and the
 * skirt run. So each bone has one owner and nothing drifts.
 */
export interface StageView {
  /** The canvas, in CSS pixels. */
  width: number;
  height: number;
  /** Where her mark is on it: the spot on the ground between her feet. */
  markX: number;
  groundY: number;
  /** How tall she stands, in CSS pixels. */
  tall: number;
}

export interface TetraScene {
  draw: (pose: TetraPose, dt: number) => TetraMarks;
  layout: (view: StageView) => void;
  /** How long a clip is, in seconds, and how fast the walk travels, in metres a second. */
  clipSeconds: (name: ClipName) => number;
  walkSpeed: number;
  /** The hair and the ears start again from rest (after a jump of the pose, or a pause). */
  settle: () => void;
  dispose: () => void;
}

interface Hooks {
  /** The browser took the context away. Nothing is drawn until `onRestored`. */
  onLost: () => void;
  onRestored: () => void;
}

/** The lens: narrow, so she is drawn almost without perspective, from a little above. */
const FOV = 20;
const LOOK_DOWN = (7 * Math.PI) / 180;

const INK = 0x2a3342;
/** The outline's width on the screen, in CSS pixels. */
const OUTLINE_PX = 1.1;
/** No more than this many pixels are drawn, whatever the display (see the drone's scene). */
const PIXEL_BUDGET = 4e6;

/**
 * The model's head is modelled turned a little to her right. This squares it to her shoulders, so
 * a look to the left and a look to the right are the same size.
 */
const SQUARE: Turn = { x: 0, y: 0.11, z: 0 };

/** The bones a turn of the pose goes to, and how much of it each takes. */
type TurnChannel =
  "hips" | "spine" | "head" | "armL" | "armR" | "foreL" | "foreR" | "legL" | "legR";
const TURNED: ReadonlyArray<readonly [TurnChannel, string, number]> = [
  ["hips", "mixamorigHips", 1],
  ["spine", "mixamorigSpine1", 1],
  ["head", "mixamorigNeck", 0.35],
  ["head", "mixamorigHead", 0.65],
  ["armL", "mixamorigLeftArm", 1],
  ["foreL", "mixamorigLeftForeArm", 1],
  ["armR", "mixamorigRightArm", 1],
  ["foreR", "mixamorigRightForeArm", 1],
  ["legL", "mixamorigLeftUpLeg", 1],
  ["legR", "mixamorigRightUpLeg", 1],
];

interface Rest {
  bone: Bone;
  position: Vector3;
  quaternion: Quaternion;
}

interface Sampler {
  seconds: number;
  tracks: Array<{ bone: Bone; place: boolean; at: Interpolant }>;
}

interface Extras {
  springs?: SpringRow[];
  colliders?: ColliderRow[];
  clips?: Partial<Record<ClipName, { seconds: number; speed?: number }>>;
}

function pixelRatio(width: number, height: number): number {
  const wanted = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(wanted, Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)));
}

/**
 * A normal for every vertex, the same for all that share a place, so the outline's hull has no
 * gaps. The file carries no normals (nothing is lit): they are worked out here from the faces.
 */
function smoothNormals(meshes: SkinnedMesh[]): void {
  const sums = new Map<string, Vector3>();
  const key = (g: BufferGeometry, i: number) => {
    const p = g.getAttribute("position");
    return `${Math.round(p.getX(i) * 2e4)},${Math.round(p.getY(i) * 2e4)},${Math.round(p.getZ(i) * 2e4)}`;
  };
  const n = new Vector3();
  for (const mesh of meshes) {
    const g = mesh.geometry;
    g.computeVertexNormals();
    const normal = g.getAttribute("normal");
    for (let i = 0; i < normal.count; i += 1) {
      const k = key(g, i);
      const sum = sums.get(k) ?? new Vector3();
      sums.set(k, sum.add(n.fromBufferAttribute(normal, i)));
    }
  }
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const count = g.getAttribute("position").count;
    const smooth = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      n.copy(sums.get(key(g, i)) ?? n.set(0, 0, 1)).normalize();
      smooth.set([n.x, n.y, n.z], i * 3);
    }
    g.setAttribute("aSmooth", new BufferAttribute(smooth, 3));
    g.deleteAttribute("normal");
  }
}

/** Build the scene on `canvas`. The model comes through the media store, saved for next time. */
export async function createTetraScene(
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): Promise<TetraScene> {
  const url = await loadMedia(TETRA_MODEL, {
    type: "model/gltf-binary",
    expectedBytes: TETRA_MODEL_BYTES,
  });
  const bytes = await (await fetch(url)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  try {
    return assemble(renderer, gltf.scene, gltf.animations, canvas, hooks);
  } catch (error) {
    // A file that is not Tetra: the context is given back, the stage stays empty.
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}

function assemble(
  renderer: WebGLRenderer,
  model: Object3D,
  animations: AnimationClip[],
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): TetraScene {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.2, 40);
  // The actor carries her place and her attitude. The model inside is never scaled: the springs
  // work in metres, and her size on the screen is the camera's distance.
  const actor = new Group();
  actor.rotation.order = "YXZ";
  actor.add(model);
  scene.add(actor);
  scene.updateMatrixWorld(true);

  const extras = (model.getObjectByName("tetra")?.userData ?? {}) as Extras;
  const meshes: SkinnedMesh[] = [];
  model.traverse((o) => {
    if (o instanceof SkinnedMesh) meshes.push(o as SkinnedMesh);
  });
  const named = (name: string) =>
    meshes.find((mesh) => (mesh.material as Material).name === name) ?? null;
  const eyes = named("tetra_eyes");
  const mouth = named("tetra_mouth");
  const skin = meshes.filter((mesh) => mesh !== eyes && mesh !== mouth);
  if (!eyes || !mouth || skin.length === 0) throw new Error("The file is not Tetra's model.");

  // Squash and stretch, on the skinned picture and not on the bones: the doll is pressed toward
  // the ground she stands on and spreads sideways. Every material takes the same two numbers.
  const squash = { value: new Vector3(1, 1, 1) };
  const squashed = (
    material: MeshBasicMaterial,
    outline?: { uniform: { value: number }; begin: string },
  ) => {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uSquash = squash;
      let vertex = `uniform vec3 uSquash;\n${shader.vertexShader}`.replace(
        "#include <skinning_vertex>",
        "#include <skinning_vertex>\ntransformed *= uSquash;",
      );
      if (outline) {
        shader.uniforms.uOutline = outline.uniform;
        vertex = `attribute vec3 aSmooth;\nuniform float uOutline;\n${vertex}`.replace(
          "#include <begin_vertex>",
          outline.begin,
        );
      }
      shader.vertexShader = vertex;
    };
    material.needsUpdate = true;
  };

  const disposables: Array<{ dispose: () => void }> = [];
  const textures = new Set<Texture>();
  for (const mesh of meshes) {
    // A skinned mesh's box is its rest pose: she would be culled when she walks in.
    mesh.frustumCulled = false;
    const material = mesh.material as MeshBasicMaterial;
    disposables.push(mesh.geometry, material);
    material.toneMapped = false;
    if (material.map) {
      textures.add(material.map);
      material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    if (mesh === eyes || mesh === mouth) {
      // The eyes and the mouth lie on the face: they are drawn a hair in front of it.
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
    }
    if (mesh === mouth) {
      material.depthWrite = false;
      mesh.renderOrder = 2;
    }
    squashed(material);
  }

  // A thin ink line round her, as round the drone: the skin again, pushed out along its normals
  // and drawn inside out. It follows the bones. The eyes and the mouth have none.
  smoothNormals(skin);
  const outline = { value: 0 };
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
  squashed(ink, { uniform: outline, begin: "vec3 transformed = position + aSmooth * uOutline;" });
  disposables.push(ink);
  for (const mesh of skin) {
    const hull = new SkinnedMesh(mesh.geometry, ink);
    hull.bind(mesh.skeleton, mesh.bindMatrix);
    hull.frustumCulled = false;
    mesh.parent?.add(hull);
  }

  // The springs take the hair, the ears and the skirt. Every other bone is put back to its rest
  // at the start of each frame.
  const springs = new Springs(model, extras.springs ?? [], extras.colliders ?? []);
  const sprung = new Set(springs.bones());
  const rests: Rest[] = [];
  const bones = new Map<string, Bone>();
  model.traverse((o) => {
    const bone = o as Bone;
    if (!bone.isBone) return;
    bones.set(bone.name, bone);
    if (!sprung.has(bone.name)) {
      rests.push({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone() });
    }
  });
  const need = (name: string): Bone => {
    const bone = bones.get(name);
    if (!bone) throw new Error(`Tetra has no bone called ${name}.`);
    return bone;
  };
  const turned = TURNED.map(([channel, name, share]) => ({ channel, bone: need(name), share }));
  const headBone = need("mixamorigHead");
  const chestBone = need("mixamorigSpine1");
  const handR = need("mixamorigRightHand");
  const handL = need("mixamorigLeftHand");

  // The clips, read straight from their tracks: no mixer, so a frame never depends on the last.
  const samplers = new Map<string, Sampler>();
  for (const clip of animations) {
    const tracks: Sampler["tracks"] = [];
    for (const track of clip.tracks) {
      const dot = track.name.lastIndexOf(".");
      const bone = bones.get(track.name.slice(0, dot));
      if (!bone || sprung.has(bone.name)) continue;
      const make = track as unknown as { createInterpolant: (result?: unknown) => Interpolant };
      tracks.push({
        bone,
        place: track.name.endsWith(".position"),
        at: make.createInterpolant(undefined),
      });
    }
    samplers.set(clip.name, { seconds: clip.duration, tracks });
  }

  let view: StageView = { width: 1, height: 1, markX: 0, groundY: 0, tall: 300 };
  let ratio = 0;
  let lost = false;
  let disposed = false;

  const onLost = (event: Event) => {
    // Without this the browser never gives the context back.
    event.preventDefault();
    lost = true;
    hooks.onLost();
  };
  const onRestored = () => {
    lost = false;
    hooks.onRestored();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const origin = new Vector3();
  const layout = (next: StageView) => {
    const width = Math.max(1, Math.round(next.width));
    const height = Math.max(1, Math.round(next.height));
    const nextRatio = pixelRatio(width, height);
    if (nextRatio !== ratio) {
      ratio = nextRatio;
      renderer.setPixelRatio(ratio);
    }
    if (width !== view.width || height !== view.height) renderer.setSize(width, height, false);
    view = { ...next, width, height };
    // Far enough that she is `tall` pixels high where she stands, looking a little down at her.
    const perMetre = Math.max(40, view.tall) / TETRA_HEIGHT;
    const distance = height / (2 * Math.tan((FOV * Math.PI) / 360) * perMetre);
    const lookAt = TETRA_HEIGHT * 0.5;
    camera.aspect = width / height;
    camera.clearViewOffset();
    camera.position.set(0, lookAt + distance * Math.sin(LOOK_DOWN), distance * Math.cos(LOOK_DOWN));
    camera.lookAt(0, lookAt, 0);
    camera.near = Math.max(0.1, distance - 3);
    camera.far = distance + 6;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    // Her mark is drawn where the page says it is: the view is slid until it lies there.
    origin.set(0, 0, 0).project(camera);
    const x = (origin.x * 0.5 + 0.5) * width;
    const y = (0.5 - origin.y * 0.5) * height;
    camera.setViewOffset(width, height, x - view.markX, y - view.groundY, width, height);
    camera.updateProjectionMatrix();
  };

  const q = new Quaternion();
  const up = new Quaternion();
  const twist = new Quaternion();
  const euler = new Euler(0, 0, 0, "YXZ");
  const v = new Vector3();
  const sampled = new Quaternion();

  /** Lay a clip on the rest pose, as much of it as `weight` says. */
  const sample = (name: ClipName, time: number, weight: number) => {
    const sampler = samplers.get(name);
    if (!sampler || weight <= 0) return;
    const t = ((time % sampler.seconds) + sampler.seconds) % sampler.seconds;
    for (const track of sampler.tracks) {
      const values = track.at.evaluate(t) as ArrayLike<number>;
      if (track.place) {
        v.set(values[0] ?? 0, (values[1] ?? 0) - CLIP_LIFT[name], values[2] ?? 0);
        track.bone.position.lerp(v, weight);
      } else {
        sampled.set(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1);
        track.bone.quaternion.slerp(sampled, weight);
      }
    }
  };

  /**
   * Turn a bone about the doll's own axes, on top of the pose it has. The bone's parent may be
   * turned already, so the turn is carried into the parent's frame as it is now.
   */
  const turn = (bone: Bone, by: Turn, share: number) => {
    if (by.x === 0 && by.y === 0 && by.z === 0) return;
    up.identity();
    for (let at = bone.parent; at && at !== actor; at = at.parent) up.premultiply(at.quaternion);
    twist.setFromEuler(euler.set(by.x * share, by.y * share, by.z * share));
    q.copy(up).invert().multiply(twist).multiply(up);
    bone.quaternion.premultiply(q);
  };

  const project = (out: { x: number; y: number }) => {
    v.project(camera);
    out.x = (v.x * 0.5 + 0.5) * view.width;
    out.y = (0.5 - v.y * 0.5) * view.height;
  };
  const marks: TetraMarks = {
    head: { x: 0, y: 0 },
    crown: { x: 0, y: 0 },
    chest: { x: 0, y: 0 },
    ground: { x: 0, y: 0 },
    handR: { x: 0, y: 0 },
    handL: { x: 0, y: 0 },
    scale: 1,
  };
  const above = { x: 0, y: 0 };

  const eyeTarget = (name: string) => eyes.morphTargetDictionary?.[name] ?? -1;
  const EYE = {
    blinkL: eyeTarget("blink_L"),
    blinkR: eyeTarget("blink_R"),
    squeeze: eyeTarget("squeeze"),
    wide: eyeTarget("wide"),
    lookX: eyeTarget("look_x"),
    lookY: eyeTarget("look_y"),
  };

  const draw = (pose: TetraPose, dt: number): TetraMarks => {
    if (disposed) return marks;
    // 1. Rest, then the clip, then the turns.
    for (const rest of rests) {
      rest.bone.position.copy(rest.position);
      rest.bone.quaternion.copy(rest.quaternion);
    }
    if (pose.clip) sample(pose.clip, pose.clipTime, pose.clipWeight);
    for (const { channel, bone, share } of turned) turn(bone, pose[channel], share);
    turn(headBone, SQUARE, 1);

    // 2. Her place and attitude, and the squash.
    actor.position.set(pose.x, pose.y, pose.z);
    actor.rotation.set(pose.pitch, pose.yaw, pose.roll);
    const wide = 1 / Math.sqrt(Math.max(0.3, pose.squash));
    squash.value.set(wide, pose.squash, wide);
    actor.updateMatrixWorld(true);

    // 3. The springs, last.
    springs.update(dt);

    // 4. The face.
    const eye = eyes.morphTargetInfluences;
    if (eye) {
      eye[EYE.blinkL] = pose.blinkL;
      eye[EYE.blinkR] = pose.blinkR;
      eye[EYE.squeeze] = pose.squeeze;
      eye[EYE.wide] = pose.wide;
      eye[EYE.lookX] = pose.lookX;
      eye[EYE.lookY] = pose.lookY;
    }
    const lips = mouth.morphTargetInfluences;
    if (lips) {
      lips.fill(0);
      const at = mouth.morphTargetDictionary?.[pose.mouth];
      if (at !== undefined) lips[at] = pose.mouthSize;
    }

    // 5. Where she came out on the canvas. (The squash is small: the marks ignore it.)
    v.set(0, 0.075, 0.09).applyMatrix4(headBone.matrixWorld);
    project(marks.head);
    v.set(0, 0.25, 0).applyMatrix4(headBone.matrixWorld);
    project(marks.crown);
    v.setFromMatrixPosition(chestBone.matrixWorld);
    const cx = v.x;
    const cz = v.z;
    project(marks.chest);
    v.set(0, 0.03, 0).applyMatrix4(handR.matrixWorld);
    project(marks.handR);
    v.set(0, 0.03, 0).applyMatrix4(handL.matrixWorld);
    project(marks.handL);
    v.set(cx, 0, cz);
    project(marks.ground);
    v.set(cx, 0.1, cz);
    project(above);
    marks.scale = Math.hypot(above.x - marks.ground.x, above.y - marks.ground.y) * 10;

    if (!lost) {
      outline.value = OUTLINE_PX / Math.max(1, marks.scale);
      renderer.render(scene, camera);
    }
    return marks;
  };

  layout({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    markX: canvas.clientWidth / 2,
    groundY: canvas.clientHeight * 0.85,
    tall: 320,
  });
  // Shaders and pictures go to the card now, not in the first frame of her entrance.
  renderer.compile(scene, camera);
  for (const t of textures) renderer.initTexture(t);

  const seconds = (name: ClipName) =>
    samplers.get(name)?.seconds ?? extras.clips?.[name]?.seconds ?? 1;

  return {
    draw,
    layout,
    clipSeconds: seconds,
    walkSpeed: extras.clips?.walk?.speed ?? 0.186,
    settle: () => {
      springs.reset();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      for (const d of disposables) d.dispose();
      for (const t of textures) t.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
