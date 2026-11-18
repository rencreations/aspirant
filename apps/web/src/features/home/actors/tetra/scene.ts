/**
 * Tetra, drawn. The three.js side of the actor: her model, her look and the lens she is seen
 * through. It is the About page's scene (`about/tetra/tetra-scene.ts`) with the parts that belonged
 * to a stage of her own taken out (no renderer, no canvas, no context listeners, no clear: the home
 * has one stage) and the parts the home needs put in: more turn channels (a spine, a neck, the
 * shoulders, the wrists, the knees), a two-bone arm solve, sockets on the hands and the head, and a
 * per-frame placement in the stage's pixels.
 *
 * The look is the About look and the same constants: unlit (the paint carries the shading), a 20
 * degree lens looking down 7 degrees, a thin ink line round her that keeps its width on the screen,
 * squash and stretch done after the skinning so the bones and the springs never see it.
 *
 * A frame is built from nothing each time: every bone goes back to its rest, then the clip (if any)
 * is laid on it, then the turns, then the arms are solved to their targets, and only then do the
 * springs of the hair, the ears and the skirt run. So each bone has one owner and nothing drifts.
 * She is never scaled: the springs work in metres, and her size on the screen is the camera's
 * distance.
 */
import {
  BackSide,
  BufferAttribute,
  Euler,
  Group,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
  type Bone,
  type BufferGeometry,
  type Interpolant,
  type Material,
  type Texture,
  type WebGLRenderer,
} from "three";

import { Springs, type ColliderRow, type SpringRow } from "@/features/about/tetra/spring";

import { clamp } from "./ease";
import { type Channels, type Turn, type TurnKey } from "./channels";
import { forgetGltf, loadGltf } from "../shared/gltf";
import { solveTwoBone } from "./ik";
import { CLIP_LIFT, TETRA_HEIGHT, TETRA_MODEL, type ClipName } from "./model";

/** The lens: narrow, so she is drawn almost without perspective, from a little above. */
const FOV = 20;
const LOOK_DOWN = (7 * Math.PI) / 180;
const INK = 0x2a3342;

/**
 * The model's head is modelled turned a little to her right. This squares it to her shoulders, so
 * a look to the left and a look to the right are the same size.
 */
const SQUARE: Turn = { x: 0, y: 0.11, z: 0 };

/** The bones a turn of the pose goes to, and how much of it each takes. Parents come first. */
const TURNED: ReadonlyArray<readonly [TurnKey, string, number]> = [
  ["hips", "mixamorigHips", 1],
  ["spine", "mixamorigSpine1", 1],
  ["spine2", "mixamorigSpine2", 1],
  ["neck", "mixamorigNeck", 1],
  ["head", "mixamorigNeck", 0.35],
  ["head", "mixamorigHead", 0.65],
  ["shoulderL", "mixamorigLeftShoulder", 1],
  ["armL", "mixamorigLeftArm", 1],
  ["foreL", "mixamorigLeftForeArm", 1],
  ["wristL", "mixamorigLeftHand", 1],
  ["shoulderR", "mixamorigRightShoulder", 1],
  ["armR", "mixamorigRightArm", 1],
  ["foreR", "mixamorigRightForeArm", 1],
  ["wristR", "mixamorigRightHand", 1],
  ["legL", "mixamorigLeftUpLeg", 1],
  ["kneeL", "mixamorigLeftLeg", 1],
  ["legR", "mixamorigRightUpLeg", 1],
  ["kneeR", "mixamorigRightLeg", 1],
];

/** What the actor hands the scene each frame, besides the channels. */
export interface FaceDraw {
  blinkL: number;
  blinkR: number;
  squeeze: number;
  wide: number;
  lookX: number;
  lookY: number;
  mouth: string;
  mouthSize: number;
}

/** Where she is on the screen: the canvas, her mark on it (CSS pixels, y down) and her height. */
export interface View {
  width: number;
  height: number;
  markX: number;
  groundY: number;
  tall: number;
  /** Faces the left of the screen (the whole doll is mirrored). */
  flip: boolean;
}

/** A point on the screen, in the stage frame: the middle of the screen is the origin, y up. */
export interface Point2 {
  x: number;
  y: number;
}

/** Where things came out on the screen after a frame, in the stage's frame. */
export interface Marks {
  head: Point2;
  crown: Point2;
  chest: Point2;
  ground: Point2;
  handL: Point2;
  handR: Point2;
  /** Pixels for a metre at her depth. */
  scale: number;
}

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

/** A normal for every vertex, the same for all that share a place, so the outline's hull has no gaps. */
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

