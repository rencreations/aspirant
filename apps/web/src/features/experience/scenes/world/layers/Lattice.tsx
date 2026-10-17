"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  LineSegments,
  ShaderMaterial,
} from "three";

import { mulberry32 } from "@/lib/math";

import { col, driven, useClock, useLatest } from "../context";
import type { LatticeParams } from "../types";

const VERT = /* glsl */ `
attribute float along;
attribute float seed;
attribute float reveal;
uniform float uTime, uGrow;
varying float vA;
varying float vPulse;
varying float vFlaw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float shown = smoothstep(reveal - 0.04, reveal, uGrow);
  float depth = smoothstep(140.0, 8.0, -mv.z);
  float p = fract(along * 0.6 - uTime * (0.08 + seed * 0.12) + seed * 7.0);
  vPulse = smoothstep(0.06, 0.0, abs(p - 0.5));
  vFlaw = step(1.5, seed);
  vA = shown * depth * (0.55 + 0.45 * fract(seed * 13.7));
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor, uColor2;
uniform float uOpacity, uBeat;
varying float vA;
varying float vPulse;
varying float vFlaw;
void main() {
  vec3 c = mix(uColor, uColor2, vPulse) * (0.45 + vPulse * 1.6);
  c = mix(c, uColor2 * 1.8, vFlaw);
  gl_FragColor = vec4(c * vA * uOpacity * (1.0 + uBeat * 0.6), 1.0);
}
`;

type Seg = [number, number, number, number, number, number];

