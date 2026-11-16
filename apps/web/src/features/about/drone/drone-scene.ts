import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  SkinnedMesh,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Bone,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { loadMedia } from "@/lib/media-store";

import type { FaceFrame } from "../choreo/face";
import type { FaceName } from "../choreo/path";
import type { RigPose } from "../choreo/rig";
import { DRONE_MODEL } from "../media";

import { BODY_METRES } from "./model";

/**
 * The drone, drawn. This is the lazy part of the page: three, the loader and the model. It knows
 * nothing of the scroll or the opening: every frame it is handed a place on the screen, a size,
 * an attitude, the pose of the rig and the face, and draws that.
 *
 * The drone never leaves the origin. One narrow lens looks at it, and the picture is slid over
 * the screen with the camera's view offset, so the drone is not sheared at the edge of the
 * screen, and its size is the group's scale.
 */
export interface DroneDraw {
  /** The centre on the screen and the width, in CSS pixels. */
  x: number;
  y: number;
  size: number;
  /** Radians. Yaw turns the face to the right, pitch puts the nose down, roll is anticlockwise. */
  yaw: number;
  pitch: number;
  roll: number;
  rig: RigPose;
  face: FaceFrame;
  /** How strong the trail behind the drone is, 0 to 1, and where the drone has just been. */
  trail: number;
  trailPoints: readonly TrailPoint[];
}

/** A place the drone was at, on the screen, and how old it is (0 now, 1 as old as a trail gets). */
export interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

export interface DroneScene {
  draw: (frame: DroneDraw) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

interface Hooks {
  /** The browser took the context away. Nothing is drawn until `onRestored`. */
  onLost: () => void;
  onRestored: () => void;
}

/** The lens: narrow, so the drone is drawn almost without perspective. */
const FOV = 20;
const DISTANCE = 8;
const VIEW_HEIGHT = 2 * DISTANCE * Math.tan((FOV * Math.PI) / 360);

const INK = 0x1f2735;
const CYAN = 0x23d0d8;

/** Where each drawing is in the face's atlas, in cells from the plain one. */
const CELL: Record<FaceName, readonly [number, number]> = {
  normal: [0, 0],
  angry: [-1, 0],
  squint: [1, 0],
  happy: [-1, -1],
  dead: [0, -1],
  scan: [1, -1],
  ecg: [-1, -2],
  sleepy: [0, -2],
  alert: [1, -2],
};

/** The most points a trail is drawn from. */
const TRAIL_POINTS = 24;

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

interface Part {
  bone: Bone;
  rest: Quaternion;
}

/** The ribbon behind the drone: three corners across for every place it has been. */
interface Trail {
  mesh: Mesh<BufferGeometry, ShaderMaterial>;
  position: BufferAttribute;
  alpha: BufferAttribute;
}

function part(root: Object3D, name: string): Part {
  const bone = root.getObjectByName(name) as Bone | undefined;
  if (!bone) throw new Error(`The drone has no bone called ${name}.`);
  return { bone, rest: bone.quaternion.clone() };
}

/**
 * The same normal for every corner that shares a point, so the outline's hull has no gaps where
 * the model has a hard edge.
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
      n.copy(sums.get(key(g, i)) ?? Z).normalize();
      smooth.set([n.x, n.y, n.z], i * 3);
    }
    g.setAttribute("aSmooth", new BufferAttribute(smooth, 3));
  }
}

function makeTrail(color: Color): Trail {
  const geometry = new BufferGeometry();
  const position = new BufferAttribute(new Float32Array(TRAIL_POINTS * 3 * 3), 3);
  const alpha = new BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 1);
  position.setUsage(DynamicDrawUsage);
  alpha.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", position);
  geometry.setAttribute("aAlpha", alpha);
  const index: number[] = [];
  for (let i = 0; i < TRAIL_POINTS - 1; i += 1) {
    const a = i * 3;
    index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
  }
  geometry.setIndex(index);
  geometry.setDrawRange(0, 0);
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: color } },
    vertexShader: [
      "attribute float aAlpha;",
      "varying float vAlpha;",
      "void main() {",
      "  vAlpha = aAlpha;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}",
    ].join("\n"),
    fragmentShader: [
      "uniform vec3 uColor;",
      "varying float vAlpha;",
      "void main() {",
      "  gl_FragColor = vec4(uColor, vAlpha);",
      "  #include <colorspace_fragment>",
      "}",
    ].join("\n"),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return { mesh, position, alpha };
}

/**
 * Lay the trail out as a ribbon: as wide as `width` where the drone is (the drone itself covers
 * that end), narrowing to nothing at its old end, and fading both along its length and toward its
 * two edges, so it is a soft streak with no hard side.
 */
function buildTrail(
  trail: Trail,
  pts: readonly TrailPoint[],
  strength: number,
  width: number,
): void {
  const n = Math.min(pts.length, TRAIL_POINTS);
  if (n < 3 || strength <= 0.01) {
    trail.mesh.geometry.setDrawRange(0, 0);
    return;
  }
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    if (!p || !a || !b) continue;
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const left = 1 - Math.min(1, Math.max(0, p.age));
    const half = width * 0.5 * Math.pow(left, 0.8);
    trail.position.setXYZ(i * 3, p.x + nx * half, p.y + ny * half, 0);
    trail.position.setXYZ(i * 3 + 1, p.x, p.y, 0);
    trail.position.setXYZ(i * 3 + 2, p.x - nx * half, p.y - ny * half, 0);
    trail.alpha.setX(i * 3, 0);
    trail.alpha.setX(i * 3 + 1, strength * left * left);
    trail.alpha.setX(i * 3 + 2, 0);
  }
  trail.position.needsUpdate = true;
  trail.alpha.needsUpdate = true;
  trail.mesh.geometry.setDrawRange(0, (n - 1) * 12);
}

