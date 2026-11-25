import {
  DirectionalLight,
  Euler,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { makeBehaviour, type Behaviour, type ClipView } from "./behaviours";
import {
  angleDelta,
  clampOrbit,
  damp,
  homeOrbit,
  limitsFor,
  orbitFrom,
  orbitPosition,
  type Bounds,
  type Orbit,
  type OrbitLimits,
} from "./camera-math";
import { Rig } from "./rig";
import { disposeTree, shadowTexture, type Insets } from "./scene-kit";
import type { ModelView, ViewMode } from "./types";

export interface StageHooks {
  /** The clip list, the clip on show, playing or paused, the form: anything the panel shows. */
  onClip?: (view: ClipView | null) => void;
  /** Every frame a clip moves: its time and length, for the timeline (written straight to the page). */
  onTick?: (time: number, duration: number) => void;
  /** The camera has left its default place, or come back to it. */
  onMoved?: (moved: boolean) => void;
}

/** What a probe can read of the stage (`window.__models`). */
interface StageProbe {
  state: () => {
    view: string;
    mode: ViewMode;
    orbit: Orbit;
    camera: [number, number, number];
    fov: number;
    clip: ClipView | null;
    probe: Record<string, number>;
  };
}

declare global {
  interface Window {
    __models?: StageProbe;
  }
}

/** The lens of the room (degrees, vertical). Long enough that a body is not stretched. */
const FOV = 30;
const ORBIT_RATE = 9;
const ZOOM_RATE = 8;
const ITEM_RATE = 7;
/** A turn of the whole height of the stage turns the model this far (radians). */
const TURN_GAIN = 3.4;

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

interface Built {
  view: ModelView;
  root: Object3D;
  behaviour: Behaviour;
  bounds: Bounds;
}

/**
 * The stage of the 3D Models room: one canvas, one model at a time. It draws a frame only when
 * something moved (the camera, a clip, a show), and stops drawing while the tab is hidden.
 */
export class ModelStage {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.01, 200);
  private readonly hooks: StageHooks;
  private readonly rig: Rig;
  /** Turns the model of an `item` view (the trackball). */
  private readonly pivot = new Group();
  private readonly shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private built: Built | null = null;
  private mode: ViewMode = "character";
  private bounds: Bounds = { cx: 0, cy: 1, cz: 0, radius: 1, minY: 0, maxY: 2 };
  private limits: OrbitLimits = limitsFor("character", this.bounds);
  private orbit: Orbit = { yaw: 0, pitch: 0, radius: 4, tx: 0, ty: 1, tz: 0 };
  private goal: Orbit = { ...this.orbit };
  private home: Orbit = { ...this.orbit };
  private readonly itemHome = new Quaternion();
  private itemGoal: Quaternion | null = null;
  private width = 1;
  private height = 1;
  private insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private frame = 0;
  private last = 0;
  private dirty = true;
  private moved = false;
  private token = 0;
  private disposed = false;
  private visible = true;
  /** The clip's camera led the last frame; its roll, eased out after the visitor takes it. */
  private wasLed = false;
  private roll = 0;
  private readonly ledQ = new Quaternion();
  private readonly anisotropy: number;
  private readonly resize: ResizeObserver;

  /** Throws when the browser cannot draw WebGL (the page shows the picture instead). */
  constructor(host: HTMLElement, hooks: StageHooks = {}) {
    this.hooks = hooks;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    host.appendChild(this.canvas);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene.add(new HemisphereLight(0xffffff, 0xb4bfd2, 1.55));
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-1.6, 2.2, 3);
    this.camera.add(key);
    this.scene.add(this.camera, this.pivot);

    this.shadow = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = -1;
    this.shadow.visible = false;
    this.scene.add(this.shadow);

    this.rig = new Rig(this.canvas, {
      begin: () => {
        this.itemGoal = null;
        this.built?.behaviour.release?.(this.camera);
        this.setMoved(true);
      },
      turn: (dx, dy) => {
        this.turn(dx, dy);
      },
      zoom: (f) => {
        this.zoomBy(f);
      },
      pan: (dx, dy) => {
        this.pan(dx, dy);
      },
    });

    this.resize = new ResizeObserver(() => {
      this.measure(host);
    });
    this.resize.observe(host);
    this.measure(host);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.loop(performance.now());
    window.__models = {
      state: () => ({
        view: this.built?.view.id ?? "",
        mode: this.mode,
        orbit: { ...this.orbit },
        camera: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
        fov: this.camera.fov,
        clip: this.built?.behaviour.clipView?.() ?? null,
        probe: this.built?.behaviour.probe?.() ?? {},
      }),
    };
  }

  /** The panels cover these edges of the canvas: the model is framed in what is left. */
  setInsets(insets: Insets): void {
    const same =
      insets.left === this.insets.left &&
      insets.right === this.insets.right &&
      insets.top === this.insets.top &&
      insets.bottom === this.insets.bottom;
    if (same) return;
    this.insets = insets;
    this.applyLens();
    if (!this.moved) this.goHome(true);
    this.dirty = true;
  }

  /** Build a view from its file and show it. Resolves when its first frame can be drawn. */
  async show(view: ModelView, bytes: ArrayBuffer): Promise<void> {
    const token = ++this.token;
    const gltf: GLTF = await loader.parseAsync(bytes.slice(0), "");
    if (this.disposed || token !== this.token) {
      disposeTree(gltf.scene);
      return;
    }
    const behaviour = await makeBehaviour(view, gltf, {
      anisotropy: this.anisotropy,
      renderer: this.renderer,
    });
    if (this.disposed || token !== this.token) {
      behaviour.dispose();
      disposeTree(gltf.scene);
      return;
    }
    this.clear();
    const root = behaviour.root;
    this.pivot.quaternion.identity();
    this.pivot.position.set(0, 0, 0);
    this.pivot.add(root);
    const bounds = behaviour.bounds();
    this.built = { view, root, behaviour, bounds };
    this.mode = view.mode;
    // A character stands on the origin (the files put her feet there): she turns about her own axis,
    // not the middle of a box that her weapon (Ruby's scythe) pulls aside.
    this.bounds = view.mode === "character" ? { ...bounds, cx: 0, cz: 0 } : bounds;
    this.limits = limitsFor(view.mode, this.bounds);
    if (view.mode === "item") {
      // The item turns about its own middle.
      root.position.set(-bounds.cx, -bounds.cy, -bounds.cz);
      this.bounds = {
        ...bounds,
        cx: 0,
        cy: 0,
        cz: 0,
        minY: bounds.minY - bounds.cy,
        maxY: bounds.maxY - bounds.cy,
      };
      this.limits = limitsFor("item", this.bounds);
      // A slight turn, so the first look is not flat on (a view may say its own: the crescent moon faces the viewer).
      const [yaw, tilt] = view.home ?? [-0.45, 0.18];
      this.itemHome.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
      this.itemHome.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), tilt));
      this.pivot.quaternion.copy(this.itemHome);
    }
    this.shadow.visible = view.mode === "character";
    if (this.shadow.visible) {
      const foot = Math.max(0.2, (this.bounds.maxY - this.bounds.minY) * 0.42);
      this.shadow.scale.set(foot, foot, 1);
      this.shadow.position.set(this.bounds.cx, this.bounds.minY + 0.002, this.bounds.cz);
    }
    this.goHome(true);
    this.setMoved(false);
    this.emitClip();
    behaviour.warm?.(this.renderer, this.scene, this.camera);
    this.dirty = true;
  }

  /** The clip state changed inside a behaviour: tell the page. */
  private emitClip(): void {
    this.hooks.onClip?.(this.built?.behaviour.clipView?.() ?? null);
  }

  /** Remove the model on show. */
  clear(): void {
    const b = this.built;
    if (!b) return;
    this.built = null;
    b.behaviour.dispose();
    b.root.removeFromParent();
    disposeTree(b.root);
    this.rig.halt();
    this.hooks.onClip?.(null);
    this.dirty = true;
  }

  /** Pick a clip (or a group's member). */
  pickClip(id: string): void {
    this.built?.behaviour.pick?.(id);
    this.emitClip();
    this.dirty = true;
  }

  /** Change the form (Selena In Game). */
  setForm(form: string): void {
    this.built?.behaviour.setForm?.(form);
    this.emitClip();
    this.dirty = true;
  }

  setPlaying(playing: boolean): void {
    this.built?.behaviour.setPlaying?.(playing);
    this.emitClip();
    this.dirty = true;
  }

  togglePlay(): void {
    const v = this.built?.behaviour.clipView?.();
    this.setPlaying(!(v?.playing ?? true));
  }

  seek(time: number): void {
    this.built?.behaviour.seek?.(time);
    this.emitClip();
    this.dirty = true;
  }

  step(direction: 1 | -1): void {
    this.built?.behaviour.step?.(direction);
    this.emitClip();
    this.dirty = true;
  }

  /** Back to the view's default camera (and the clip's camera on a cinematic view). */
  resetCamera(): void {
    this.rig.halt();
    this.roll = 0;
    if (this.mode === "item") this.itemGoal = this.itemHome.clone();
    this.goal = { ...this.home };
    this.built?.behaviour.follow?.();
    this.setMoved(false);
    this.dirty = true;
  }

  /** Keyboard turns, in steps. */
  nudge(dx: number, dy: number): void {
    this.itemGoal = null;
    this.built?.behaviour.release?.(this.camera);
    this.setMoved(true);
    this.turn(dx, dy);
  }

  zoomBy(factor: number): void {
    this.built?.behaviour.release?.(this.camera);
    this.setMoved(true);
    this.goal.radius *= factor;
    this.goal = clampOrbit(this.goal, this.limits, this.bounds);
    this.dirty = true;
  }

  private turn(dx: number, dy: number): void {
    if (this.mode === "item") {
      // A trackball: the item turns about the screen's own axes, so every side can be reached.
      const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx * TURN_GAIN);
      const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy * TURN_GAIN);
      this.pivot.quaternion.premultiply(qy).premultiply(qx).normalize();
      this.dirty = true;
      return;
    }
    this.goal.yaw -= dx * TURN_GAIN;
    this.goal.pitch += dy * TURN_GAIN * 0.8;
    this.goal = clampOrbit(this.goal, this.limits, this.bounds);
    this.dirty = true;
  }

  private pan(dx: number, dy: number): void {
    // A distance on the screen is a distance at the target, so the model follows the finger.
    const scale = this.goal.radius * 2 * Math.tan((this.camera.fov * Math.PI) / 360);
    if (this.limits.pan) {
      const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      this.goal.tx += (-right.x * dx + up.x * dy) * scale;
      this.goal.ty += (-right.y * dx + up.y * dy) * scale;
      this.goal.tz += (-right.z * dx + up.z * dy) * scale;
    } else if (this.mode === "character") {
      // Up and down her body only, never under her hips.
      this.goal.ty += dy * scale;
    } else {
      return;
    }
    this.goal = clampOrbit(this.goal, this.limits, this.bounds);
    this.dirty = true;
  }

  private setMoved(moved: boolean): void {
    if (this.moved === moved) return;
    this.moved = moved;
    this.hooks.onMoved?.(moved);
  }

  private goHome(snap: boolean): void {
    const free = this.freeArea();
    this.home = homeOrbit(this.mode, this.bounds, FOV, free.aspect, 0.8 * free.share);
    // A view may open from its own angle (Silverbolt from its side, as it idles in the game).
    const own = this.built?.view.home;
    if (own && this.mode !== "item") {
      this.home = clampOrbit(
        { ...this.home, yaw: own[0], pitch: own[1] },
        this.limits,
        this.bounds,
      );
    }
    this.goal = { ...this.home };
    if (snap) {
      this.orbit = { ...this.home };
      this.place();
    }
  }

  /** The part of the canvas the panels leave: its shape, and its share of the height. */
  private freeArea(): { aspect: number; share: number } {
    const w = Math.max(1, this.width - this.insets.left - this.insets.right);
    const h = Math.max(1, this.height - this.insets.top - this.insets.bottom);
    return { aspect: w / h, share: h / Math.max(1, this.height) };
  }

  /** Centre the lens on the free part of the canvas. */
  private applyLens(): void {
    const w = this.width;
    const h = this.height;
    const cx = this.insets.left + (w - this.insets.left - this.insets.right) / 2;
    const cy = this.insets.top + (h - this.insets.top - this.insets.bottom) / 2;
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    this.camera.updateProjectionMatrix();
  }

  private measure(host: HTMLElement): void {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.applyLens();
    if (!this.moved) this.goHome(true);
    this.dirty = true;
  }

  private place(): void {
    const [x, y, z] = orbitPosition(this.orbit);
    this.camera.position.set(x, y, z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.orbit.tx, this.orbit.ty, this.orbit.tz);
  }

  /** Ease the camera toward its goal. True while it is still moving. */
  private stepCamera(dt: number): boolean {
    const o = this.orbit;
    const g = this.goal;
    const before = o.yaw + o.pitch + o.radius + o.tx + o.ty + o.tz;
    o.yaw = g.yaw - angleDelta(o.yaw, g.yaw) * Math.exp(-ORBIT_RATE * dt);
    o.pitch = damp(o.pitch, g.pitch, ORBIT_RATE, dt);
    o.radius = Math.exp(damp(Math.log(o.radius), Math.log(g.radius), ZOOM_RATE, dt));
    o.tx = damp(o.tx, g.tx, ORBIT_RATE, dt);
    o.ty = damp(o.ty, g.ty, ORBIT_RATE, dt);
    o.tz = damp(o.tz, g.tz, ORBIT_RATE, dt);
    this.place();
    const after = o.yaw + o.pitch + o.radius + o.tx + o.ty + o.tz;
    let moving = Math.abs(after - before) > 1e-6;
    if (this.itemGoal) {
      this.pivot.quaternion.slerp(this.itemGoal, 1 - Math.exp(-ITEM_RATE * dt));
      if (this.pivot.quaternion.angleTo(this.itemGoal) < 1e-4) {
        this.pivot.quaternion.copy(this.itemGoal);
        this.itemGoal = null;
      }
      moving = true;
    }
    return moving;
  }

  private readonly loop = (now: number): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (!this.visible) {
      this.last = now;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - (this.last || now)) / 1000));
    this.last = now;
    let moving = this.rig.update(dt);
    const b = this.built;
    let animating = false;
    if (b) {
      animating = b.behaviour.update(dt, this.camera);
      const tick = b.behaviour.tick?.();
      if (tick) this.hooks.onTick?.(tick.time, tick.duration);
      if (b.behaviour.changed?.()) this.emitClip();
    }
    // A cinematic view's camera follows its clip until the visitor takes it.
    const led =
      b?.behaviour.lead?.(this.camera, this.freeArea(), this.insets, this.width, this.height) ??
      false;
    if (led) {
      const t = b?.behaviour.target?.() ?? [this.bounds.cx, this.bounds.cy, this.bounds.cz];
      const p = this.camera.position;
      this.orbit = clampOrbit(orbitFrom([p.x, p.y, p.z], t), this.limits, this.bounds);
      this.goal = { ...this.orbit };
      this.ledQ.copy(this.camera.quaternion);
      this.wasLed = true;
      moving = true;
    } else {
      if (this.camera.fov !== FOV && !b?.behaviour.keepsLens?.()) {
        this.camera.fov = FOV;
        this.applyLens();
      }
      moving = this.stepCamera(dt) || moving;
      if (this.wasLed) {
        // The game's camera is rolled: the roll eases out instead of snapping level.
        this.wasLed = false;
        const q = this.camera.quaternion.clone().invert().multiply(this.ledQ);
        this.roll = new Euler().setFromQuaternion(q, "ZXY").z;
      }
      if (Math.abs(this.roll) > 1e-4) {
        this.camera.rotateZ(this.roll);
        this.roll = damp(this.roll, 0, 3.5, dt);
        moving = true;
      }
    }
    if (moving || animating || this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
    }
  };

  private readonly onVisibility = (): void => {
    this.visible = document.visibilityState !== "hidden";
  };

  private readonly onLost = (e: Event): void => {
    // The page shows the picture: nothing can be drawn until a reload.
    e.preventDefault();
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    delete window.__models;
    this.clear();
    this.rig.dispose();
    this.resize.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.shadow.geometry.dispose();
    this.shadow.material.map?.dispose();
    this.shadow.material.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
