import {
  BackSide,
  Color,
  Group,
  MeshBasicMaterial,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type Bone,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { loadMedia } from "@/lib/media-store";

import {
  FACE_BLUE,
  FACE_CYAN,
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_PINK,
  FACE_RED,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
  makeFaceUniforms,
  packFace,
  setScreen,
  type BunnyScreen,
} from "../bunny/face";
import { BUNNY_BODY_TARGETS, BUNNY_MODEL, BUNNY_MODEL_BYTES, BUNNY_TARGETS } from "../bunny/model";
import type { BunnyEar, BunnyPose } from "../choreo/bunny";

/**
 * Mr. Bunny, as the drone's scene draws it, in the flat pass of the friends (one unit a CSS
 * pixel). The file is `scripts/about/bunny/`'s: nine bones, seventeen shapes, a blank screen. This
 * lays it out from a pose (`choreo/bunny.ts`): the place and the attitude, the turns of the ears
 * and the feet, the shapes, and the face drawn on the screen by its shader (`bunny/face.ts`). It is
 * unlit, as the drone is, with the same thin ink line: the shell again, pushed out along its
 * normals and drawn inside out, following the bones and the shapes.
 *
 * When the shell is reshaped (squashed, stretched, puffed, leaning) the ears and the feet ride on
 * their hinges: the file says how far each hinge moves and turns at full weight, and the bone is
 * moved by that, as the model's README says ("Body targets and the bones").
 */

const INK = 0x2a3342;
/** The outline's width on the screen, in CSS pixels. */
const OUTLINE_PX = 1.2;
/** The model's width across the ears, in metres: what the pose's size stands for. */
const ACROSS = 0.52;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

interface Hinge {
  shift: [number, number, number];
  turn: [number, number, number, number];
}

interface Extras {
  screen?: BunnyScreen;
  hinges?: Record<string, Record<string, Hinge>>;
}

interface Part {
  bone: Bone;
  rest: Quaternion;
  at: Vector3;
}

export interface BunnyModel {
  /** Its group, for the scene to show or hide. */
  readonly actor: Group;
  /** Lay it out from its pose. `height` is the canvas's height in CSS pixels. */
  place: (pose: BunnyPose, height: number) => void;
  warm: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => void;
  dispose: () => void;
}

/** Load the file through the media store (the loading list's copy when there is one). */
export async function loadBunnyFile(): Promise<Object3D> {
  const url = await loadMedia(BUNNY_MODEL, {
    type: "model/gltf-binary",
    expectedBytes: BUNNY_MODEL_BYTES,
  });
  const bytes = await (await fetch(url)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  return gltf.scene;
}

/** Build it from the file into `scene`. Throws on a file that is not Mr. Bunny's. */
export function buildBunny(file: Object3D, scene: Scene): BunnyModel {
  const root = file.getObjectByName("bunny");
  if (!root) throw new Error("The file is not Mr. Bunny's model.");
  const extras = root.userData as Extras;
  if (!extras.screen || !extras.hinges)
    throw new Error("Mr. Bunny's file has no screen or hinges.");
  const hinges = extras.hinges;

  const meshes: SkinnedMesh[] = [];
  file.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh);
  });
  const faceMesh = meshes.find((m) => (m.material as MeshBasicMaterial).name === "bunny_face");
  const bodyMesh = meshes.find((m) => (m.material as MeshBasicMaterial).name === "bunny_body");
  if (!faceMesh || !bodyMesh) throw new Error("Mr. Bunny's file has no body or no screen.");

  const disposables: Array<{ dispose: () => void }> = [];
  const textures = new Set<Texture>();
  for (const mesh of meshes) {
    mesh.frustumCulled = false;
    const material = mesh.material as MeshBasicMaterial;
    material.toneMapped = false;
    if (material.map) textures.add(material.map);
    disposables.push(mesh.geometry, material);
  }

  // The face, drawn on the glass by its shader.
  const face = makeFaceUniforms();
  setScreen(face, extras.screen);
  face.uCyan.value = new Color(FACE_CYAN).toArray();
  face.uPink.value = new Color(FACE_PINK).toArray();
  face.uRed.value = new Color(FACE_RED).toArray();
  face.uBlue.value = new Color(FACE_BLUE).toArray();
  const glass = faceMesh.material as MeshBasicMaterial;
  glass.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, face);
    shader.vertexShader =
      FACE_VERTEX_HEAD +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n${FACE_VERTEX_BODY}`,
      );
    shader.fragmentShader =
      FACE_FRAGMENT_HEAD +
      shader.fragmentShader.replace("#include <map_fragment>", FACE_FRAGMENT_MAP);
  };
  glass.customProgramCacheKey = () => "about-bunny-face";
  glass.needsUpdate = true;

  // The ink line: each mesh again, pushed out along its normals, inside out, with its shapes.
  const outline = { value: 0 };
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
  ink.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = outline;
    shader.vertexShader = `uniform float uOutline;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      "vec3 transformed = position + normal * uOutline;",
    );
  };
  ink.customProgramCacheKey = () => "about-bunny-hull";
  disposables.push(ink);
  const hulls: SkinnedMesh[] = [];
  for (const mesh of meshes) {
    const hull = new SkinnedMesh(mesh.geometry, ink);
    hull.bind(mesh.skeleton, mesh.bindMatrix);
    hull.frustumCulled = false;
    // The hull keeps the shapes of the mesh it lines: the same numbers, the same array.
    if (mesh.morphTargetInfluences) hull.morphTargetInfluences = mesh.morphTargetInfluences;
    if (mesh.morphTargetDictionary) hull.morphTargetDictionary = mesh.morphTargetDictionary;
    mesh.parent?.add(hull);
    hulls.push(hull);
  }

  const bone = (name: string): Part => {
    const b = file.getObjectByName(name) as Bone | undefined;
    if (!b) throw new Error(`Mr. Bunny has no bone ${name}.`);
    return { bone: b, rest: b.quaternion.clone(), at: b.position.clone() };
  };
  const earL = [bone("ear_L_1"), bone("ear_L_2"), bone("ear_L_3")] as const;
  const earR = [bone("ear_R_1"), bone("ear_R_2"), bone("ear_R_3")] as const;
  const footL = bone("foot_L");
  const footR = bone("foot_R");
  const hinged = [earL[0], earR[0], footL, footR];

  const actor = new Group();
  const lean = new Group();
  lean.rotation.order = "YXZ";
  actor.add(lean);
  lean.add(file);
  actor.visible = false;
  scene.add(actor);

  const q = new Quaternion();
  const turn = new Quaternion();
  const unit = new Quaternion();
  const hingeTurn = new Quaternion();
  const shift = new Vector3();
  const hingeShift = new Vector3();
  const away = new Vector3();
  const awayTurn = new Quaternion();
  const restInverse = new Map(hinged.map((p) => [p, p.rest.clone().invert()]));
  const index = new Map(BUNNY_TARGETS.map((n, i) => [n, i] as const));

  /** A bone's rest, then turns about its own axes. */
  const turnOf = (p: Part, turns: ReadonlyArray<readonly [Vector3, number]>) => {
    q.copy(p.rest);
    for (const [axis, angle] of turns) q.multiply(turn.setFromAxisAngle(axis, angle));
    p.bone.quaternion.copy(q);
  };
  // An ear turns at its hinge only: it bends by its shapes, never by its upper bones as well.
  const earPose = (bones: readonly [Part, Part, Part], e: BunnyEar, side: number) => {
    turnOf(bones[0], [
      [Z, side * e.splay],
      [X, e.fold],
      [Y, side * e.twist],
    ]);
    bones[1].bone.quaternion.copy(bones[1].rest);
    bones[2].bone.quaternion.copy(bones[2].rest);
  };

  return {
    actor,
    place: (pose, height) => {
      const perMetre = Math.max(1, pose.size) / ACROSS;
      actor.position.set(pose.x, height - pose.y, pose.z);
      actor.scale.setScalar(perMetre);
      lean.rotation.set(pose.pitch, pose.yaw, pose.roll);
      // The shapes, on both meshes (the hulls share the meshes' numbers).
      for (const mesh of meshes) {
        const influences = mesh.morphTargetInfluences;
        if (!influences) continue;
        for (let i = 0; i < pose.targets.length; i += 1) influences[i] = pose.targets[i] ?? 0;
      }
      // The ears and the feet: left takes -a about Z and Y, right +a (the README's table).
      earPose(earL, pose.earL, -1);
      earPose(earR, pose.earR, 1);
      turnOf(footL, [
        [X, pose.footL.swing],
        [Z, pose.footL.splay],
      ]);
      turnOf(footR, [
        [X, pose.footR.swing],
        [Z, -pose.footR.splay],
      ]);
      // The hinges ride on the reshaped shell.
      for (const p of hinged) {
        shift.set(0, 0, 0);
        hingeTurn.identity();
        for (const target of BUNNY_BODY_TARGETS) {
          const w = pose.targets[index.get(target) ?? 0] ?? 0;
          if (w <= 0.0005) continue;
          const h = hinges[target]?.[p.bone.name];
          if (!h) continue;
          shift.add(hingeShift.set(h.shift[0], h.shift[1], h.shift[2]).multiplyScalar(w));
          hingeTurn.premultiply(
            unit.identity().slerp(turn.set(h.turn[0], h.turn[1], h.turn[2], h.turn[3]), w),
          );
        }
        p.bone.quaternion.premultiply(hingeTurn);
        awayTurn.copy(p.bone.quaternion).multiply(restInverse.get(p) ?? unit.identity());
        away.copy(shift).applyQuaternion(awayTurn);
        p.bone.position.copy(p.at).add(shift).sub(away);
      }
      packFace(face, pose.face, pose.live);
      outline.value = OUTLINE_PX / perMetre;
    },
    warm: (renderer, scene, camera) => {
      actor.visible = true;
      try {
        void renderer.compileAsync(scene, camera).catch(() => undefined);
        for (const t of textures) renderer.initTexture(t);
      } finally {
        actor.visible = false;
      }
    },
    dispose: () => {
      actor.removeFromParent();
      for (const hull of hulls) hull.removeFromParent();
      for (const d of disposables) d.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