export class TetraModel {
  /** Her group: place, attitude and mirror. The kernel shows and hides it. */
  readonly root = new Group();
  readonly scene = new Scene();
  /** Props that live in her scene but not on her bones (the book, the reel), so a mirror never flips them. */
  readonly props = new Group();
  readonly camera = new PerspectiveCamera(FOV, 1, 0.2, 40);
  /** Where a hand, the head and the crown are, as objects that move with the bones. */
  readonly sockets: Record<"handL" | "handR" | "head", Object3D> = {
    handL: new Object3D(),
    handR: new Object3D(),
    head: new Object3D(),
  };
  readonly marks: Marks = {
    head: { x: 0, y: 0 },
    crown: { x: 0, y: 0 },
    chest: { x: 0, y: 0 },
    ground: { x: 0, y: 0 },
    handL: { x: 0, y: 0 },
    handR: { x: 0, y: 0 },
    scale: 1,
  };
  /** How long a clip is, in seconds, and how fast the walk travels. */
  readonly walkSpeed: number;

  private width = 1;
  private height = 1;
  private view: View = { width: 1, height: 1, markX: 0, groundY: 0, tall: 300, flip: false };
  private readonly squash = { value: new Vector3(1, 1, 1) };
  private readonly outline = { value: 0 };
  private readonly meshes: SkinnedMesh[] = [];
  private readonly eyes: SkinnedMesh;
  private readonly mouth: SkinnedMesh;
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly textures = new Set<Texture>();
  private readonly springs: Springs;
  private readonly rests: Rest[] = [];
  private readonly turned: Array<{ channel: TurnKey; bone: Bone; share: number }>;
  private readonly bones = new Map<string, Bone>();
  private readonly samplers = new Map<string, Sampler>();
  private readonly headBone: Bone;
  private readonly chestBone: Bone;
  private readonly arm: Record<
    "L" | "R",
    { arm: Bone; fore: Bone; hand: Bone; a: number; b: number }
  >;
  private readonly eyeAt: Record<string, number>;
  private readonly clipSecondsOf: (name: ClipName) => number;

  // Scratch, reused every frame.
  private readonly q = new Quaternion();
  private readonly up = new Quaternion();
  private readonly twist = new Quaternion();
  private readonly euler = new Euler(0, 0, 0, "YXZ");
  private readonly v = new Vector3();
  private readonly w = new Vector3();
  private readonly sampled = new Quaternion();
  private readonly shoulder = new Vector3();
  private readonly elbow = new Vector3();
  private readonly wrist = new Vector3();
  private readonly goal = new Vector3();
  private readonly pole = new Vector3();
  private readonly elbowOut = { x: 0, y: 0, z: 0, reached: 1 };

  /** Load the model through the media store. */
  static async load(): Promise<TetraModel> {
    const gltf = await loadGltf(TETRA_MODEL);
    // This build changes the scene (a hull on every skin, sockets): it is never handed on.
    forgetGltf(TETRA_MODEL);
    return new TetraModel(gltf.scene, gltf.animations);
  }

