"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  Color,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  type Texture,
} from "three";

import { asset } from "@/lib/asset";

import type { PortalPair } from "../types";
import type { PortalController } from "./portalController";
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

/**
 * The WebGL portal: one full-screen quad with the portal shader. Reads the controller's frame
 * every frame (no React state), loads the drawn pair first and the others after it, and
 * uploads textures ahead of the swap so a pair change never stalls.
 */
export default function PortalScene({ controller, pairs, onReady }: PortalSceneProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const textures = useRef(new Map<number, PairTextures>());
  const pending = useRef(new Map<number, Promise<void>>());
  const drawn = useRef(-1);
  const readyFired = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
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
      }),
    [],
  );

  useEffect(() => {
    const store = textures.current;
    const loading = pending.current;
    let alive = true;

    const ensure = (index: number): Promise<void> => {
      const existing = loading.get(index);
      if (existing) return existing;
      const pair = pairs[index];
      if (!pair) return Promise.resolve();
      const job = Promise.all([
        loadTexture(pair.base.image, true),
        loadTexture(pair.alt.image, true),
        loadTexture(pair.base.depth, false),
        loadTexture(pair.alt.depth, false),
      ])
        .then(([base, alt, depth, depthAlt]) => {
          if (!alive) {
            for (const t of [base, alt, depth, depthAlt]) t.dispose();
            return;
          }
          for (const t of [base, alt, depth, depthAlt]) gl.initTexture(t);
          store.set(index, { base, alt, depth, depthAlt });
        })
        .catch(() => {
          loading.delete(index);
        });
      loading.set(index, job);
      return job;
    };

    controller.isPairReady = (index) => {
      if (store.has(index)) return true;
      void ensure(index);
      return false;
    };

    // The drawn pair first, then the rest in order.
    const first = controller.f.pair;
    void ensure(first).then(async () => {
      for (let i = 0; i < pairs.length; i++) if (i !== first && alive) await ensure(i);
    });

    return () => {
      alive = false;
      controller.isPairReady = () => true;
      controller.cssMask = true;
      for (const set of store.values())
        for (const t of [set.base, set.alt, set.depth, set.depthAlt]) t.dispose();
      store.clear();
      loading.clear();
      material.dispose();
    };
  }, [controller, pairs, gl, material]);

  useFrame(() => {
    const f = controller.f;
    const set = textures.current.get(f.pair);
    if (!set) return;
    const u = material.uniforms;
    if (drawn.current !== f.pair) {
      drawn.current = f.pair;
      const pair = pairs[f.pair];
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
    (u.uRes!.value as Vector2).set(size.width, size.height);
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

    if (!readyFired.current) {
      readyFired.current = true;
      controller.cssMask = false;
      requestAnimationFrame(() => onReadyRef.current());
    }
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
