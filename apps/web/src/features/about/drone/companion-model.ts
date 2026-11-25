import {
  BackSide,
  type Camera,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { loadMedia } from "@/lib/media-store";

import {
  FACE_FRAGMENT_HEAD,
  FACE_FRAGMENT_MAP,
  FACE_GOLD,
  FACE_PINK,
  FACE_RED,
  FACE_VERTEX_BODY,
  FACE_VERTEX_HEAD,
  makeFaceUniforms,
  packFace,
  type FaceUniforms,
} from "../companions/face";
import { BALL_RADIUS, COMPANION_MODEL, COMPANION_MODEL_BYTES } from "../companions/model";
import type { CompanionPose, EarPose, GlovePose } from "../companions/pose";

/**
 * Guinevere's two drones, as the drone's scene draws them (`drone-scene.ts`), in its flat pass of
 * the friends: one unit a CSS pixel, so a place the choreography works out is the place on the
 * canvas. The file holds one drone (the two sources are one model, `scripts/about/companions/`): it
 * is built twice from the same six shapes. Every frame each is handed its pose
 * (`companions/pose.ts`) and laid out. Until 25 Nov 2026 this drew them on a canvas of their own in
 * a corner of the fourth phase; they now fly with the drone on its canvas.
 */

const INK = 0x2a3342;
/** The outline's width on the screen, in CSS pixels. */
const OUTLINE_PX = 1.15;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

type PartName = "body" | "face" | "ear_L" | "ear_R" | "glove_L" | "glove_R";
const PARTS: readonly PartName[] = ["body", "face", "ear_L", "ear_R", "glove_L", "glove_R"];

interface Extras {
  screen?: { y: number; halfWidth: number };
}

/** One drone, built from the file's shapes. */
interface Built {
  /** Its place and its size. */
  actor: Group;
  /** The squash, along the screen's own up. */
  ball: Group;
  /** Its attitude. */
  lean: Group;
  body: Mesh;
  earL: Mesh;
  earR: Mesh;
  gloveL: Mesh;
  gloveR: Mesh;
  earRestL: Quaternion;
  earRestR: Quaternion;
  face: FaceUniforms;
  outline: { value: number };
}

export interface Companions {
  /** The two, the bold one first: their groups, for the scene to show or hide. */
  readonly actors: readonly [Group, Group];
  /** Lay one out from its pose. `height` is the canvas's height in CSS pixels. */
  place: (who: 0 | 1, pose: CompanionPose, height: number) => void;
  /** Send the shaders and the picture to the card now, not in the first frame they show. */
  warm: (renderer: WebGLRenderer, camera: Camera) => void;
  dispose: () => void;
}

/** Load the file through the media store (the loading list's copy when there is one). */
export async function loadCompanionFile(): Promise<Object3D> {
  const url = await loadMedia(COMPANION_MODEL, {
    type: "model/gltf-binary",
    expectedBytes: COMPANION_MODEL_BYTES,
  });
  const bytes = await (await fetch(url)).arrayBuffer();
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  return gltf.scene;
}

/** Build the two from the file into `scene`. Throws on a file that is not the companion's. */
export function buildCompanions(file: Object3D, scene: Scene): Companions {
  const model = file.getObjectByName("companion");
  if (!model) throw new Error("The file is not the companion's model.");
  const screen = (model.userData as Extras).screen;
  if (!screen) throw new Error("The companion's file does not say where its screen is.");
  const source = {} as Record<PartName, Mesh>;
  for (const name of PARTS) {
    const part = model.getObjectByName(name);
    if (!(part instanceof Mesh)) throw new Error(`The companion has no part called ${name}.`);
    source[name] = part as Mesh;
  }

  const disposables: Array<{ dispose: () => void }> = [];
  const textures = new Set<Texture>();
  const paint = source.body.material as MeshBasicMaterial;
  paint.toneMapped = false;
  disposables.push(paint, source.face.material as MeshBasicMaterial);
  for (const name of PARTS) disposables.push(source[name].geometry);
  const map = paint.map;
  if (map) textures.add(map);

  const linear = (hex: number) => new Color(hex).toArray();

  /** A screen of its own for each drone: the same glass, its own face. */
  const glass = (): { material: MeshBasicMaterial; uniforms: FaceUniforms } => {
    const uniforms = makeFaceUniforms();
    uniforms.uScreen.value = [screen.y, 1 / screen.halfWidth];
    uniforms.uGold.value = linear(FACE_GOLD);
    uniforms.uRed.value = linear(FACE_RED);
    uniforms.uPink.value = linear(FACE_PINK);
    const material = new MeshBasicMaterial({ map, toneMapped: false });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
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
    // Both screens compile to one program: the difference is in the uniforms.
    material.customProgramCacheKey = () => "companion-face";
    disposables.push(material);
    return { material, uniforms };
  };

  /**
   * The thin ink line round every part, as round the page's drone: the part again, pushed out
   * along its normals and drawn inside out. The file's normals are the mean at each place, so the
   * hull has no gaps at the hard edges.
   */
  const hull = (width: { value: number }): MeshBasicMaterial => {
    const material = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uOutline = width;
      shader.vertexShader = `uniform float uOutline;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "vec3 transformed = position + normal * uOutline;",
      );
    };
    material.customProgramCacheKey = () => "companion-hull";
    disposables.push(material);
    return material;
  };

  const build = (): Built => {
    const face = glass();
    const outline = { value: 0 };
    const ink = hull(outline);
    const part = (name: PartName, lined: boolean): Mesh => {
      const from = source[name];
      const mesh = new Mesh(from.geometry, name === "face" ? face.material : paint);
      mesh.position.copy(from.position);
      mesh.quaternion.copy(from.quaternion);
      // The parts move far from where their boxes were worked out: none is ever culled.
      mesh.frustumCulled = false;
      if (lined) {
        const line = new Mesh(from.geometry, ink);
        line.frustumCulled = false;
        mesh.add(line);
      }
      return mesh;
    };
    const actor = new Group();
    const ball = new Group();
    const lean = new Group();
    lean.rotation.order = "YXZ";
    const body = part("body", true);
    const earL = part("ear_L", true);
    const earR = part("ear_R", true);
    const gloveL = part("glove_L", true);
    const gloveR = part("glove_R", true);
    gloveL.rotation.order = "YXZ";
    gloveR.rotation.order = "YXZ";
    body.add(part("face", false), earL, earR);
    lean.add(body);
    ball.add(lean);
    actor.add(ball, gloveL, gloveR);
    actor.visible = false;
    scene.add(actor);
    return {
      actor,
      ball,
      lean,
      body,
      earL,
      earR,
      gloveL,
      gloveR,
      earRestL: earL.quaternion.clone(),
      earRestR: earR.quaternion.clone(),
      face: face.uniforms,
      outline,
    };
  };
  const built = [build(), build()] as const;

  const q = new Quaternion();
  /** An ear: its rest, then the splay, the fold and the twist about its own axes. */
  const ear = (mesh: Mesh, rest: Quaternion, pose: EarPose, side: number) => {
    mesh.quaternion.copy(rest);
    mesh.quaternion.multiply(q.setFromAxisAngle(Z, side * pose.splay));
    mesh.quaternion.multiply(q.setFromAxisAngle(X, pose.fold));
    mesh.quaternion.multiply(q.setFromAxisAngle(Y, side * pose.twist));
  };
  const glove = (mesh: Mesh, pose: GlovePose) => {
    mesh.position.set(pose.x * BALL_RADIUS, pose.y * BALL_RADIUS, pose.z * BALL_RADIUS);
    mesh.rotation.set(pose.rx, pose.ry, pose.rz);
    mesh.scale.setScalar(pose.size);
  };

  return {
    actors: [built[0].actor, built[1].actor],
    place: (who, pose, height) => {
      const one = built[who];
      const perMetre = Math.max(1, pose.radius) / BALL_RADIUS;
      // The screen counts down from its top edge, the view up from its bottom edge.
      one.actor.position.set(pose.x, height - pose.y, pose.z);
      one.actor.scale.setScalar(perMetre);
      const wide = 1 / Math.sqrt(Math.max(0.3, pose.squash));
      one.ball.scale.set(wide, pose.squash, wide);
      one.lean.rotation.set(pose.pitch, pose.yaw, pose.roll);
      one.body.rotation.z = pose.spin;
      ear(one.earL, one.earRestL, pose.earL, -1);
      ear(one.earR, one.earRestR, pose.earR, 1);
      glove(one.gloveL, pose.gloveL);
      glove(one.gloveR, pose.gloveR);
      packFace(one.face, pose.face, pose.live);
      one.outline.value = OUTLINE_PX / perMetre;
    },
    warm: (renderer, camera) => {
      for (const b of built) b.actor.visible = true;
      try {
        renderer.compile(scene, camera);
        for (const t of textures) renderer.initTexture(t);
      } finally {
        for (const b of built) b.actor.visible = false;
      }
    },
    dispose: () => {
      for (const b of built) b.actor.removeFromParent();
      for (const d of disposables) d.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