function buildSegments(p: LatticeParams, quality: number) {
  const rand = mulberry32(p.mode.length * 7919 + 13);
  const segs: Seg[] = [];
  const along: number[] = [];
  const seeds: number[] = [];
  const reveal: number[] = [];
  const s = p.scale ?? 1;
  const [cx, cy, cz] = p.center ?? [0, 0, -30];
  const add = (a: number[], b: number[], t0: number, t1: number, seed: number, rv: number) => {
    segs.push([a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!]);
    along.push(t0, t1);
    seeds.push(seed, seed);
    reveal.push(rv, rv);
  };
  const polyline = (pts: number[][], seed: number, rv: (i: number) => number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      add(pts[i]!, pts[i + 1]!, i / pts.length, (i + 1) / pts.length, seed, rv(i));
    }
  };

  if (p.mode === "matrix") {
    const n = Math.round(320 * Math.max(0.5, quality));
    const nodes: number[][] = [];
    for (let i = 0; i < n; i++) {
      nodes.push([
        cx + (rand() * 2 - 1) * 46 * s,
        cy + (rand() * 2 - 1) * 14 * s,
        cz + (rand() * 2 - 1) * 26 * s,
      ]);
    }
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({
          j,
          d: (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2,
        }))
        .filter((x) => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 3);
      for (const { j } of near) {
        if (j < i) continue;
        const rv = Math.hypot(a[0]! - cx, a[1]! - cy) / (48 * s);
        add(a, nodes[j]!, 0, 1, rand(), rv);
      }
    });
  } else if (p.mode === "net") {
    // A curved sheet that unrolls from the top of the sky.
    const cols = 42;
    const rows = 22;
    const point = (u: number, v: number) => {
      const x = cx + (u * 2 - 1) * 60 * s;
      const y = cy + 16 * s - v * 22 * s;
      const z = cz - 10 + (u * 2 - 1) ** 2 * -14 + Math.sin(u * 9 + v * 3) * 0.8;
      return [x, y, z];
    };
    for (let r = 0; r <= rows; r++) {
      const pts: number[][] = [];
      for (let c = 0; c <= cols; c++) pts.push(point(c / cols, r / rows));
      polyline(pts, rand(), () => r / rows);
    }
    for (let c = 0; c <= cols; c += 1) {
      const pts: number[][] = [];
      for (let r = 0; r <= rows; r++) pts.push(point(c / cols, r / rows));
      const flaw = p.flaw && c === Math.round(cols * 0.62);
      for (let i = 0; i < pts.length - 1; i++) {
        add(pts[i]!, pts[i + 1]!, i / rows, (i + 1) / rows, flaw ? 2 : rand(), i / rows);
      }
    }
  } else if (p.mode === "web") {
    // A web of silver light with a world at every knot; one heavy knot drags the rest.
    const rings = 7;
    const spokes = 28;
    const heavy = [0.34, -0.12];
    const point = (r: number, a: number) => {
      let x = Math.cos(a) * r;
      let y = Math.sin(a) * r * 0.62;
      const dx = x / 14 - heavy[0]!;
      const dy = y / 14 - heavy[1]!;
      const sag = Math.exp(-(dx * dx + dy * dy) * 9) * 2.2;
      y -= sag;
      x *= s;
      return [cx + x, cy + y * s, cz + Math.sin(a * 3 + r) * 0.6];
    };
    for (let k = 1; k <= rings; k++) {
      const r = (k / rings) * 15;
      const pts: number[][] = [];
      for (let i = 0; i <= 96; i++) pts.push(point(r, (i / 96) * Math.PI * 2));
      polyline(pts, rand(), () => k / rings);
    }
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rand() * 0.05;
      const pts: number[][] = [];
      for (let k = 0; k <= 16; k++) pts.push(point((k / 16) * 15, a));
      polyline(pts, rand(), (j) => j / 16);
    }
  } else if (p.mode === "threads") {
    // Threads of light between two points: Gantry Square.
    const a = [cx - 9 * s, cy - 1.5 * s, cz];
    const b = [cx + 8 * s, cy + 3.5 * s, cz - 6];
    const n = Math.round(46 * Math.max(0.5, quality));
    for (let k = 0; k < n; k++) {
      const off = [(rand() - 0.5) * 6 * s, (rand() - 0.2) * 7 * s, (rand() - 0.5) * 6];
      const pts: number[][] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const m = 4 * t * (1 - t);
        pts.push([
          a[0]! + (b[0]! - a[0]!) * t + off[0]! * m,
          a[1]! + (b[1]! - a[1]!) * t + off[1]! * m,
          a[2]! + (b[2]! - a[2]!) * t + off[2]! * m,
        ]);
      }
      polyline(pts, rand(), (i) => i / 40);
    }
  } else {
    // ring: the Core's ring of pale threads.
    const n = 9;
    for (let k = 0; k < n; k++) {
      const tilt = (k / n) * Math.PI;
      const radius = (2.2 + rand() * 0.8) * s;
      const pts: number[][] = [];
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const y = Math.sin(a) * radius * Math.cos(tilt);
        const z = Math.sin(a) * radius * Math.sin(tilt);
        pts.push([cx + x, cy + y, cz + z]);
      }
      polyline(pts, rand(), () => k / n);
    }
  }

  const pos = new Float32Array(segs.length * 6);
  segs.forEach((sg, i) => pos.set(sg, i * 6));
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("along", new BufferAttribute(new Float32Array(along), 1));
  geometry.setAttribute("seed", new BufferAttribute(new Float32Array(seeds), 1));
  geometry.setAttribute("reveal", new BufferAttribute(new Float32Array(reveal), 1));
  return geometry;
}

/** Webs of light: the Matrix, the net, the knotted web of worlds, threads, the Core's ring. */
export function Lattice({ params }: { params: LatticeParams }) {
  const clock = useClock();
  const lines = useMemo(() => {
    const geometry = buildSegments(params, clock.quality);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 1 },
        uColor: { value: col(params.color) },
        uColor2: { value: col(params.color2 ?? params.color) },
        uOpacity: { value: params.opacity ?? 1 },
        uBeat: { value: 0 },
      },
    });
    const seg = new LineSegments(geometry, material);
    seg.frustumCulled = false;
    return seg;
  }, [params, clock.quality]);

  useEffect(
    () => () => {
      lines.geometry.dispose();
      lines.material.dispose();
    },
    [lines],
  );

  const liveRef = useLatest(lines);
  useFrame(() => {
    const u = liveRef.current.material.uniforms;
    u.uTime!.value = clock.time;
    u.uGrow!.value = driven(params.grow ?? 1, clock, 1) * 1.05;
    u.uBeat!.value = clock.beat;
  });

  return <primitive object={lines} />;
}
