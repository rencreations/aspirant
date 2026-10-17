"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
} from "three";

import { mulberry32 } from "@/lib/math";

import { col, driven, useClock } from "../context";
import type { CityParams } from "../types";

const WIN_VERT = /* glsl */ `
attribute vec3 seed;
uniform float uTime, uLit, uPixel, uSize;
varying float vA;
varying float vHue;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = step(seed.x, uLit);
  float flicker = 0.75 + 0.25 * sin(uTime * (0.6 + seed.y * 2.0) + seed.z * 60.0);
  vA = on * flicker * smoothstep(90.0, 20.0, -mv.z);
  vHue = seed.y;
  gl_PointSize = max(1.0, uSize * uPixel * projectionMatrix[1][1] / max(0.5, -mv.z));
}
`;
const WIN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor, uColor2;
varying float vA;
varying float vHue;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.25, max(q.x, q.y * 0.8));
  float alpha = a * vA;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(mix(uColor, uColor2, vHue * 0.6), alpha);
}
`;

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

function layout(p: CityParams, quality: number): Tower[] {
  const rand = mulberry32(4242);
  const depth = p.depth ?? 52;
  const count = Math.round(260 * Math.max(0.5, quality));
  const towers: Tower[] = [];
  for (let i = 0; i < count; i++) {
    const row = rand();
    const z = -depth + 14 - row * 40;
    const spread = 40 + row * 40;
    const x = (rand() * 2 - 1) * spread;
    const tall = rand() < 0.12 ? 2.6 : 1;
    const centre = Math.exp(-((x / 22) ** 2)) * 0.8 + 0.4;
    const h = (0.8 + rand() * 3.2) * tall * centre * (p.height ?? 1) * (1 + row * 0.6);
    towers.push({ x, z, w: 0.45 + rand() * 0.9, d: 0.5 + rand() * 0.9, h });
  }
  return towers;
}

/** The lake city: tower silhouettes, lit windows, an optional tower, and the gantry rail. */
export function City({ params }: { params: CityParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const p = params;
    const ground = p.ground ?? -2.2;
    const towers = layout(p, clock.quality);
    const group = new Group();
    const disposables: { dispose(): void }[] = [];
    const rand = mulberry32(99);
    const ruin = p.ruin ?? 0;

    if (!p.points) {
      const box = new BoxGeometry(1, 1, 1);
      box.translate(0, 0.5, 0);
      const mat = new MeshBasicMaterial({ color: col(p.color), fog: true });
      const mesh = new InstancedMesh(box, mat, towers.length);
      const m = new Matrix4();
      towers.forEach((t, i) => {
        const broken = ruin > 0 && rand() < ruin * 0.7 ? 0.45 + rand() * 0.4 : 1;
        m.makeScale(t.w, t.h * broken, t.d);
        m.setPosition(t.x, ground, t.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.frustumCulled = false;
      group.add(mesh);
      disposables.push(box, mat);
    }

    // Windows (or, in points mode, every edge of every tower as tiny lights).
    const winPos: number[] = [];
    const winSeed: number[] = [];
    for (const t of towers) {
      const cols = Math.max(1, Math.floor(t.w * 2.2));
      const rows = Math.max(1, Math.floor(t.h * 2.4));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!p.points && rand() < 0.35) continue;
          const x = t.x - t.w / 2 + ((c + 0.5) / cols) * t.w;
          const y = ground + ((r + 0.5) / rows) * t.h * 0.96;
          winPos.push(x, y, t.z + t.d / 2 + 0.01);
          winSeed.push(rand(), rand(), rand());
          if (p.points && rand() < 0.5) {
            winPos.push(x, y, t.z - t.d / 2);
            winSeed.push(rand(), rand(), rand());
          }
        }
      }
    }
    const wg = new BufferGeometry();
    wg.setAttribute("position", new BufferAttribute(new Float32Array(winPos), 3));
    wg.setAttribute("seed", new BufferAttribute(new Float32Array(winSeed), 3));
    const wm = new ShaderMaterial({
      vertexShader: WIN_VERT,
      fragmentShader: WIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uLit: { value: 0.5 },
        uPixel: { value: 360 },
        uSize: { value: p.points ? 0.07 : 0.11 },
        uColor: { value: col(p.windows ?? "#ffcf8a") },
        uColor2: { value: col(p.fire ?? p.windows ?? "#ffcf8a") },
      },
    });
    const windows = new Points(wg, wm);
    windows.frustumCulled = false;
    group.add(windows);
    disposables.push(wg, wm);

    // One tower at the centre: the Academy tower, the Base, the bell tower.
    let lamp: Mesh | null = null;
    if (p.tower) {
      const tg = new BoxGeometry(1, 1, 1);
      tg.translate(0, 0.5, 0);
      const tm = new MeshBasicMaterial({ color: col(p.color), fog: true });
      const tower = new Mesh(tg, tm);
      tower.scale.set(0.9, p.tower.height, 0.9);
      tower.position.set(p.tower.x, ground, -14);
      group.add(tower);
      disposables.push(tg, tm);
      if (p.tower.lamp) {
        const lg = new BoxGeometry(0.22, 0.28, 0.02);
        const lm = new MeshBasicMaterial({ color: col(p.tower.lamp), fog: false });
        lamp = new Mesh(lg, lm);
        const at = p.tower.window ?? 0.4;
        lamp.position.set(p.tower.x + 0.18, ground + p.tower.height * at, -14 + 0.47);
        group.add(lamp);
        disposables.push(lg, lm);
      }
    }

    // The gantry: a steel rail across the bottom of the frame, seventy metres up.
    if (p.gantry) {
      const rg = new BoxGeometry(1, 1, 1);
      const rm = new MeshBasicMaterial({ color: col(p.color), fog: false });
      const rails = new InstancedMesh(rg, rm, 40);
      const m = new Matrix4();
      let i = 0;
      for (const y of [-1.05, -1.32]) {
        m.makeScale(30, 0.035, 0.035);
        m.setPosition(0, y, 6.6);
        rails.setMatrixAt(i++, m);
      }
      for (let k = -18; k <= 18 && i < 40; k++) {
        m.makeScale(0.05, 1.2, 0.05);
        m.setPosition(k * 0.8, -1.7, 6.6);
        rails.setMatrixAt(i++, m);
      }
      rails.count = i;
      rails.frustumCulled = false;
      group.add(rails);
      disposables.push(rg, rm);
    }
    return { group, windows: wm, lamp, disposables };
  }, [params, clock.quality]);

  useEffect(
    () => () => {
      for (const d of built.disposables) d.dispose();
    },
    [built],
  );

  useFrame(() => {
    const u = built.windows.uniforms;
    u.uTime!.value = clock.time;
    u.uPixel!.value = clock.pixelH * 0.5;
    u.uLit!.value = driven(params.lit ?? 0.5, clock, 0.5);
    if (built.lamp) {
      const glow = 0.85 + 0.15 * Math.sin(clock.time * 1.7) + clock.beat * 0.6;
      built.lamp.scale.setScalar(glow);
    }
  });

  return <primitive object={built.group} />;
}
