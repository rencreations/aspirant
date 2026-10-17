"use client";

import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { Component, Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  UnsignedByteType,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Vector4,
} from "three";

import { usePointer } from "@/lib/hooks";
import { clamp, damp, lerp, smoothstep } from "@/lib/math";

import { driver } from "../driver";
import type { SceneKey } from "../parts";
import { scrimState } from "../scrim";
import { createClock, partProgress } from "../world/context";
import { presetFor } from "../world/presets";
import type { Preset } from "../world/types";
import { World } from "../world/World";
import { createComposite, MAX_ZONES } from "./composite";

export interface SceneCanvasProps {
  /** Render frames (false pauses the loop: no story position yet, tab hidden). */
  running: boolean;
  /** 1 for desktop class GPUs, lower for phones and mid devices. */
  quality: number;
  /** Called when WebGL fails or the context is lost; the layer falls back to still art. */
  onFail: () => void;
}

/** Seconds for a scene dissolve. */
const DISSOLVE = 1.6;

class CanvasBoundary extends Component<{ onFail: () => void; children: ReactNode }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onFail();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function cameraOf(p: Preset) {
  const c = p.camera ?? {};
  return { y: c.y ?? 0, lookY: c.lookY ?? 0, z: c.z ?? 10, fov: c.fov ?? 45 };
}

function makeTarget(halfFloat: boolean, samples: number) {
  return new WebGLRenderTarget(4, 4, {
    type: halfFloat ? HalfFloatType : UnsignedByteType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    samples,
  });
}

