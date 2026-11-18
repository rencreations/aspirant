/**
 * The drone, drawn. This is the three.js side of the actor: the model, its look and the lens it is
 * seen through. It is the About page's scene (`about/drone/drone-scene.ts`) with the parts that
 * belonged to a page of its own taken out: it has no renderer, no canvas and no context-loss
 * listeners (the stage owns them), and it never clears the screen (the stage does, once).
 *
 * The look is the About look and the same code: unlit, the paint carries the shading; one narrow
 * lens (20 degrees, 8 m away) always looks at the drone at the origin and the picture is slid over
 * the screen with the camera's view offset, so the drone is never sheared at the edge of the
 * screen; a thin ink line round it that keeps its width on the screen; the face is an atlas the
 * shader reads one cell of, squashes for a blink and slides to look. The home adds two more pages
 * of faces: the face material swaps its map for the page of the face that is shown.
 */
import {
  BackSide,
  BufferAttribute,
  type BufferGeometry,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  Quaternion,
  RepeatWrapping,
  Scene,
  SkinnedMesh,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  type Bone,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderer,
} from "three";

import { loadMedia } from "@/lib/media-store";

import { clamp } from "./ease";
import { FACES, type AtlasPage, type FaceName } from "./faces";
import { forgetGltf, loadGltf } from "../shared/gltf";
import {
  BODY_METRES,
  DISTANCE,
  DRONE_MODEL,
  FACES_A,
  FACES_B,
  FOV,
  INK,
  VIEW_HEIGHT,
} from "./model";
import type { RigPose } from "./rig";

/** What the scene is handed to draw. Screen frame: the middle of the screen, y down, CSS pixels. */
export interface DroneDraw {
  x: number;
  y: number;
  /** The About size: `BODY_METRES` of the model across, in pixels. */
  size: number;
  yaw: number;
  pitch: number;
  roll: number;
  rig: RigPose;
  face: FaceName;
  blink: number;
  lookX: number;
  lookY: number;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

interface Part {
  bone: Bone;
  rest: Quaternion;
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

/** One page of faces, from the media store (the loading list's copy when there is one). */
async function loadAtlas(path: string): Promise<Texture | null> {
  try {
    const url = await loadMedia(path, { type: "image/webp" });
    const texture = await new TextureLoader().loadAsync(url);
    // Laid out as the model's own picture is: not flipped, drawn in sRGB, repeating.
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  } catch (error) {
    console.warn(`[drone] ${path} did not load: its faces fall back to the plain one`, error);
    return null;
  }
}

export class DroneModel {
  /** The drone's group: scale is the size, rotation the attitude. Its `visible` is the actor's. */
  readonly root = new Group();
  readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.5, 40);
  private width = 1;
  private height = 1;

