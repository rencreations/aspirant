"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  Color,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  type Texture,
  type WebGLRenderer,
} from "three";

import { asset } from "@/lib/asset";

import type { PortalPair } from "../types";
import type { PortalController, PortalFrame } from "./portalController";
import { portalFragment, portalVertex } from "./portalShader";

interface PairTextures {
  base: Texture;
  alt: Texture;
  depth: Texture;
  depthAlt: Texture;
}

interface PortalSceneProps {
  controller: PortalController;
  pairs: readonly PortalPair[];
  /** Called once, after the first frame that drew the figure. */
  onReady: () => void;
}

const loader = new TextureLoader();

function loadTexture(url: string, premultiply: boolean): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      asset(url),
      (texture) => {
        texture.flipY = false;
        texture.premultiplyAlpha = premultiply;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

function makeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: portalVertex,
    fragmentShader: portalFragment,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRes: { value: new Vector2(1, 1) },
      uFig: { value: new Vector4(0, 0, 1, 1.25) },
      uCam: { value: new Vector2() },
      uPortal: { value: new Vector3() },
      uWipe: { value: new Vector3() },
      uForm: { value: 0 },
      uFormE: { value: 0 },
      uShift: { value: new Vector2() },
      uEnergy: { value: 0 },
      uTime: { value: 0 },
      uDissolve: { value: 0 },
      uIntro: { value: 0 },
      uBase: { value: null },
      uAlt: { value: null },
      uDepth: { value: null },
      uDepthAlt: { value: null },
      uAltOpaque: { value: 0 },
      uBaseOpaque: { value: 0 },
      uGlowA: { value: new Color() },
      uGlowA2: { value: new Color() },
      uGlowB: { value: new Color() },
      uGlowB2: { value: new Color() },
      uTintA: { value: new Color() },
      uTintB: { value: new Color() },
    },
  });
}

/** Owns the material and the textures, outside React state. */
class PortalDriver {
  readonly material = makeMaterial();
  private readonly store = new Map<number, PairTextures>();
  private readonly loading = new Map<number, Promise<void>>();
  private drawn = -1;
  /** Bumped on every dispose, so loads that finish after it are dropped (Strict Mode safe). */
  private generation = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly pairs: readonly PortalPair[],
  ) {}

  has(index: number): boolean {
    return this.store.has(index);
  }

  ensure(index: number): Promise<void> {
    const existing = this.loading.get(index);
    if (existing) return existing;
    const pair = this.pairs[index];
    if (!pair) return Promise.resolve();
    const generation = this.generation;
    const job = Promise.all([
      loadTexture(pair.base.image, true),
      loadTexture(pair.alt.image, true),
      loadTexture(pair.base.depth, false),
      loadTexture(pair.alt.depth, false),
    ])
      .then(([base, alt, depth, depthAlt]) => {
        const all = [base, alt, depth, depthAlt];
        if (generation !== this.generation) {
          for (const t of all) t.dispose();
          return;
        }
        for (const t of all) this.renderer.initTexture(t);
        this.store.set(index, { base, alt, depth, depthAlt });
      })
      .catch(() => {
        this.loading.delete(index);
      });
    this.loading.set(index, job);
    return job;
  }

  /** Load the drawn pair first, then the rest in order. */
  async preload(first: number): Promise<void> {
    const generation = this.generation;
    await this.ensure(first);
    for (let i = 0; i < this.pairs.length; i++) {
      if (generation !== this.generation) return;
      if (i !== first) await this.ensure(i);
    }
  }

  /** Write the frame into the uniforms. Returns false while the pair is still loading. */
  apply(f: PortalFrame, width: number, height: number): boolean {
    const set = this.store.get(f.pair);
    if (!set) return false;
    const u = this.material.uniforms;
    if (this.drawn !== f.pair) {
      this.drawn = f.pair;
      const pair = this.pairs[f.pair];
      if (pair) {
        u.uBase!.value = set.base;
        u.uAlt!.value = set.alt;
        u.uDepth!.value = set.depth;
        u.uDepthAlt!.value = set.depthAlt;
        (u.uShift!.value as Vector2).set(pair.align[0], pair.align[1]);
        u.uBaseOpaque!.value = pair.base.opaque ? 1 : 0;
        u.uAltOpaque!.value = pair.alt.opaque ? 1 : 0;
        (u.uGlowA!.value as Color).set(pair.base.glow);
        (u.uGlowA2!.value as Color).set(pair.base.glow2);
        (u.uGlowB!.value as Color).set(pair.alt.glow);
        (u.uGlowB2!.value as Color).set(pair.alt.glow2);
        (u.uTintA!.value as Color).set(pair.base.tint);
        (u.uTintB!.value as Color).set(pair.alt.tint);
      }
    }
    (u.uRes!.value as Vector2).set(width, height);
    (u.uFig!.value as Vector4).set(f.figX, f.figY, f.figW, f.figH);
    (u.uCam!.value as Vector2).set(f.camX, f.camY);
    (u.uPortal!.value as Vector3).set(f.cx, f.cy, f.r);
    (u.uWipe!.value as Vector3).set(f.fx, f.fy, f.fr);
    u.uForm!.value = f.form;
    u.uFormE!.value = f.formE;
    u.uEnergy!.value = f.energy;
    u.uTime!.value = f.time;
    u.uDissolve!.value = f.dissolve;
    u.uIntro!.value = f.intro;
    return true;
  }

  dispose(): void {
    this.generation++;
    this.drawn = -1;
    for (const set of this.store.values())
      for (const t of [set.base, set.alt, set.depth, set.depthAlt]) t.dispose();
    this.store.clear();
    this.loading.clear();
    this.material.dispose();
  }
}

/**
 * The WebGL portal: one full-screen quad with the portal shader. Reads the controller's frame
 * every frame (no React state), loads the drawn pair first and the others after it, and
 * uploads textures ahead of the swap so a pair change never stalls.
 */
export default function PortalScene({ controller, pairs, onReady }: PortalSceneProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const [driver] = useState(() => new PortalDriver(gl, pairs));
  const readyFired = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    controller.setPairReadyCheck((index) => {
      if (driver.has(index)) return true;
      void driver.ensure(index);
      return false;
    });
    void driver.preload(controller.f.pair);
    return () => {
      controller.setPairReadyCheck(null);
      driver.dispose();
    };
  }, [controller, driver]);

  useFrame(() => {
    if (!driver.apply(controller.f, size.width, size.height)) return;
    if (!readyFired.current) {
      readyFired.current = true;
      requestAnimationFrame(() => onReadyRef.current());
    }
  });

  return (
    <mesh frustumCulled={false} material={driver.material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