function Director({ quality }: { quality: number }) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { ref: pointer } = usePointer({ tilt: true });
  const [slots, setSlots] = useState<[SceneKey | null, SceneKey | null]>(() => [
    driver.scene,
    null,
  ]);
  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  const flow = useRef<{ front: 0 | 1; mix: number; transitioning: boolean; requested: boolean }>({
    front: 0,
    mix: 0,
    transitioning: false,
    requested: false,
  });
  const scenes = useMemo(() => [new Scene(), new Scene()] as const, []);
  const clocks = useMemo(() => [createClock(quality), createClock(quality)] as const, [quality]);
  const composite = useMemo(createComposite, []);
  const quad = useMemo(() => {
    const geometry = new PlaneGeometry(2, 2);
    const mesh = new Mesh(geometry, composite);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    return { scene, geometry };
  }, [composite]);
  const ortho = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const targets = useMemo(() => {
    const ext = gl.extensions;
    const halfFloat = ext.has("EXT_color_buffer_float") || ext.has("EXT_color_buffer_half_float");
    const samples = quality >= 1 ? 4 : 0;
    return [makeTarget(halfFloat, samples), makeTarget(halfFloat, samples)] as const;
  }, [gl, quality]);

  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const scale = quality >= 1 ? 0.8 : 0.62;
    const w = Math.max(64, Math.floor(size.width * dpr * scale));
    const h = Math.max(64, Math.floor(size.height * dpr * scale));
    for (const t of targets) t.setSize(w, h);
  }, [gl, size, quality, targets]);

  useEffect(
    () => () => {
      for (const t of targets) t.dispose();
    },
    [targets],
  );
  useEffect(
    () => () => {
      composite.dispose();
      quad.geometry.dispose();
    },
    [composite, quad],
  );

  // Dev only: let the harness read renderer.info for leak checks.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (window as unknown as { __scenesGL?: unknown }).__scenesGL = gl;
    return () => {
      delete (window as unknown as { __scenesGL?: unknown }).__scenesGL;
    };
  }, [gl]);

  const cam = useRef({ y: 0, lookY: 0, z: 10, fov: 45, roll: 0 });

  // Before the layers: transitions, clocks and the camera rig.
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    driver.beat = Math.max(0, driver.beat - dt * 1.3);
    driver.sceneSince += dt;
    const f = flow.current;
    const keys = slotsRef.current;
    const back = (1 - f.front) as 0 | 1;
    const frontKey = keys[f.front];

    if (!f.transitioning && frontKey !== driver.scene) {
      f.transitioning = true;
      f.requested = true;
      f.mix = 0;
      const next: [SceneKey | null, SceneKey | null] = [keys[0], keys[1]];
      next[back] = driver.scene;
      clocks[f.front].live = false;
      Object.assign(clocks[back], {
        age: 0,
        live: true,
        chapter: driver.chapterProgress,
        part: partProgress(driver.chapterId, driver.chapterProgress),
        story: driver.storyProgress,
      });
      setSlots(next);
    }
    if (f.transitioning) {
      const ready = keys[back] !== null && scenes[back].children.length > 0;
      if (ready) {
        // Hurry when the reader has already moved on again.
        const hurry = keys[back] !== driver.scene ? 2.2 : 1;
        f.mix = Math.min(1, f.mix + (dt / DISSOLVE) * hurry);
      }
      if (f.mix >= 1) {
        const next: [SceneKey | null, SceneKey | null] = [keys[0], keys[1]];
        next[f.front] = null;
        f.front = back;
        f.mix = 0;
        f.transitioning = false;
        setSlots(next);
      }
    }

    const p = pointer.current;
    const partP = partProgress(driver.chapterId, driver.chapterProgress);
    for (let i = 0; i < 2; i++) {
      const c = clocks[i];
      if (!c) continue;
      c.time += dt;
      c.age += dt;
      c.beat = driver.beat;
      c.px = p.x;
      c.py = p.y;
      c.pixelH = targets[0].height;
      if (c.live) {
        c.chapter = damp(c.chapter, clamp(driver.chapterProgress), 2.5, dt);
        c.part = damp(c.part, partP, 2.5, dt);
        c.story = damp(c.story, clamp(driver.storyProgress), 2.5, dt);
      }
    }

    // Camera: blend the two presets' cameras through the dissolve, then follow the pointer.
    const a = cameraOf(presetFor(keys[f.front] ?? driver.scene));
    const bKey = keys[back];
    const b = f.transitioning && bKey ? cameraOf(presetFor(bKey)) : a;
    const k = smoothstep(0, 1, f.mix);
    const t = cam.current;
    t.y = damp(t.y, lerp(a.y, b.y, k), 3, dt);
    t.lookY = damp(t.lookY, lerp(a.lookY, b.lookY, k), 3, dt);
    t.z = damp(t.z, lerp(a.z, b.z, k), 3, dt);
    t.fov = damp(t.fov, lerp(a.fov, b.fov, k), 3, dt);
    t.roll = damp(t.roll, -p.x * 0.025, 3, dt);
    camera.position.set(p.x * 0.45, t.y - p.y * 0.25, t.z);
    camera.lookAt(p.x * 0.08, t.lookY - p.y * 0.05, 0);
    camera.rotateZ(t.roll);
    if (Math.abs(camera.fov - t.fov) > 0.01) {
      camera.fov = t.fov;
      camera.updateProjectionMatrix();
    }
  }, -1);

  // After the layers: render the slots and composite them to the screen.
  useFrame(() => {
    const f = flow.current;
    const back = (1 - f.front) as 0 | 1;
    const front = targets[f.front];
    const behind = targets[back];
    gl.setRenderTarget(front);
    gl.render(scenes[f.front], camera);
    const mixing = f.transitioning && f.mix > 0;
    if (mixing) {
      gl.setRenderTarget(behind);
      gl.render(scenes[back], camera);
    }
    const u = composite.uniforms;
    const k = smoothstep(0, 1, f.mix);
    u.tA!.value = front.texture;
    u.tB!.value = behind.texture;
    u.uMix!.value = mixing ? k : 0;
    u.uPushA!.value = mixing ? k * k * 0.07 : 0;
    u.uPushB!.value = mixing ? (1 - k) * 0.035 : 0;
    u.uTime!.value = clocks[f.front].time;
    u.uAspect!.value = size.width / Math.max(1, size.height);
    const vh = scrimState.vh || size.height;
    const zones = u.uZones!.value as Vector4[];
    for (let i = 0; i < MAX_ZONES; i++) {
      const z = scrimState.zones[i];
      const v = zones[i];
      if (!v) continue;
      if (z) v.set(1 - z.y1 / vh, 1 - z.y0 / vh, z.theme === "storm" ? 1 : 2, 0);
      else v.set(0, 0, 0, 0);
    }
    u.uBandHalf!.value = scrimState.bandHalf / Math.max(1, scrimState.vw || size.width);
    gl.setRenderTarget(null);
    gl.render(quad.scene, ortho);
  }, 1);

  return (
    <>
      {slots.map((key, i) => {
        const clock = clocks[i];
        const scene = scenes[i];
        if (!key || !clock || !scene) return null;
        return (
          <Fragment key={`${i}-${key}`}>
            {createPortal(<World preset={presetFor(key)} clock={clock} />, scene)}
          </Fragment>
        );
      })}
    </>
  );
}

/** The live WebGL backdrop. Load lazily (`next/dynamic`, `ssr: false`). */
export default function SceneCanvas({ running, quality, onFail }: SceneCanvasProps) {
  return (
    <CanvasBoundary onFail={onFail}>
      <Canvas
        dpr={[1, 1.75]}
        frameloop={running ? "always" : "never"}
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 45, position: [0, 0, 10], near: 0.1, far: 800 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onFail();
          });
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Director quality={quality} />
      </Canvas>
    </CanvasBoundary>
  );
}
