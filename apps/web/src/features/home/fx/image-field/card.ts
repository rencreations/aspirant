/**
 * One card as a three.js mesh: a unit plane bent and fluttered by its vertex shader, sized by its
 * own uniforms (the quad is the card plus a margin), with its own material. All cards share the
 * geometry and the program; each has its own uniforms and textures. The actor writes the pose, the
 * pictures and the look every frame through `write`.
 */
import {
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Texture,
} from "three";

import type { Q } from "./math";
import { CARD_FRAGMENT, CARD_VERTEX } from "./shaders";

let sharedGeometry: PlaneGeometry | null = null;

/** The one plane of every card: 16 by 16 segments, enough for the bend and the flutter. */
function planeGeometry(): PlaneGeometry {
  sharedGeometry ??= new PlaneGeometry(1, 1, 16, 16);
  return sharedGeometry;
}

/** Everything the shader is told about one card in a frame. */
export interface CardLook {
  x: number;
  y: number;
  z: number;
  q: Q;
  /** Half the card's width and height in local units (frame pixels). */
  halfW: number;
  halfH: number;
  /** Margin around the card the quad covers. */
  pad: number;
  corner: number;
  opacity: number;
  /** 0 portrait picture, 1 wide picture. */
  mix: number;
  hover: number;
  /** Device pixels, y up. */
  streakX: number;
  streakY: number;
  bend: number;
  flutter: number;
  phase: number;
  shadow: number;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  light: number;
}

export class CardView {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly u = {
    tA: { value: null as Texture | null },
    tB: { value: null as Texture | null },
    uAsp: { value: new Vector2(0.8, 16 / 9) },
    uFocus: { value: new Vector4(0.5, 0.5, 0.5, 0.5) },
    uMix: { value: 0 },
    uHalf: { value: new Vector2(100, 125) },
    uPad: { value: 0 },
    uCorner: { value: 8 },
    uOpacity: { value: 1 },
    uStreak: { value: new Vector2(0, 0) },
    uShadow: { value: new Vector4(0.2, 4, -10, 20) },
    uHover: { value: 0 },
    uLight: { value: 0.3 },
    uBend: { value: 0 },
    uFlutter: { value: 0 },
    uPhase: { value: 0 },
  };

  constructor(blank: Texture, name: string) {
    this.u.tA.value = blank;
    this.u.tB.value = blank;
    const material = new ShaderMaterial({
      uniforms: this.u,
      vertexShader: CARD_VERTEX,
      fragmentShader: CARD_FRAGMENT,
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

  /** The portrait picture: its texture, its shape and the point of the subject (fractions, y from the top). */
  setPortrait(texture: Texture, aspect: number, focusX: number, focusY: number): void {
    this.u.tA.value = texture;
    this.u.uAsp.value.x = aspect;
    this.u.uFocus.value.x = focusX;
    this.u.uFocus.value.y = focusY;
  }

  /** The wide picture, the same way. */
  setWide(texture: Texture, aspect: number, focusX: number, focusY: number): void {
    this.u.tB.value = texture;
    this.u.uAsp.value.y = aspect;
    this.u.uFocus.value.z = focusX;
    this.u.uFocus.value.w = focusY;
  }

  write(l: CardLook): void {
    const m = this.mesh;
    m.position.set(l.x, l.y, l.z);
    m.quaternion.set(l.q[0], l.q[1], l.q[2], l.q[3]);
    const u = this.u;
    u.uHalf.value.set(l.halfW, l.halfH);
    u.uPad.value = l.pad;
    u.uCorner.value = l.corner;
    u.uOpacity.value = l.opacity;
    u.uMix.value = l.mix;
    u.uHover.value = l.hover;
    u.uStreak.value.set(l.streakX, l.streakY);
    u.uBend.value = l.bend;
    u.uFlutter.value = l.flutter;
    u.uPhase.value = l.phase;
    u.uShadow.value.set(l.shadow, l.shadowX, l.shadowY, l.shadowBlur);
    u.uLight.value = l.light;
  }

  dispose(): void {
    this.mesh.material.dispose();
  }
}

/** Free the geometry every card shares (the last card of the last field is gone). */
export function disposeCardGeometry(): void {
  sharedGeometry?.dispose();
  sharedGeometry = null;
}
