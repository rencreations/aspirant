/**
 * One picture of the cast shown in several windows of the screen (the owner, 26 Nov 2026: Selena's
 * small picture in the character list is the same 3D picture as her frame, and she is drawn once).
 *
 * The framed roots are drawn once, before every other pass, into the bottom left corner of the
 * canvas at the size of the picture. That corner is copied into a texture and cleared again, then the
 * cast pass lays the copy in each window. The copy is the canvas's own pixels (the same shaders, the
 * same colour, the same smoothing of the edges), so a window of the picture's own size shows exactly
 * what a direct draw would, and a smaller window shows the same picture made small (a box filter).
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  FramebufferTexture,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector4,
  type WebGLRenderer,
} from "three";

/** CSS pixels, origin at the top left of the screen. */
interface MirrorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A window of the screen: the whole picture lands on `to`, and the screen shows the part `clip`. */
export interface MirrorShow {
  to: MirrorRect;
  clip: MirrorRect;
}

/** The picture (CSS pixels) and the windows it is shown in. */
export interface Mirror {
  w: number;
  h: number;
  shows: readonly MirrorShow[];
}

const VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// `uTo` is where the whole picture lands (device pixels from the bottom left: left, bottom, width,
// height). A window of the picture's own size reads one texel a pixel; a smaller one averages a box
// of nine taps over the texels that fall in the pixel, so the ink of a small picture does not shimmer.
const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uTo;
uniform vec2 uSize;
void main() {
  vec2 st = (gl_FragCoord.xy - uTo.xy) / uTo.zw;
  vec2 foot = uSize / uTo.zw;
  if (foot.x < 1.01 && foot.y < 1.01) {
    gl_FragColor = texture2D(uMap, st);
    return;
  }
  vec2 tap = foot / uSize / 3.0;
  vec4 sum = vec4(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      sum += texture2D(uMap, st + vec2(float(i), float(j)) * tap);
    }
  }
  gl_FragColor = sum / 9.0;
}
`;

export class MirrorCopy {
  private texture: FramebufferTexture | null = null;
  private dw = 0;
  private dh = 0;
  private readonly origin = new Vector2(0, 0);
  private readonly geometry = new BufferGeometry();
  private readonly material: ShaderMaterial;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera();

  constructor() {
    // One triangle over the whole screen: the scissor keeps it to a window.
    this.geometry.setAttribute(
      "position",
      new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.material = new ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uTo: { value: new Vector4(0, 0, 1, 1) },
        uSize: { value: new Vector2(1, 1) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      // The canvas holds premultiplied colour, and so does the copy of it.
      transparent: true,
      premultipliedAlpha: true,
    });
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /**
   * Copy the bottom left corner of the canvas, `dw` by `dh` device pixels, into the texture, then
   * clear it (the scissor must hold that corner).
   */
  take(renderer: WebGLRenderer, dw: number, dh: number): void {
    if (!this.texture || dw !== this.dw || dh !== this.dh) {
      this.texture?.dispose();
      const t = new FramebufferTexture(dw, dh);
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      this.texture = t;
      this.dw = dw;
      this.dh = dh;
      this.material.uniforms.uMap!.value = t;
      (this.material.uniforms.uSize!.value as Vector2).set(dw, dh);
    }
    renderer.copyFramebufferToTexture(this.texture, this.origin);
    renderer.clear(true, true, false);
  }

  /** Lay the last copy in each window of `m`. `cssH` is the canvas's height in CSS pixels. */
  show(renderer: WebGLRenderer, m: Mirror, cssH: number, dpr: number): void {
    if (!this.texture) return;
    const to = this.material.uniforms.uTo!.value as Vector4;
    const deviceH = renderer.domElement.height;
    renderer.setScissorTest(true);
    for (const s of m.shows) {
      const c = s.clip;
      if (c.w < 0.5 || c.h < 0.5) continue;
      // A window of the picture's own size is laid texel on pixel, so it is the direct draw exactly.
      const same = Math.abs(s.to.w - m.w) < 0.5 && Math.abs(s.to.h - m.h) < 0.5;
      const tw = same ? this.dw : s.to.w * dpr;
      const th = same ? this.dh : s.to.h * dpr;
      const left = same ? Math.round(s.to.x * dpr) : s.to.x * dpr;
      const top = same ? Math.round(s.to.y * dpr) : s.to.y * dpr;
      to.set(left, deviceH - top - th, tw, th);
      this.material.uniformsNeedUpdate = true;
      renderer.setScissor(c.x, cssH - c.y - c.h, c.w, c.h);
      renderer.render(this.scene, this.camera);
    }
    renderer.setScissorTest(false);
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = null;
    this.geometry.dispose();
    this.material.dispose();
  }
}
