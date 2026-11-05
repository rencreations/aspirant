import {
  Box3,
  BufferGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  Spherical,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import type { ModelBundle } from "./model-bundle";
import type { ModelInfo, ModelPart } from "./types";

/** What the stage reports back to the page. */
interface ViewerHooks {
  /** The camera's angle round the model in radians (0 is the front) and the zoom (1 is the home view). */
  onView?: (azimuth: number, zoom: number) => void;
}

/** The three switches of the stage. The robot's face screen follows the robot. */
export type Layer = "body" | "weapon" | "robot";

const LAYER_OF: Record<ModelPart, Layer> = {
  body: "body",
  weapon: "weapon",
  robot: "robot",
  robotFace: "robot",
};

const FOV = 30;
const HOME_AZIMUTH = 0.5;
const HOME_POLAR = 1.42;
const INK = new Color("#2a3342");
const ACCENT = new Color("#e0245e");
const PLATE = new Color("#5d6b82");

async function textureFromBlob(blob: Blob, anisotropy: number): Promise<Texture> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const texture = new Texture(img);
    // The UVs of this model sit in different whole tiles (v from -7 to -1), so the picture repeats.
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
    return texture;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function disposeObject(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<Mesh>;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const m of mats) {
      (m as MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}

interface Tween {
  start: number;
  ms: number;
  from: Spherical;
  to: Spherical;
  fromTarget: Vector3;
  toTarget: Vector3;
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** The turntable: one WebGL canvas, one model at a time. Plain three, loaded as its own chunk. */
export class ModelViewer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.05, 80);
  private readonly controls: OrbitControls;
  private readonly hooks: ViewerHooks;
  private model: Group | null = null;
  private stage: Group | null = null;
  private meshes: Array<Mesh<BufferGeometry, Material | Material[]>> = [];
  private faceMaterial: MeshLambertMaterial | null = null;
  private readonly faceTextures = new Map<number, Texture>();
  private readonly layers: Record<Layer, boolean> = { body: true, weapon: true, robot: true };
  private bodyBox = new Box3();
  private allBox = new Box3();
  private frameAll = false;
  private homeTarget = new Vector3(0, 0.9, 0);
  private homeSpherical = new Spherical(5, HOME_POLAR, HOME_AZIMUTH);
  private tween: Tween | null = null;
  private running = false;
  private userAutoRotate = true;
  private moved = false;
  private lastInteract = 0;
  private lastTick = 0;
  private lastReport = 0;
  private lastAz = -1;
  private width = 1;
  private height = 1;
  private disposed = false;
  private loadToken = 0;

  constructor(canvas: HTMLCanvasElement, hooks: ViewerHooks = {}) {
    this.hooks = hooks;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

    this.scene.add(new HemisphereLight(0xffffff, 0xb4bfd2, 1.55));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-1.6, 2.2, 3);
    this.camera.add(key);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 0.7;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 2;
    this.controls.minPolarAngle = 0.55;
    this.controls.maxPolarAngle = 1.78;
    // The wheel zooms only once the visitor has pressed on the stage (`setWheelZoom`), so the
    // page still scrolls when the pointer passes over it. A swipe up or down on a phone scrolls
    // the page too (`pan-y`); a swipe sideways turns the model.
    this.controls.enableZoom = false;
    canvas.style.touchAction = "pan-y";
    this.controls.addEventListener("start", () => {
      this.moved = true;
      this.tween = null;
      this.lastInteract = performance.now();
    });
    this.controls.addEventListener("end", () => {
      this.lastInteract = performance.now();
    });
  }

  /** Build the model from its bytes, frame it, and draw one frame. */
  async show(bundle: ModelBundle, info: ModelInfo): Promise<void> {
    const token = ++this.loadToken;
    this.clearModel();
    const group = new OBJLoader().parse(bundle.obj);
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const textures = new Map<string, Texture>();
    await Promise.all(
      Array.from(bundle.maps).map(async ([material, blob]) => {
        textures.set(material, await textureFromBlob(blob, aniso));
      }),
    );
    if (this.disposed || token !== this.loadToken) {
      textures.forEach((t) => {
        t.dispose();
      });
      disposeObject(group);
      return;
    }

    const made = new Map<string, MeshLambertMaterial>();
    group.traverse((obj) => {
      if (!(obj instanceof Mesh)) return;
      const mesh = obj as Mesh<BufferGeometry, Material | Material[]>;
      const old: Material | undefined = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material;
      const name = old?.name ?? "";
      let mat = made.get(name);
      if (!mat) {
        const map = textures.get(name);
        mat = new MeshLambertMaterial({
          side: DoubleSide,
          ...(map ? { map } : { color: 0xcccccc }),
        });
        mat.name = name;
        made.set(name, mat);
      }
      const olds: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      olds.forEach((m) => {
        m.dispose();
      });
      mesh.material = mat;
      const part: ModelPart = info.parts[name] ?? "body";
      (mesh.userData as Record<string, unknown>).part = part;
      if (part === "robotFace") {
        this.faceMaterial = mat;
        if (mat.map) this.faceTextures.set(-1, mat.map);
      }
      this.meshes.push(mesh);
    });

    this.model = group;
    this.scene.add(group);
    this.measure();
    this.buildStage();
    this.applyLayers();
    this.goHome(false);
    this.renderOnce();
  }

  /** Show or hide one layer of the model. */
  setLayer(layer: Layer, on: boolean): void {
    this.layers[layer] = on;
    this.applyLayers();
    this.renderOnce();
  }

  /** Put another expression sheet on the robot's face (-1 is the sheet the model came with). */
  async setFace(index: number, blob: Blob | null): Promise<void> {
    const mat = this.faceMaterial;
    if (!mat) return;
    let tex = this.faceTextures.get(index);
    if (!tex && blob) {
      tex = await textureFromBlob(blob, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
      if (this.disposed) {
        tex.dispose();
        return;
      }
      this.faceTextures.set(index, tex);
    }
    if (!tex) return;
    mat.map = tex;
    mat.needsUpdate = true;
    this.renderOnce();
  }

  /** Fit the view to the body (the default) or to every part laid out as the client file stores them. */
  setFrameAll(all: boolean): void {
    this.frameAll = all;
    this.measure();
    this.goHome(true);
  }

  resetView(): void {
    this.userAutoRotate = true;
    this.controls.autoRotate = true;
    this.goHome(true);
  }

  setAutoRotate(on: boolean): void {
    this.userAutoRotate = on;
    this.controls.autoRotate = on;
  }

  /** The wheel zooms while this is on. */
  setWheelZoom(on: boolean): void {
    this.controls.enableZoom = on;
  }

  zoomBy(factor: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const len = Math.min(
      this.controls.maxDistance,
      Math.max(this.controls.minDistance, offset.length() * factor),
    );
    this.camera.position.copy(this.controls.target).add(offset.setLength(len));
    this.moved = true;
    this.controls.update();
    this.renderOnce();
  }

  /** Turn the camera round the model by whole steps (the arrow keys). */
  orbitBy(dAzimuth: number, dPolar: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new Spherical().setFromVector3(offset);
    s.theta += dAzimuth;
    s.phi = Math.min(
      this.controls.maxPolarAngle,
      Math.max(this.controls.minPolarAngle, s.phi + dPolar),
    );
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(s));
    this.moved = true;
    this.lastInteract = performance.now();
    this.controls.update();
    this.renderOnce();
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.model) {
      this.measure();
      if (!this.moved) this.goHome(false);
    }
    this.renderOnce();
  }

  /** Start or stop the frame loop (it stops while the stage is off screen or the tab is hidden). */
  setRunning(on: boolean): void {
    if (on === this.running || this.disposed) return;
    this.running = on;
    if (on) {
      this.lastTick = performance.now();
      this.renderer.setAnimationLoop(this.tick);
    } else {
      this.renderer.setAnimationLoop(null);
    }
  }

  renderOnce(): void {
    if (this.disposed) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.report(true);
  }

  /** Free the GPU memory: geometry, materials, textures, the context. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.clearModel();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // -------------------------------------------------------------------------------------------

  private readonly tick = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;
    if (this.tween) {
      const t = Math.min(1, (now - this.tween.start) / this.tween.ms);
      this.applyTween(this.tween, ease(t));
      if (t >= 1) this.tween = null;
    }
    // After a drag the turn waits a moment before it carries on by itself.
    this.controls.autoRotate = this.userAutoRotate && !this.tween && now - this.lastInteract > 1600;
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.report(false, now);
  };

  private report(force: boolean, now = performance.now()): void {
    if (!this.hooks.onView) return;
    if (!force && now - this.lastReport < 90) return;
    const az = this.controls.getAzimuthalAngle();
    const deg = Math.round((az * 180) / Math.PI);
    const zoom = this.homeSpherical.radius / Math.max(0.001, this.controls.getDistance());
    if (!force && deg === this.lastAz && Math.abs(zoom - 1) < 0.001) return;
    this.lastReport = now;
    this.lastAz = deg;
    this.hooks.onView(az, zoom);
  }

  private clearModel(): void {
    if (this.model) {
      this.scene.remove(this.model);
      disposeObject(this.model);
      this.model = null;
    }
    if (this.stage) {
      this.scene.remove(this.stage);
      disposeObject(this.stage);
      this.stage = null;
    }
    this.faceTextures.forEach((t) => {
      t.dispose();
    });
    this.faceTextures.clear();
    this.faceMaterial = null;
    this.meshes = [];
  }

  private applyLayers(): void {
    for (const mesh of this.meshes) {
      const part = (mesh.userData.part as ModelPart | undefined) ?? "body";
      mesh.visible = this.layers[LAYER_OF[part]];
    }
  }

  /** The boxes of the body and of everything, whatever is switched on or off. */
  private measure(): void {
    this.bodyBox = new Box3();
    this.allBox = new Box3();
    for (const mesh of this.meshes) {
      const part = (mesh.userData.part as ModelPart | undefined) ?? "body";
      this.allBox.expandByObject(mesh);
      if (part === "body") this.bodyBox.expandByObject(mesh);
    }
    if (this.bodyBox.isEmpty()) this.bodyBox.copy(this.allBox);
    const box = this.frameAll ? this.allBox : this.bodyBox;
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const tanV = Math.tan((FOV * Math.PI) / 360);
    const aspect = this.camera.aspect;
    const distH = size.y / 2 / tanV;
    const distW = Math.max(size.x, this.frameAll ? 0 : size.z) / 2 / (tanV * aspect);
    const radius = Math.max(distH, distW) * 1.04 + (Math.min(size.z, size.x) / 2) * 0.8;
    this.homeTarget.copy(center);
    this.homeSpherical.set(radius, HOME_POLAR, HOME_AZIMUTH);
    this.controls.minDistance = radius * 0.3;
    this.controls.maxDistance = radius * 1.9;
    this.camera.near = Math.max(0.02, radius / 200);
    this.camera.far = radius * 12;
    this.camera.updateProjectionMatrix();
  }

  private goHome(animate: boolean): void {
    if (!animate) {
      this.tween = null;
      this.controls.target.copy(this.homeTarget);
      this.camera.position
        .copy(this.homeTarget)
        .add(new Vector3().setFromSpherical(this.homeSpherical));
      this.moved = false;
      this.controls.update();
      this.renderOnce();
      return;
    }
    const offset = this.camera.position.clone().sub(this.controls.target);
    const from = new Spherical().setFromVector3(offset);
    const to = this.homeSpherical.clone();
    // Take the short way round.
    while (to.theta - from.theta > Math.PI) to.theta -= Math.PI * 2;
    while (to.theta - from.theta < -Math.PI) to.theta += Math.PI * 2;
    this.tween = {
      start: performance.now(),
      ms: 650,
      from,
      to,
      fromTarget: this.controls.target.clone(),
      toTarget: this.homeTarget.clone(),
    };
    this.moved = false;
    if (!this.running) {
      this.applyTween(this.tween, 1);
      this.tween = null;
      this.renderOnce();
    }
  }

  private applyTween(tw: Tween, t: number): void {
    const s = new Spherical(
      tw.from.radius + (tw.to.radius - tw.from.radius) * t,
      tw.from.phi + (tw.to.phi - tw.from.phi) * t,
      tw.from.theta + (tw.to.theta - tw.from.theta) * t,
    );
    this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, t);
    this.camera.position.copy(this.controls.target).add(new Vector3().setFromSpherical(s));
  }

  /** The plinth: a flat disc, a ring with degree ticks round it, and a mark at the front (0 degrees). */
  private buildStage(): void {
    const box = this.bodyBox;
    const c = box.getCenter(new Vector3());
    const half = box.getSize(new Vector3());
    const radius = Math.max(0.85, Math.hypot(half.x / 2, half.z / 2) * 1.18);
    const y = box.min.y;
    const g = new Group();
    g.position.set(c.x, y, c.z);

    const disc = new Mesh(
      new CircleGeometry(radius, 96),
      new MeshBasicMaterial({
        color: PLATE,
        transparent: true,
        opacity: 0.16,
        side: DoubleSide,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);

    const ringPts: number[] = [];
    for (let i = 0; i < 128; i += 1) {
      const a = (i / 128) * Math.PI * 2;
      ringPts.push(Math.sin(a) * radius, 0, Math.cos(a) * radius);
    }
    const ringGeo = new BufferGeometry();
    ringGeo.setAttribute("position", new Float32BufferAttribute(ringPts, 3));
    g.add(
      new LineLoop(
        ringGeo,
        new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 }),
      ),
    );

    const inner: number[] = [];
    for (let i = 0; i < 96; i += 1) {
      const a = (i / 96) * Math.PI * 2;
      inner.push(Math.sin(a) * radius * 0.5, 0, Math.cos(a) * radius * 0.5);
    }
    const innerGeo = new BufferGeometry();
    innerGeo.setAttribute("position", new Float32BufferAttribute(inner, 3));
    g.add(
      new LineLoop(
        innerGeo,
        new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.18 }),
      ),
    );

    // A tick every 5 degrees, longer every 15 and again every 45.
    const ticks: number[] = [];
    for (let deg = 0; deg < 360; deg += 5) {
      if (deg === 0) continue;
      const len = deg % 45 === 0 ? 0.1 : deg % 15 === 0 ? 0.06 : 0.03;
      const a = (deg * Math.PI) / 180;
      const s = Math.sin(a);
      const co = Math.cos(a);
      ticks.push(s * radius, 0, co * radius, s * (radius + len), 0, co * (radius + len));
    }
    const tickGeo = new BufferGeometry();
    tickGeo.setAttribute("position", new Float32BufferAttribute(ticks, 3));
    g.add(
      new LineSegments(
        tickGeo,
        new LineBasicMaterial({ color: INK, transparent: true, opacity: 0.6 }),
      ),
    );

    // The front: a long tick and an arrow head in the accent colour.
    const front = [
      0,
      0,
      radius,
      0,
      0,
      radius + 0.17,
      0,
      0,
      radius + 0.17,
      0.05,
      0,
      radius + 0.1,
      0,
      0,
      radius + 0.17,
      -0.05,
      0,
      radius + 0.1,
    ];
    const frontGeo = new BufferGeometry();
    frontGeo.setAttribute("position", new Float32BufferAttribute(front, 3));
    g.add(new LineSegments(frontGeo, new LineBasicMaterial({ color: ACCENT })));

    this.stage = g;
    this.scene.add(g);
  }
}
