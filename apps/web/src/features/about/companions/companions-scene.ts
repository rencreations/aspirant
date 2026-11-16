import {
  BackSide,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
  type Texture,
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
} from "./face";
import { BALL_RADIUS, COMPANION_MODEL, COMPANION_MODEL_BYTES } from "./model";
import type { Cast, CompanionPose, EarPose, GlovePose } from "./pose";

/**
 * Guinevere's two drones, drawn. This is the lazy part of their stage: three, the loader and the
 * model. It knows nothing of the story they play: every frame it is handed two poses (`pose.ts`)
 * and draws them.
 *
 * The view is flat (no perspective), one unit a CSS pixel, so a place the performance works out
 * is the place on the canvas: the comic marks, the buttons and the page's own drone, which is
 * drawn on another canvas above this one, all meet the picture exactly. The file holds one drone
 * (the two sources are one model): it is built twice from the same six shapes.
 */
export interface CompanionsScene {
  draw: (cast: Cast) => void;
  /** The canvas, in CSS pixels. */
  layout: (width: number, height: number) => void;
  dispose: () => void;
}

interface Hooks {
  /** The browser took the context away. Nothing is drawn until `onRestored`. */
  onLost: () => void;
  onRestored: () => void;
}

const INK = 0x2a3342;
/** The outline's width on the screen, in CSS pixels. */
const OUTLINE_PX = 1.15;
/** No more than this many pixels are drawn, whatever the display (see the drone's scene). */
const PIXEL_BUDGET = 4e6;
/** The camera stands this far in front of the stage, in pixels: everything is well inside. */
const DEPTH = 4000;

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
  /** The squash, along the stage's own up. */
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

function pixelRatio(width: number, height: number): number {
  const wanted = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(wanted, Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)));
}

/** Build the scene on `canvas`. The model comes through the media store, saved for next time. */
export async function createCompanionsScene(
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): Promise<CompanionsScene> {
  const url = await loadMedia(COMPANION_MODEL, {
    type: "model/gltf-binary",
    expectedBytes: COMPANION_MODEL_BYTES,
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
    return assemble(renderer, gltf.scene, canvas, hooks);
  } catch (error) {
    // A file that is not the companion: the context is given back, the stage stays empty.
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}

function assemble(
  renderer: WebGLRenderer,
  file: Object3D,
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): CompanionsScene {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const model = file.getObjectByName("companion");
  if (!model) throw new Error("The file is not the companion's model.");
  const extras = model.userData as Extras;
  const screen = extras.screen;
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
  if (map) {
    textures.add(map);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

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

  const scene = new Scene();
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

  const camera = new OrthographicCamera(0, 1, 1, 0, 1, DEPTH * 2);
  camera.position.set(0, 0, DEPTH);

  let width = 0;
  let height = 0;
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

  const layout = (w: number, h: number) => {
    const nextW = Math.max(1, Math.round(w));
    const nextH = Math.max(1, Math.round(h));
    const nextRatio = pixelRatio(nextW, nextH);
    if (nextW === width && nextH === height && nextRatio === ratio) return;
    if (nextRatio !== ratio) {
      ratio = nextRatio;
      renderer.setPixelRatio(ratio);
    }
    width = nextW;
    height = nextH;
    renderer.setSize(width, height, false);
    camera.right = width;
    camera.top = height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  };

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

  const place = (one: Built, pose: CompanionPose) => {
    const perMetre = Math.max(1, pose.radius) / BALL_RADIUS;
    // The stage counts down from its top edge, the view up from its bottom edge.
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
  };

  const draw = (cast: Cast) => {
    if (disposed || lost) return;
    place(built[0], cast[0]);
    place(built[1], cast[1]);
    renderer.render(scene, camera);
  };

  layout(canvas.clientWidth, canvas.clientHeight);
  // Shaders and the picture go to the card now, not in the first frame of the entrance.
  renderer.compile(scene, camera);
  for (const t of textures) renderer.initTexture(t);

  return {
    draw,
    layout,
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