  private readonly faceMaterial: MeshBasicMaterial | null;
  private readonly pages: Record<AtlasPage, Texture | null>;
  private readonly uniforms = {
    uBlink: { value: 0 },
    uLook: { value: new Vector2(0, 0) },
    uCell: { value: new Vector2(0, 0) },
  };
  private readonly outline = { value: 0 };
  private readonly meshes: SkinnedMesh[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly textures: Texture[] = [];
  private readonly wingL: Part;
  private readonly wingR: Part;
  private readonly finL: Part;
  private readonly finR: Part;
  private readonly stripL: Part;
  private readonly stripR: Part;
  private readonly q = new Quaternion();
  private readonly turn = new Quaternion();
  private page: AtlasPage = "S";

  /** Load the model and the two extra pages of faces. */
  static async load(): Promise<DroneModel> {
    const [gltf, a, b] = await Promise.all([
      loadGltf(DRONE_MODEL),
      loadAtlas(FACES_A),
      loadAtlas(FACES_B),
    ]);
    // The parsed copy is changed by this build (a hull on every skin, a bone moved), so it is never
    // handed to anyone else: whatever happens, the next ask parses a fresh one.
    forgetGltf(DRONE_MODEL);
    return new DroneModel(gltf.scene, a, b);
  }

  private constructor(model: Object3D, a: Texture | null, b: Texture | null) {
    this.root.rotation.order = "YXZ";
    this.root.add(model);
    this.scene.add(this.root);
    this.camera.position.set(0, 0, DISTANCE);
    this.camera.updateMatrixWorld(true);
    model.updateMatrixWorld(true);

    model.traverse((o) => {
      if ((o as SkinnedMesh).isSkinnedMesh) this.meshes.push(o as SkinnedMesh);
    });
    if (this.meshes.length === 0) throw new Error("The drone's file holds no skinned mesh.");

    let faceMaterial: MeshBasicMaterial | null = null;
    let own: Texture | null = null;
    const uniforms = this.uniforms;
    for (const mesh of this.meshes) {
      // A skinned mesh's box is its rest pose: the wings would be culled when they open.
      mesh.frustumCulled = false;
      const material = mesh.material as Material;
      this.disposables.push(mesh.geometry, material);
      if (!(material instanceof MeshBasicMaterial)) continue;
      material.toneMapped = false;
      if (material.map) this.textures.push(material.map);
      if (material.name !== "drone_face" || !material.map) continue;
      faceMaterial = material;
      own = material.map;
      // The face is one atlas of nine drawings. The shader picks the cell, squashes the eyes
      // toward their middle for a blink, and slides them to look.
      material.map.wrapS = RepeatWrapping;
      material.map.wrapT = RepeatWrapping;
      material.customProgramCacheKey = () => "home-drone-face";
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
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
    this.faceMaterial = faceMaterial;
    this.pages = { S: own, A: a, B: b };
    for (const t of [a, b]) {
      if (t) {
        this.textures.push(t);
        this.disposables.push(t);
      }
    }

    // A thin ink line round the drone, so the pale wings read on paper: the same skin again,
    // pushed out along its normals and drawn inside out. It follows the bones.
    smoothNormals(this.meshes);
    const outline = this.outline;
    const ink = new MeshBasicMaterial({ color: INK, side: BackSide, toneMapped: false });
    ink.customProgramCacheKey = () => "home-drone-hull";
    ink.onBeforeCompile = (shader) => {
      shader.uniforms.uOutline = outline;
      shader.vertexShader =
        "attribute vec3 aSmooth;\nuniform float uOutline;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "vec3 transformed = position + aSmooth * uOutline;",
        );
    };
    this.disposables.push(ink);
    for (const mesh of this.meshes.slice()) {
      const hull = new SkinnedMesh(mesh.geometry, ink);
      hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.frustumCulled = false;
      mesh.parent?.add(hull);
    }

    // The bones. The glowing strip behind each fin is on a bone of its own that is not the fin's
    // child: it is given to the fin here, so the blade does not leave its strip behind.
    this.wingL = part(model, "wing_L");
    this.wingR = part(model, "wing_R");
    this.finL = part(model, "fin_L");
    this.finR = part(model, "fin_R");
    this.finL.bone.attach(part(model, "antenna_L_01").bone);
    this.finR.bone.attach(part(model, "antenna_R_01").bone);
    this.stripL = part(model, "antenna_L_02");
    this.stripR = part(model, "antenna_R_02");
  }

  /** The stage's size in CSS pixels. */
  resize(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  /** Shaders and pictures go to the card now, not in the first frame of a flight. */
  warm(renderer: WebGLRenderer): void {
    renderer.compile(this.scene, this.camera);
    for (const t of this.textures) renderer.initTexture(t);
  }

  /** A bone's rest pose, then turns about its own axes. */
  private pose2(p: Part, a: Vector3, aa: number, b: Vector3, ba: number): void {
    this.q.copy(p.rest);
    this.q.multiply(this.turn.setFromAxisAngle(a, aa));
    this.q.multiply(this.turn.setFromAxisAngle(b, ba));
    p.bone.quaternion.copy(this.q);
  }

  private pose3(p: Part, a: Vector3, aa: number, b: Vector3, ba: number, c: Vector3, ca: number) {
    this.q.copy(p.rest);
    this.q.multiply(this.turn.setFromAxisAngle(a, aa));
    this.q.multiply(this.turn.setFromAxisAngle(b, ba));
    this.q.multiply(this.turn.setFromAxisAngle(c, ca));
    p.bone.quaternion.copy(this.q);
  }

  /** Put the drone and its rig and face as `d` says, and draw it. */
  draw(renderer: WebGLRenderer, d: DroneDraw): void {
    // Pixels for a metre of the model at this size.
    const perMetre = Math.max(1, d.size) / BODY_METRES;
    this.root.scale.setScalar((perMetre * VIEW_HEIGHT) / this.height);
    this.root.rotation.set(d.pitch, d.yaw, d.roll);
    // The origin is drawn in the middle of the full view: slide the view so that is (x, y).
    this.camera.setViewOffset(this.width, this.height, -d.x, -d.y, this.width, this.height);

    // A wing is spread outward, then raised, then turned flat. The two sides share a frame, so
    // the turns about the bone's own Z and Y take opposite signs.
    const r = d.rig;
    this.pose3(this.wingL, Z, -r.wingSpreadL, X, r.wingRaiseL, Y, -r.wingTwistL);
    this.pose3(this.wingR, Z, r.wingSpreadR, X, r.wingRaiseR, Y, r.wingTwistR);
    this.pose2(this.finL, Z, -r.finSplayL, X, r.finStandL);
    this.pose2(this.finR, Z, r.finSplayR, X, r.finStandR);
    this.pose2(this.stripL, X, r.stripL, X, 0);
    this.pose2(this.stripR, X, r.stripR, X, 0);

    // The drawing: the page it is on (a page that did not load shows the plain face), the cell, the blink.
    const face = FACES[d.face];
    let shown = face;
    let page = face.page;
    if (!this.pages[page]) {
      shown = FACES.normal;
      page = "S";
    }
    if (page !== this.page && this.faceMaterial) {
      const map = this.pages[page];
      if (map) this.faceMaterial.map = map;
      this.page = page;
    }
    this.uniforms.uCell.value.set(shown.u, shown.v);
    this.uniforms.uBlink.value = d.blink;
    this.uniforms.uLook.value.set(d.lookX, d.lookY);
    // The line keeps its width on the screen whatever the drone's size.
    const line = clamp(d.size * 0.0042, 1.1, 2.4);
    this.outline.value = line / perMetre;

    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    for (const t of this.textures) t.dispose();
    this.disposables.length = 0;
    this.textures.length = 0;
    this.scene.clear();
  }
}
