/**
 * One plane as a three.js mesh: a unit plane bent and fluttered by its vertex shader and sized by its
 * own uniforms, with its own material. All planes share the geometry and the program. The actor
 * writes the pose, the window of the picture and the look every frame through `write`.
 */
import {
  Color,
  DoubleSide,
  Mesh,
  NoColorSpace,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Texture,
} from "three";

import { FILM_FRAGMENT, FILM_VERTEX } from "./shader";
import type { PlanePose } from "./types";

let sharedGeometry: PlaneGeometry | null = null;

function planeGeometry(): PlaneGeometry {
  sharedGeometry ??= new PlaneGeometry(1, 1, 16, 8);
  return sharedGeometry;
}

/** Everything the shader is told about one plane in a frame, besides its pose. */
export interface PlaneLook {
  /** The window of the picture: centre x, centre y, width, height (fractions, y from the top). */
  win: [number, number, number, number];
  /** 0 to 1: the picture is in. */
  ready: number;
  /** The overlay of the strip, 0 to 1. */
  effect: number;
  /** The live light overlay (scanlines, grain, sweep, vignette, fringe), 0 to 1. */
  overlay: number;
  /** 0 to 1: the pointer is on this plane. */
  hover: number;
  /** The pointer on the plane, fractions of its size from its centre, y up. */
  pointerX: number;
  pointerY: number;
  /** The weights of the lens, the colour split, (unused) and the sweep, already scaled by the hover. */
  lens: number;
  split: number;
  sweep: number;
  time: number;
  phase: number;
  light: number;
  /** The trailer's thin loading line: how visible it is (0 to 1) and how much is in hand (0 to 1). */
  load: number;
  loadFraction: number;
}

/** Margin around the plane the quad covers, so the soft edge is not cut by the mesh. */
const PAD = 2;

export class PlaneView {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly u = {
    tVideo: { value: null as Texture | null },
    uWin: { value: new Vector4(0.5, 0.5, 1, 1) },
    uHalf: { value: new Vector2(100, 56) },
    uPad: { value: PAD },
    uCorner: { value: 4 },
    uOpacity: { value: 1 },
    uColor: { value: new Color(0x2a2a3a) },
    uReady: { value: 0 },
    uTime: { value: 0 },
    uEffect: { value: 0 },
    uOverlay: { value: 0 },
    uHover: { value: 0 },
    uPointer: { value: new Vector2(0, 0) },
    uFx: { value: new Vector4(0, 0, 0, 0) },
    uLight: { value: 0.28 },
    uBend: { value: 0 },
    uFlutter: { value: 0 },
    uPhase: { value: 0 },
    uLoad: { value: new Vector2(0, 0) },
  };

  constructor(texture: Texture, color: string, name: string) {
    this.u.tVideo.value = texture;
    // The clip's colour, as raw bytes (the shader writes bytes, so it must not be decoded).
    this.u.uColor.value.setStyle(color, NoColorSpace);
    const material = new ShaderMaterial({
      uniforms: this.u,
      vertexShader: FILM_VERTEX,
      fragmentShader: FILM_FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
    });
    material.toneMapped = false;
    this.mesh = new Mesh(planeGeometry(), material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  write(p: PlanePose, l: PlaneLook): void {
    const m = this.mesh;
    m.position.set(p.x, p.y, p.z);
    m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
    m.renderOrder = p.order;
    const u = this.u;
    u.uHalf.value.set(p.w / 2, p.h / 2);
    u.uCorner.value = Math.min(p.corner, p.h / 2, p.w / 2);
    u.uOpacity.value = p.opacity;
    u.uBend.value = p.bend;
    u.uFlutter.value = p.flutter;
    u.uPhase.value = l.phase;
    u.uWin.value.set(l.win[0], l.win[1], l.win[2], l.win[3]);
    u.uReady.value = l.ready;
    u.uEffect.value = l.effect;
    u.uOverlay.value = l.overlay;
    u.uHover.value = l.hover;
    u.uPointer.value.set(l.pointerX, l.pointerY);
    u.uFx.value.set(l.lens, l.split, 0, l.sweep);
    u.uTime.value = l.time;
    u.uLight.value = l.light;
    u.uLoad.value.set(l.load, l.loadFraction);
  }

  dispose(): void {
    this.mesh.material.dispose();
  }
}

/** Free the geometry every plane shares (the last plane of the last film is gone). */
export function disposePlaneGeometry(): void {
  sharedGeometry?.dispose();
  sharedGeometry = null;
}
