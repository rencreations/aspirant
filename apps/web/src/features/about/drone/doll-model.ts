import {
  Color,
  Group,
  MeshBasicMaterial,
  SkinnedMesh,
  Vector2,
  Vector4,
  type Bone,
  type Camera,
  type IUniform,
  type MeshStandardMaterial,
  type Object3D,
  type Scene,
  type Side,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { FACE_FRAME } from "@/features/home/actors/doll/face/presets";
import {
  FACE_ARRAY_LENGTH,
  FACES,
  applyLive,
  autoBlink,
  mixFaces,
} from "@/features/home/actors/doll/face/mix";
import { patchFaceFragment, patchFaceVertex } from "@/features/home/actors/doll/face/toon-face";
import {
  BONE_COUNT,
  BONE_NAMES,
  applyTurns,
  blendPoseData,
  buildBind,
  compilePose,
  copyPoseData,
  createPoseData,
  type PoseData,
} from "@/features/home/actors/doll/pose/math";
import { DOLL_HEIGHT } from "@/features/home/actors/doll/rig";
import { loadMedia } from "@/lib/media-store";

import type { DollFrame } from "../choreo/doll";
import { DOLL_POSE_NAMES, DOLL_POSES, DOLL_SEAT, type DollPoseName } from "../choreo/doll-poses";
import { DOLL_MODEL, DOLL_MODEL_BYTES } from "../media";

/**
 * The Obsidia doll, drawn on the drone's head. Her file, her bones, her face and her poses are the
 * home's own (`features/home/actors/doll/`: the face shader, the face presets and their mixing, the
 * pose arithmetic and the rig are read from there, nothing else). Her look is this page's: unlit,
 * as the drone is, with the page's ink line round her.
 *
 * She is put in the drone's own scene, under the group that carries the drone, on a seat at the top
 * of its helmet, so she flies, turns and rolls with it and the drone's body hides her where it is in
 * front of her: the two are drawn in one depth buffer. The seat and her size are the home's numbers
 * (`actors/buddies/seat.ts` and `pair.ts`): the same drone model carries her there.
 *
 * Her line: her hair is made of open sheets, which have no inside, so the drone's inverted hull
 * cannot outline her. The mesh is drawn again in ink a few times, each copy shifted on the screen by
 * the line's width in another direction round a circle and pushed back in depth, so a ring of ink
 * shows round every edge with nothing nearer behind it. The home's doll is lined the same way
 * (`ink.ts`); the vertex step below is written for this page, in its ink.
 */

/** The ink of the drone's line. */
const INK = 0x1f2735;
/** How many shifted copies draw her line. */
const COPIES = 6;

/** The top of the drone's helmet between its fins, in the drone's metres (+Y up, +Z its face). */
const HEAD_TOP: readonly [number, number, number] = [0, 0.158, 0.02];
/** The drone's height at rest, in its metres (the home's `BODY_HEIGHT_METRES`). */
const DRONE_HEIGHT = 0.44748;
/** Her height, feet to crown, as a part of the drone's: a little more than the home's half, so her
 * face reads at the sizes the drone flies at on this page. */
const DOLL_RATIO = 0.66;
/** Where her hips sit from the top of the helmet, in her heights: up, and forward over its front. */
const SEAT_OFFSET: readonly [number, number] = [0.09, 0.5];
/** Her hips in her file's units: the point she sits on. */
const HIPS: readonly [number, number, number] = [0, 0.396, 0];

const PROJECT_CHUNK = "#include <project_vertex>";

/** One ink copy's vertex step: shifted on the screen, its depth taken from a point pushed back. */
function inkVertex(source: string): string {
  const at = source.indexOf(PROJECT_CHUNK);
  if (at < 0) return source;
  const step = `${PROJECT_CHUNK}
	{
		vec4 pushed = mvPosition;
		pushed.z -= uInkPush;
		vec4 pushedClip = projectionMatrix * pushed;
		vec4 inkClip = gl_Position;
		inkClip.xy += uInkShift * ( 2.0 * uInkPx ) / uInkView * inkClip.w;
		inkClip.z = pushedClip.z / pushedClip.w * inkClip.w;
		gl_Position = inkClip;
	}`;
  return `uniform float uInkPx;\nuniform float uInkPush;\nuniform vec2 uInkView;\nuniform vec2 uInkShift;\n${source.slice(0, at)}${step}${source.slice(at + PROJECT_CHUNK.length)}`;
}

export interface DollModel {
  /** Her seat: put it under the group that carries the drone. */
  readonly seat: Group;
  /** Pose her from her frame. `counter` is the roll she holds against, `time` her clock. */
  pose: (frame: DollFrame, time: number, counter: number) => void;
  /** Her line: its width in CSS pixels, the canvas in CSS pixels, and a pixel in the scene's units. */
  line: (px: number, width: number, height: number, unit: number) => void;
  warm: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void;
  dispose: () => void;
}

/** Load her file through the media store (the loading list's copy when there is one). */
export async function loadDollFile(): Promise<Object3D> {
  const url = await loadMedia(DOLL_MODEL, {
    type: "model/gltf-binary",
    expectedBytes: DOLL_MODEL_BYTES,
  });
  const bytes = await (await fetch(url)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  return gltf.scene;
}

/** Build her from her file. Throws on a file that is not hers. */
export function buildDoll(file: Object3D): DollModel {
  let body: SkinnedMesh | null = null;
  file.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && o.name === "doll_body") body = o as SkinnedMesh;
  });
  const mesh = body as SkinnedMesh | null;
  if (!mesh) throw new Error("The doll's file has no doll_body.");
  if (!mesh.geometry.getAttribute("_face")) throw new Error("The doll's file has no face.");
  mesh.frustumCulled = false;
  const bones: Bone[] = BONE_NAMES.map((name) => {
    const bone = mesh.skeleton.bones.find((b) => b.name === name);
    if (!bone) throw new Error(`The doll has no bone ${name}.`);
    return bone;
  });

  const source = mesh.material as MeshStandardMaterial;
  const map: Texture | null = source.map;
  const side: Side = source.side;
  const disposables: Array<{ dispose: () => void }> = [mesh.geometry, source];
  const textures: Texture[] = [];
  for (const t of [source.map, source.normalMap, source.metalnessMap, source.roughnessMap]) {
    if (t && !textures.includes(t)) textures.push(t);
  }

  // Her face, drawn by the home's face shader into an unlit material.
  const faceValues = new Float32Array(FACE_ARRAY_LENGTH);
  const uniforms = {
    uFaceF: { value: faceValues },
    uFaceFrame: { value: new Vector4(FACE_FRAME[0], FACE_FRAME[1], FACE_FRAME[2], FACE_FRAME[3]) },
    uIrisL: { value: new Color(0xd9262f) },
    uIrisR: { value: new Color(0x5cbcf2) },
    uInk: { value: new Color(INK) },
  };
  const paint = new MeshBasicMaterial({ map, side, toneMapped: false });
  paint.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = patchFaceVertex(shader.vertexShader);
    shader.fragmentShader = patchFaceFragment(shader.fragmentShader);
  };
  paint.customProgramCacheKey = () => "about-doll-face";
  mesh.material = paint;
  disposables.push(paint);

  // The seat, the hop, the squash about her hips, and the shift that puts her hips at the origin.
  const seat = new Group();
  seat.name = "about-doll-seat";
  const root = new Group();
  root.rotation.order = "ZXY";
  const squash = new Group();
  const shift = new Group();
  seat.add(root);
  root.add(squash);
  squash.add(shift);
  shift.add(file);
  shift.position.set(-HIPS[0], -HIPS[1], -HIPS[2]);
  const height = DOLL_RATIO * DRONE_HEIGHT;
  const scale = height / DOLL_HEIGHT;
  root.scale.setScalar(scale);
  seat.position.set(
    HEAD_TOP[0],
    HEAD_TOP[1] + SEAT_OFFSET[0] * height,
    HEAD_TOP[2] + SEAT_OFFSET[1] * height,
  );

  // Her line: shifted copies in ink.
  const ink = {
    uInkPx: { value: 1.6 },
    uInkPush: { value: 0.01 },
    uInkView: { value: new Vector2(1, 1) },
  };
  const copies: SkinnedMesh[] = [];
  for (let i = 0; i < COPIES; i += 1) {
    const a = (i / COPIES) * Math.PI * 2;
    const shiftUniform: IUniform<Vector2> = { value: new Vector2(Math.cos(a), Math.sin(a)) };
    const material = new MeshBasicMaterial({ color: INK, side, toneMapped: false });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, ink, { uInkShift: shiftUniform });
      shader.vertexShader = inkVertex(shader.vertexShader);
    };
    material.customProgramCacheKey = () => "about-doll-ink";
    const copy = new SkinnedMesh(mesh.geometry, material);
    copy.position.copy(mesh.position);
    copy.quaternion.copy(mesh.quaternion);
    copy.scale.copy(mesh.scale);
    copy.bind(mesh.skeleton, mesh.bindMatrix);
    copy.frustumCulled = false;
    mesh.parent?.add(copy);
    copies.push(copy);
    disposables.push(material);
  }

  // Her poses, compiled once by the home's arithmetic.
  const bind = buildBind();
  const seatPose = compilePose(bind, DOLL_SEAT);
  const poses = new Map<DollPoseName, PoseData>();
  for (const name of DOLL_POSE_NAMES) poses.set(name, compilePose(bind, DOLL_POSES[name]));
  const work = createPoseData();
  const shown = new Float32Array(FACE_ARRAY_LENGTH);
  const live = { blink: 0, lookX: 0, lookY: 0, talk: 0, t: 0 };

  const apply = (data: PoseData) => {
    for (let i = 0; i < BONE_COUNT; i += 1) {
      const bone = bones[i];
      if (!bone) continue;
      bone.quaternion.fromArray(data.q, i * 4);
      bone.scale.fromArray(data.scale, i * 3);
    }
    bones[0]?.position.fromArray(data.hips, 0);
  };

  return {
    seat,
    pose: (frame, time, counter) => {
      copyPoseData(work, seatPose);
      for (const name of DOLL_POSE_NAMES) {
        const w = frame.weights[name];
        const pose = poses.get(name);
        if (pose && w > 0.002) blendPoseData(work, work, pose, w);
      }
      applyTurns(bind, work.q, frame.turns);
      apply(work);
      root.position.set(0, frame.hop * height, 0);
      root.rotation.set(0, 0, counter);
      const sq = Math.max(-0.4, Math.min(0.4, frame.squash));
      squash.scale.set(1 / Math.sqrt(1 + sq), 1 + sq, 1 / Math.sqrt(1 + sq));

      const faces = FACES;
      mixFaces(shown, faces[frame.face.a], faces[frame.face.b], frame.face.w);
      live.blink = autoBlink(time, 3);
      // Her face counts up as up; the frame counts down.
      live.lookX = frame.lookX;
      live.lookY = -frame.lookY;
      live.talk = frame.talk;
      live.t = time;
      applyLive(shown, live);
      faceValues.set(shown);
    },
    line: (px, width, height, unit) => {
      ink.uInkPx.value = px;
      ink.uInkView.value.set(width, height);
      // The copies are pushed back by several widths, so the shifted copy of one hair sheet does
      // not paint over the sheet beside it (the home's doll found seven widths right).
      ink.uInkPush.value = px * unit * 7;
    },
    warm: (renderer, scene, camera) => {
      const was = seat.visible;
      seat.visible = true;
      try {
        void renderer.compileAsync(scene, camera).catch(() => undefined);
        if (map) renderer.initTexture(map);
      } finally {
        seat.visible = was;
      }
    },
    dispose: () => {
      seat.removeFromParent();
      for (const copy of copies) copy.removeFromParent();
      for (const d of disposables) d.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
