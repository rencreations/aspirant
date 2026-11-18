/**
 * The quad of the logo: 192 by 56 segments over the art and its margin, in logo units from the
 * art's centre with y up, and the material that warps it (`shader.ts`). `LogoMesh` owns the two
 * textures and writes the uniforms from a `Warp`.
 */
import {
  CanvasTexture,
  CustomBlending,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from "three";

import { ART_CENTRE, REG, SEG_X, SEG_Y, WAVE, type NavRaster, type Warp } from "./math";
import { FRAGMENT, VERTEX } from "./shader";

function heroTexture(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = anisotropy;
  tex.premultiplyAlpha = true;
  tex.flipY = true;
  return tex;
}

function navTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.premultiplyAlpha = true;
  tex.flipY = true;
  return tex;
}

interface Uniform<T> {
  value: T;
}

/** The uniforms of the logo material, typed so a write cannot name one that is not there. */
interface LogoUniforms {
  [name: string]: Uniform<unknown>;
  uTex: Uniform<CanvasTexture>;
  uTexNav: Uniform<CanvasTexture>;
  uTexel: Uniform<Vector2>;
  uUvNav: Uniform<Vector2>;
  uCA: Uniform<number>;
  uFrom: Uniform<Vector3>;
  uTo: Uniform<Vector3>;
  uP: Uniform<number>;
  uRoll: Uniform<number>;
  uTilt: Uniform<number>;
  uYaw: Uniform<number>;
  uEnv: Uniform<number>;
  uPhase: Uniform<number>;
  uAmp: Uniform<number>;
  uCycles: Uniform<number>;
  uSag: Uniform<Vector4>;
  uSagY: Uniform<number>;
  uSnap: Uniform<Vector2>;
  uRip: Uniform<Vector4>;
  uReveal: Uniform<number>;
  uOpacity: Uniform<number>;
}

export class LogoMesh {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;
  private readonly u: LogoUniforms;
  private readonly geometry: PlaneGeometry;
  private hero: CanvasTexture;
  private nav: CanvasTexture;

  constructor(heroCanvas: HTMLCanvasElement, navCanvas: HTMLCanvasElement, anisotropy: number) {
    this.geometry = new PlaneGeometry(REG.w, REG.h, SEG_X, SEG_Y);
    // The plane is centred on the region; the shader wants logo units from the art's centre, y up.
    const pos = this.geometry.getAttribute("position");
    const dx = REG.x + REG.w / 2 - ART_CENTRE.x;
    const dy = -(REG.y + REG.h / 2 - ART_CENTRE.y);
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, 0);
    }
    pos.needsUpdate = true;

    this.hero = heroTexture(heroCanvas, anisotropy);
    this.nav = navTexture(navCanvas);
    this.u = {
      uTex: { value: this.hero },
      uTexNav: { value: this.nav },
      uTexel: { value: new Vector2(1 / heroCanvas.width, 1 / heroCanvas.height) },
      uUvNav: { value: new Vector2(1, 1) },
      uCA: { value: WAVE.split },
      uFrom: { value: new Vector3() },
      uTo: { value: new Vector3() },
      uP: { value: 0 },
      uRoll: { value: 0 },
      uTilt: { value: 0 },
      uYaw: { value: 0 },
      uEnv: { value: 0 },
      uPhase: { value: 0 },
      uAmp: { value: WAVE.amp },
      uCycles: { value: WAVE.cycles },
      uSag: { value: new Vector4() },
      uSagY: { value: 0 },
      uSnap: { value: new Vector2() },
      uRip: { value: new Vector4() },
      uReveal: { value: 1 },
      uOpacity: { value: 1 },
    };
    this.material = new ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      premultipliedAlpha: true,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      uniforms: this.u,
    });
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.name = "logo-quad";
  }

  /** A new hero texture (the screen or the pixel ratio changed). The old one is freed. */
  setHero(canvas: HTMLCanvasElement, anisotropy: number): void {
    const old = this.hero;
    this.hero = heroTexture(canvas, anisotropy);
    this.u.uTex.value = this.hero;
    this.u.uTexel.value.set(1 / canvas.width, 1 / canvas.height);
    old.dispose();
  }

  /** A new nav texture (the bar moved or the pixel ratio changed). The old one is freed. */
  setNav(canvas: HTMLCanvasElement, plan: NavRaster): void {
    const old = this.nav;
    this.nav = navTexture(canvas);
    this.u.uTexNav.value = this.nav;
    this.u.uUvNav.value.set(plan.uvX, plan.uvY);
    old.dispose();
  }

  /** Write a warp into the uniforms. */
  apply(w: Warp): void {
    const u = this.u;
    u.uFrom.value.set(w.fromX, w.fromY, w.fromK);
    u.uTo.value.set(w.toX, w.toY, w.toK);
    u.uSag.value.set(w.sag.depth, w.sag.xL, w.sag.xR, w.sag.wobble);
    u.uRip.value.set(w.ripX, w.ripY, w.rip, w.ripT);
    u.uSnap.value.set(w.snapX, w.snapY);
    u.uP.value = w.P;
    u.uRoll.value = w.roll;
    u.uTilt.value = w.tilt;
    u.uYaw.value = w.yaw;
    u.uEnv.value = w.env;
    u.uPhase.value = w.phase;
    u.uAmp.value = w.amp;
    u.uCycles.value = w.cycles;
    u.uSagY.value = w.sag.y;
    u.uReveal.value = w.reveal;
    u.uOpacity.value = w.opacity;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.hero.dispose();
    this.nav.dispose();
  }
}
