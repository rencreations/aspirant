/**
 * A full-screen draw with one fragment material: the wake's step and the composite use it. The
 * quad is a plain plane in clip space (the vertex shader ignores the camera) and is never culled.
 */
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Texture,
  type WebGLRenderer,
} from "three";

import { COMPOSITE_FRAGMENT, FULLSCREEN_VERTEX } from "./shaders";

const geometry = new PlaneGeometry(2, 2);

export class FullscreenPass {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(readonly material: ShaderMaterial) {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  render(renderer: WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }

  /** Compile the material now (the first frame must not wait for it). */
  compile(renderer: WebGLRenderer): void {
    renderer.compile(this.scene, this.camera);
  }

  dispose(): void {
    this.material.dispose();
  }
}

/** What a draw of the composite is told. */
export interface CompositeParams {
  cards: Texture;
  wake: Texture | null;
  /** The canvas in device pixels and in CSS pixels. */
  deviceW: number;
  deviceH: number;
  cssW: number;
  cssH: number;
  pixel: number;
  edges: number;
  /** The pointer in device pixels from the bottom left. */
  noseX: number;
  noseY: number;
  /** The clip's box (minX, minY, maxX, maxY) in device pixels from the bottom left. */
  clip: Vector4;
  /** The width of the thin part at its left, bottom, right and top, in device pixels. */
  soft: Vector4;
}

/** The composite: the card render to the canvas, through the smear and the wake. Premultiplied. */
export class Composite {
  private readonly pass: FullscreenPass;
  private readonly u = {
    tCards: { value: null as Texture | null },
    tWake: { value: null as Texture | null },
    uSize: { value: new Vector2(1, 1) },
    uFrame: { value: new Vector2(1, 1) },
    uPixel: { value: 1 },
    uEdges: { value: 1 },
    uWake: { value: 0 },
    uNose: { value: new Vector2(0, 0) },
    uClip: { value: new Vector4(-1e6, -1e6, 1e6, 1e6) },
    uSoft: { value: new Vector4(0, 0, 0, 0) },
  };

  constructor() {
    const material = new ShaderMaterial({
      uniforms: this.u,
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    material.toneMapped = false;
    this.pass = new FullscreenPass(material);
  }

  compile(renderer: WebGLRenderer): void {
    this.pass.compile(renderer);
  }

  render(renderer: WebGLRenderer, p: CompositeParams): void {
    const u = this.u;
    u.tCards.value = p.cards;
    u.tWake.value = p.wake;
    u.uWake.value = p.wake ? 1 : 0;
    u.uSize.value.set(p.deviceW, p.deviceH);
    u.uFrame.value.set(p.cssW, p.cssH);
    u.uPixel.value = p.pixel;
    u.uEdges.value = p.edges;
    u.uNose.value.set(p.noseX, p.noseY);
    u.uClip.value.copy(p.clip);
    u.uSoft.value.copy(p.soft);
    this.pass.render(renderer);
  }

  dispose(): void {
    this.pass.dispose();
  }
}