  private constructor(model: Object3D, animations: AnimationClip[]) {
    this.root.rotation.order = "YXZ";
    this.root.add(model);
    this.scene.add(this.root, this.props);
    this.scene.updateMatrixWorld(true);

    const extras = (model.getObjectByName("tetra")?.userData ?? {}) as Extras;
    model.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) this.meshes.push(o as SkinnedMesh);
    });
    const named = (name: string) =>
      this.meshes.find((mesh) => (mesh.material as Material).name === name) ?? null;
    const eyes = named("tetra_eyes");
    const mouth = named("tetra_mouth");
    const skin = this.meshes.filter((mesh) => mesh !== eyes && mesh !== mouth);
    if (!eyes || !mouth || skin.length === 0) throw new Error("The file is not Tetra's model.");
    this.eyes = eyes;
    this.mouth = mouth;

    // Squash and stretch, on the skinned picture and not on the bones. Every material takes the
    // same two numbers.
    const squash = this.squash;
    const squashed = (
      material: MeshBasicMaterial,
      key: string,
      outline?: { uniform: { value: number }; begin: string },
    ) => {
      material.customProgramCacheKey = () => key;
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

    for (const mesh of this.meshes) {
      // A skinned mesh's box is its rest pose: she would be culled when she moves.
      mesh.frustumCulled = false;
      const material = mesh.material as MeshBasicMaterial;
      this.disposables.push(mesh.geometry, material);
      material.toneMapped = false;
      if (material.map) this.textures.add(material.map);
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
      squashed(material, "home-tetra-skin");
    }

    // A thin ink line round her, as round the drone: the skin again, pushed out along its normals
    // and drawn inside out. It follows the bones. The eyes and the mouth have none.
    smoothNormals(skin);
    const ink = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
    squashed(ink, "home-tetra-hull", {
      uniform: this.outline,
      begin: "vec3 transformed = position + aSmooth * uOutline;",
    });
    this.disposables.push(ink);
    for (const mesh of skin) {
      const hull = new SkinnedMesh(mesh.geometry, ink);
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.frustumCulled = false;
      mesh.parent?.add(hull);
    }

    // The springs take the hair, the ears and the skirt. Every other bone is put back to its rest
    // at the start of each frame.
    this.springs = new Springs(model, extras.springs ?? [], extras.colliders ?? []);
    const sprung = new Set(this.springs.bones());
    model.traverse((o) => {
      const bone = o as Bone;
      if (!bone.isBone) return;
      this.bones.set(bone.name, bone);
      if (!sprung.has(bone.name)) {
        this.rests.push({
          bone,
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
        });
      }
    });
    const need = (name: string): Bone => {
      const bone = this.bones.get(name);
      if (!bone) throw new Error(`Tetra has no bone called ${name}.`);
      return bone;
    };
    this.turned = TURNED.map(([channel, name, share]) => ({ channel, bone: need(name), share }));
    this.headBone = need("mixamorigHead");
    this.chestBone = need("mixamorigSpine1");

    // The arms, for the two-bone solve: the lengths of the upper arm and the forearm to the wrist.
    const limb = (side: "Left" | "Right") => {
      const arm = need(`mixamorig${side}Arm`);
      const fore = need(`mixamorig${side}ForeArm`);
      const hand = need(`mixamorig${side}Hand`);
      this.scene.updateMatrixWorld(true);
      const p = arm.getWorldPosition(new Vector3());
      const e = fore.getWorldPosition(new Vector3());
      const h = hand.getWorldPosition(new Vector3());
      return { arm, fore, hand, a: p.distanceTo(e), b: e.distanceTo(h) };
    };
    this.arm = { L: limb("Left"), R: limb("Right") };

    // Sockets: points that move with the bones. A hand's is the middle of the mitten.
    this.sockets.handL.name = "tetra_handL";
    this.sockets.handR.name = "tetra_handR";
    this.sockets.head.name = "tetra_head";
    this.arm.L.hand.add(this.sockets.handL);
    this.arm.R.hand.add(this.sockets.handR);
    this.headBone.add(this.sockets.head);
    this.sockets.handL.position.set(0, 0.03, 0);
    this.sockets.handR.position.set(0, 0.03, 0);
    this.sockets.head.position.set(0, 0.25, 0);

    // The clips, read straight from their tracks: no mixer, so a frame never depends on the last.
    for (const clip of animations) {
      const tracks: Sampler["tracks"] = [];
      for (const track of clip.tracks) {
        const dot = track.name.lastIndexOf(".");
        const bone = this.bones.get(track.name.slice(0, dot));
        if (!bone || sprung.has(bone.name)) continue;
        const make = track as unknown as { createInterpolant: (result?: unknown) => Interpolant };
        tracks.push({
          bone,
          place: track.name.endsWith(".position"),
          at: make.createInterpolant(undefined),
        });
      }
      this.samplers.set(clip.name, { seconds: clip.duration, tracks });
    }
    this.clipSecondsOf = (name) =>
      this.samplers.get(name)?.seconds ?? extras.clips?.[name]?.seconds ?? 1;
    this.walkSpeed = extras.clips?.walk?.speed ?? 0.186;

    const eyeTarget = (name: string) => eyes.morphTargetDictionary?.[name] ?? -1;
    this.eyeAt = {
      blinkL: eyeTarget("blink_L"),
      blinkR: eyeTarget("blink_R"),
      squeeze: eyeTarget("squeeze"),
      wide: eyeTarget("wide"),
      lookX: eyeTarget("look_x"),
      lookY: eyeTarget("look_y"),
    };
    this.root.updateMatrixWorld(true);
  }

  clipSeconds(name: ClipName): number {
    return this.clipSecondsOf(name);
  }

  /** The stage's size in CSS pixels. */
  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
  }

  /** Shaders and pictures go to the card now, not in the first frame she is shown. */
  warm(renderer: WebGLRenderer): void {
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    renderer.compile(this.scene, this.camera);
    for (const t of this.textures) renderer.initTexture(t);
  }

  /** The hair and the ears start again from rest (after a jump of the pose, or a pause). */
  settle(): void {
    this.springs.reset();
  }

  /** Lay a clip on the rest pose, as much of it as `weight` says. */
  private sample(name: ClipName, time: number, weight: number): void {
    const sampler = this.samplers.get(name);
    if (!sampler || weight <= 0) return;
    const t = ((time % sampler.seconds) + sampler.seconds) % sampler.seconds;
    for (const track of sampler.tracks) {
      const values = track.at.evaluate(t) as ArrayLike<number>;
      if (track.place) {
        this.v.set(values[0] ?? 0, (values[1] ?? 0) - CLIP_LIFT[name], values[2] ?? 0);
        track.bone.position.lerp(this.v, weight);
      } else {
        this.sampled.set(values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1);
        track.bone.quaternion.slerp(this.sampled, weight);
      }
    }
  }

  /**
   * Turn a bone about her own axes, on top of the pose it has. The bone's parent may be turned
   * already, so the turn is carried into the parent's frame as it is now.
   */
  private turn(bone: Bone, by: Turn, share: number): void {
    if (by.x === 0 && by.y === 0 && by.z === 0) return;
    this.up.identity();
    for (let at = bone.parent; at && at !== this.root; at = at.parent) {
      this.up.premultiply(at.quaternion);
    }
    this.twist.setFromEuler(this.euler.set(by.x * share, by.y * share, by.z * share));
    this.q.copy(this.up).invert().multiply(this.twist).multiply(this.up);
    bone.quaternion.premultiply(this.q);
  }

  /**
   * Swing a bone, about its own pivot, so that the line to `child` points at `goal` (both in her
   * frame, she is at the origin and unturned). `amount` is how much of the swing is made.
   */
  private aim(bone: Bone, child: Object3D, goal: Vector3, amount: number): void {
    bone.updateMatrixWorld(true);
    child.updateMatrixWorld(true);
    bone.getWorldPosition(this.shoulder);
    child.getWorldPosition(this.wrist);
    this.v.copy(this.wrist).sub(this.shoulder).normalize();
    this.w.copy(goal).sub(this.shoulder).normalize();
    this.twist.setFromUnitVectors(this.v, this.w);
    if (amount < 1) this.twist.identity().slerp(this.twist, amount);
    this.up.identity();
    for (let at = bone.parent; at && at !== this.root; at = at.parent) {
      this.up.premultiply(at.quaternion);
    }
    this.q.copy(this.up).invert().multiply(this.twist).multiply(this.up);
    bone.quaternion.premultiply(this.q);
    bone.updateMatrixWorld(true);
  }

  /** Put a hand on a point in her frame, as far as the arm reaches, bending toward `pole`. */
  private reach(side: "L" | "R", target: { x: number; y: number; z: number; w: number }): void {
    const limb = this.arm[side];
    this.root.updateMatrixWorld(true);
    limb.arm.getWorldPosition(this.shoulder);
    limb.fore.getWorldPosition(this.elbow);
    this.goal.set(target.x, target.y, target.z);
    // The elbow bends down and out, and a little back.
    this.pole.set(side === "L" ? 0.6 : -0.6, -1, -0.3);
    solveTwoBone(this.shoulder, this.goal, this.pole, limb.a, limb.b, this.elbowOut);
    this.v.set(this.elbowOut.x, this.elbowOut.y, this.elbowOut.z);
    // Upper arm toward the elbow, then the forearm toward the point (or as far as it goes).
    this.aim(limb.arm, limb.fore, this.v, target.w);
    this.w.copy(this.goal);
    limb.arm.getWorldPosition(this.shoulder);
    // The wrist can only get as far as the forearm reaches from the new elbow.
    limb.fore.getWorldPosition(this.elbow);
    this.v.copy(this.goal).sub(this.elbow);
    const len = this.v.length();
    if (len > limb.b) this.v.multiplyScalar(limb.b / len);
    this.w.copy(this.elbow).add(this.v);
    this.aim(limb.fore, limb.hand, this.w, target.w);
  }

  /** Lay the pose on the bones and the face on the morphs. Her place is set after, by `place`. */
  pose(c: Channels, face: FaceDraw, dt: number): void {
    // The bones are posed with her at the origin and unturned, so a frame's world is her frame.
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(1, 1, 1);
    for (const rest of this.rests) {
      rest.bone.position.copy(rest.position);
      rest.bone.quaternion.copy(rest.quaternion);
    }
    if (c.clip) this.sample(c.clip, c.clipTime, c.clipWeight);
    for (const { channel, bone, share } of this.turned) this.turn(bone, c[channel], share);
    this.turn(this.headBone, SQUARE, 1);
    this.root.updateMatrixWorld(true);
    if (c.reachL.w > 0.001) this.reach("L", c.reachL);
    if (c.reachR.w > 0.001) this.reach("R", c.reachR);

    // Her place and attitude, and the squash.
    this.root.position.set(c.x, c.y, c.z);
    this.root.rotation.set(c.pitch, c.yaw, c.roll);
    this.root.scale.set(this.view.flip ? -1 : 1, 1, 1);
    const wide = 1 / Math.sqrt(Math.max(0.3, c.squash));
    this.squash.value.set(wide, c.squash, wide);
    this.root.updateMatrixWorld(true);

    // The springs, last.
    this.springs.update(dt);

    const eye = this.eyes.morphTargetInfluences;
    if (eye) {
      eye[this.eyeAt.blinkL ?? -1] = face.blinkL;
      eye[this.eyeAt.blinkR ?? -1] = face.blinkR;
      eye[this.eyeAt.squeeze ?? -1] = face.squeeze;
      eye[this.eyeAt.wide ?? -1] = face.wide;
      eye[this.eyeAt.lookX ?? -1] = face.lookX;
      eye[this.eyeAt.lookY ?? -1] = face.lookY;
    }
    const lips = this.mouth.morphTargetInfluences;
    if (lips) {
      lips.fill(0);
      const at = this.mouth.morphTargetDictionary?.[face.mouth];
      if (at !== undefined) lips[at] = face.mouthSize;
    }
  }

  /**
   * Put her on the screen: the lens is moved until she is `tall` pixels high where she stands and
   * her mark lies at (`markX`, `groundY`). Then the marks are read back, in the stage's frame.
   */
  frame(view: View): void {
    this.view = view;
    const { width, height, tall } = view;
    const perMetre = Math.max(30, tall) / TETRA_HEIGHT;
    const distance = height / (2 * Math.tan((FOV * Math.PI) / 360) * perMetre);
    const lookAt = TETRA_HEIGHT * 0.5;
    const cam = this.camera;
    cam.aspect = width / height;
    cam.clearViewOffset();
    cam.position.set(0, lookAt + distance * Math.sin(LOOK_DOWN), distance * Math.cos(LOOK_DOWN));
    cam.lookAt(0, lookAt, 0);
    cam.near = Math.max(0.1, distance - 3);
    cam.far = distance + 6;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    // Her mark is drawn where the page says it is: the view is slid until it lies there.
    this.v.set(0, 0, 0).project(cam);
    const x = (this.v.x * 0.5 + 0.5) * width;
    const y = (0.5 - this.v.y * 0.5) * height;
    cam.setViewOffset(width, height, x - view.markX, y - view.groundY, width, height);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    this.outline.value = clamp(tall * 0.0034, 1, 2.3) / perMetre;
  }

  /** Where the head, the hands and the feet came out, after `pose` and `frame`. */
  readMarks(): Marks {
    const m = this.marks;
    this.v.set(0, 0.075, 0.09).applyMatrix4(this.headBone.matrixWorld);
    this.project(m.head);
    this.v.set(0, 0.25, 0).applyMatrix4(this.headBone.matrixWorld);
    this.project(m.crown);
    this.v.setFromMatrixPosition(this.chestBone.matrixWorld);
    const cx = this.v.x;
    const cz = this.v.z;
    this.project(m.chest);
    this.sockets.handL.getWorldPosition(this.v);
    this.project(m.handL);
    this.sockets.handR.getWorldPosition(this.v);
    this.project(m.handR);
    this.v.set(cx, 0, cz);
    this.project(m.ground);
    this.v.set(cx, 0.1, cz);
    this.project(this.tenCm);
    m.scale = Math.hypot(this.tenCm.x - m.ground.x, this.tenCm.y - m.ground.y) * 10;
    return m;
  }

  private readonly tenCm: Point2 = { x: 0, y: 0 };

  /** The point in `v` (world metres) to the stage's frame: the middle of the screen, y up. */
  private project(out: Point2): void {
    this.v.project(this.camera);
    out.x = this.v.x * 0.5 * this.view.width;
    out.y = this.v.y * 0.5 * this.view.height;
  }

  /** A world point (her metres) on the screen, in the stage's frame. */
  toStage(world: Vector3, out: Point2): Point2 {
    this.v.copy(world);
    this.project(out);
    return out;
  }

  /** The world position of a socket, in metres (for the props that follow a hand). */
  socketPosition(name: "handL" | "handR" | "head", out: Vector3): Vector3 {
    return this.sockets[name].getWorldPosition(out);
  }

  /** Draw her. The renderer's state is the stage's: nothing is cleared here. */
  draw(renderer: WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    for (const t of this.textures) t.dispose();
    this.disposables.length = 0;
    this.textures.clear();
    this.scene.clear();
  }
}