/**
 * Build the scene on `canvas`. The model comes through the media store, so it is the copy the
 * loading screen fetched when there is one, and it is fetched here when there is none.
 */
export async function createDroneScene(
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): Promise<DroneScene> {
  const url = await loadMedia(DRONE_MODEL, { type: "model/gltf-binary" });
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
    // A file that is not the drone: the context is given back, the caller shows the still.
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}

/**
 * The drawing surface is as sharp as the display, up to two device pixels a point, and never more
 * than this many pixels in all: the canvas covers the whole screen for a drone that is often
 * small, and a 4K display at two would clear and present eight million of them every frame. The
 * same rule for everyone, read from the size of the canvas only.
 */
const PIXEL_BUDGET = 8e6;

function pixelRatio(width: number, height: number): number {
  const wanted = Math.min(window.devicePixelRatio || 1, 2);
  return Math.min(wanted, Math.sqrt(PIXEL_BUDGET / Math.max(1, width * height)));
}

function assemble(
  renderer: WebGLRenderer,
  model: Object3D,
  canvas: HTMLCanvasElement,
  hooks: Hooks,
): DroneScene {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.autoClear = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 40);
  camera.position.set(0, 0, DISTANCE);
  camera.updateMatrixWorld(true);

  // The group carries the place in the air: its scale is the size, its turn the attitude.
  const body = new Group();
  body.rotation.order = "YXZ";
  body.add(model);
  scene.add(body);
  model.updateMatrixWorld(true);

  const meshes: SkinnedMesh[] = [];
  const disposables: Array<{ dispose: () => void }> = [];
  const textures: Texture[] = [];
  model.traverse((o) => {
    if (o instanceof SkinnedMesh) meshes.push(o as SkinnedMesh);
  });
  if (meshes.length === 0) throw new Error("The drone's file holds no skinned mesh.");

  // The paint already carries the shading: unlit, as painted.
  const faceUniforms = {
    uBlink: { value: 0 },
    uLook: { value: new Vector2(0, 0) },
    uCell: { value: new Vector2(0, 0) },
  };
  for (const mesh of meshes) {
    // A skinned mesh's box is its rest pose: the wings would be culled when they open.
    mesh.frustumCulled = false;
    const material = mesh.material as Material;
    disposables.push(mesh.geometry, material);
    if (!(material instanceof MeshBasicMaterial)) continue;
    material.toneMapped = false;
    if (material.map) {
      textures.push(material.map);
      material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    }
    if (material.name !== "drone_face" || !material.map) continue;
    // The face is one atlas of nine drawings. The shader picks the cell, squashes the eyes
    // toward their middle for a blink, and slides them to look.
    material.map.wrapS = RepeatWrapping;
    material.map.wrapT = RepeatWrapping;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, faceUniforms);
      shader.fragmentShader =
        "uniform float uBlink;\nuniform vec2 uLook;\nuniform vec2 uCell;\n" +
        shader.fragmentShader.replace(
          "#include <map_fragment>",
          [
            "vec2 fuv = vMapUv;",
            "vec2 cell = floor(fuv * 3.0 + vec2(0.0, 0.02)) / 3.0;",
            "vec2 local = (fuv - cell) * 3.0 - uLook;",
            "local.y = 0.585 + (local.y - 0.585) / max(1.0 - uBlink, 0.06);",
            "local = clamp(local, 0.03, 0.97);",
            "vec4 sampledDiffuseColor = texture2D(map, cell + (uCell + local) / 3.0);",
            "diffuseColor *= sampledDiffuseColor;",
          ].join("\n"),
        );
    };
    material.needsUpdate = true;
  }

  // A thin ink line round the drone, so the pale wings read on paper: the same skin again,
  // pushed out along its normals and drawn inside out. It follows the bones.
  smoothNormals(meshes);
  const outline = { value: 0 };
  const ink = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
  ink.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = outline;
    shader.vertexShader =
      "attribute vec3 aSmooth;\nuniform float uOutline;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "vec3 transformed = position + aSmooth * uOutline;",
      );
  };
  disposables.push(ink);
  for (const mesh of meshes) {
    const hull = new SkinnedMesh(mesh.geometry, ink);
    hull.bind(mesh.skeleton, mesh.bindMatrix);
    hull.frustumCulled = false;
    mesh.parent?.add(hull);
  }

  // The bones. The glowing strip behind each fin is on a bone of its own that is not the fin's
  // child: it is given to the fin here, so the blade does not leave its strip behind.
  const root = model;
  const wingL = part(root, "wing_L");
  const wingR = part(root, "wing_R");
  const finL = part(root, "fin_L");
  const finR = part(root, "fin_R");
  finL.bone.attach(part(root, "antenna_L_01").bone);
  finR.bone.attach(part(root, "antenna_R_01").bone);
  const stripL = part(root, "antenna_L_02");
  const stripR = part(root, "antenna_R_02");

  // The trail is drawn flat on the screen, under the drone, in pixels.
  const flat = new Scene();
  const flatCamera = new OrthographicCamera(0, 1, 0, 1, -1, 1);
  const cyan = new Color(CYAN);
  const trail = makeTrail(cyan);
  flat.add(trail.mesh);
  disposables.push(trail.mesh.geometry, trail.mesh.material);

  let width = 1;
  let height = 1;
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

  const q = new Quaternion();
  const turn = new Quaternion();
  /** A bone's rest pose, then turns about its own axes, in the order given. */
  const pose = (p: Part, turns: ReadonlyArray<readonly [Vector3, number]>) => {
    q.copy(p.rest);
    for (const [axis, angle] of turns) q.multiply(turn.setFromAxisAngle(axis, angle));
    p.bone.quaternion.copy(q);
  };

  let ratio = 0;
  const resize = (w: number, h: number) => {
    const nextW = Math.max(1, w);
    const nextH = Math.max(1, h);
    const nextRatio = pixelRatio(nextW, nextH);
    // The same size again (a measure that found nothing new): the surface is left alone.
    if (nextW === width && nextH === height && nextRatio === ratio) return;
    width = nextW;
    height = nextH;
    if (nextRatio !== ratio) {
      ratio = nextRatio;
      renderer.setPixelRatio(ratio);
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    flatCamera.right = width;
    flatCamera.bottom = height;
    flatCamera.updateProjectionMatrix();
  };

  const draw = (f: DroneDraw) => {
    if (lost || disposed) return;
    // Pixels for a metre of the model at this size.
    const perMetre = Math.max(1, f.size) / BODY_METRES;
    body.scale.setScalar((perMetre * VIEW_HEIGHT) / height);
    body.rotation.set(f.pitch, f.yaw, f.roll);
    // The origin is drawn in the middle of the full view: slide the view so that is (x, y).
    camera.setViewOffset(width, height, width / 2 - f.x, height / 2 - f.y, width, height);

    // A wing is spread outward, then raised, then turned flat. The two sides share a frame, so
    // the turns about the bone's own Z and Y take opposite signs.
    const r = f.rig;
    pose(wingL, [
      [Z, -r.wingSpreadL],
      [X, r.wingRaiseL],
      [Y, -r.wingTwistL],
    ]);
    pose(wingR, [
      [Z, r.wingSpreadR],
      [X, r.wingRaiseR],
      [Y, r.wingTwistR],
    ]);
    pose(finL, [
      [Z, -r.finSplayL],
      [X, r.finStandL],
    ]);
    pose(finR, [
      [Z, r.finSplayR],
      [X, r.finStandR],
    ]);
    pose(stripL, [[X, r.stripL]]);
    pose(stripR, [[X, r.stripR]]);

    const cell = CELL[f.face.cell];
    faceUniforms.uCell.value.set(cell[0], cell[1]);
    faceUniforms.uBlink.value = f.face.blink;
    faceUniforms.uLook.value.set(f.face.lookX, f.face.lookY);
    // The line keeps its width on the screen whatever the drone's size.
    const line = Math.min(2.4, Math.max(1.1, f.size * 0.0042));
    outline.value = line / perMetre;

    buildTrail(trail, f.trailPoints, f.trail * 0.6, f.size * 0.3);

    renderer.clear();
    if (f.trail > 0.01) renderer.render(flat, flatCamera);
    renderer.render(scene, camera);
  };

  resize(canvas.clientWidth, canvas.clientHeight);
  // Shaders and pictures go to the card now, not in the first frame of the flight.
  renderer.compile(scene, camera);
  renderer.compile(flat, flatCamera);
  for (const t of textures) renderer.initTexture(t);

  return {
    draw,
    resize,
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
