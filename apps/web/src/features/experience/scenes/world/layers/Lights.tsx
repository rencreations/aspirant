"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";

import { smoothstep } from "@/lib/math";

import { col, driven, useClock, useLatest } from "../context";
import type { LightsParams } from "../types";

const KIND = { orb: 0, star: 1, lamp: 2, flare: 3 } as const;

const VERT = /* glsl */ `
attribute vec3 lcolor;
attribute vec4 meta; // kind, size, intensity, pulse
uniform float uTime, uPixel, uBeat, uSync;
varying vec3 vColor;
varying float vKind;
varying float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float pulse = meta.w > 0.0 ? 0.8 + 0.2 * sin(uTime * meta.w * 6.2832 + (1.0 - uSync) * float(gl_VertexID) * 2.1) : 1.0;
  vI = meta.z * pulse * (1.0 + uBeat * 0.8);
  vColor = lcolor;
  vKind = meta.x;
  gl_PointSize = max(2.0, meta.y * uPixel * projectionMatrix[1][1] / max(0.3, -mv.z));
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vKind;
varying float vI;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float a;
  if (vKind < 0.5) {
    a = exp(-d * d * 60.0) * 2.0 + exp(-d * 9.0) * 0.5;
  } else if (vKind < 1.5) {
    // Four-pointed star: long thin rays on the axes, a hot core.
    vec2 p = abs(q);
    float rays = exp(-p.x * 60.0) * exp(-p.y * 5.0) + exp(-p.y * 60.0) * exp(-p.x * 5.0);
    float diag = (exp(-abs(p.x - p.y) * 40.0) * exp(-d * 9.0)) * 0.25;
    a = rays * 1.4 + diag + exp(-d * d * 150.0) * 2.5 + exp(-d * 10.0) * 0.3;
  } else if (vKind < 2.5) {
    vec2 p = abs(q);
    float box = smoothstep(0.16, 0.1, max(p.x, p.y * 0.8));
    a = box * 1.6 + exp(-d * 7.0) * 0.45;
  } else {
    a = exp(-abs(q.y) * 80.0) * exp(-abs(q.x) * 3.5) * 1.5 + exp(-d * d * 80.0);
  }
  a *= smoothstep(0.5, 0.42, max(abs(q.x), abs(q.y)));
  gl_FragColor = vec4(vColor * a * vI, 1.0);
}
`;

/** Lights in the scene: orbs, Emblem stars, lamps in windows, flares. */
export function Lights({ params }: { params: LightsParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const n = params.lights.length;
    const pos = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const meta = new Float32Array(n * 4);
    params.lights.forEach((l, i) => {
      const [x, y, z] = l.pos ?? [0, 0, 0];
      pos.set([x, y, z], i * 3);
      const c = col(l.color);
      color.set([c.r, c.g, c.b], i * 3);
      meta.set([KIND[l.kind ?? "orb"], l.size, l.intensity ?? 1, l.pulse ?? 0], i * 4);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("lcolor", new BufferAttribute(color, 3));
    geometry.setAttribute("meta", new BufferAttribute(meta, 4));
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixel: { value: 360 },
        uBeat: { value: 0 },
        uSync: { value: 0 },
      },
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { points, geometry, material };
  }, [params]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
    },
    [built],
  );

  const liveRef = useLatest(built);
  useFrame(() => {
    const u = liveRef.current.material.uniforms;
    u.uTime!.value = clock.time;
    u.uPixel!.value = clock.pixelH * 0.5;
    u.uBeat!.value = clock.beat;
    const o = params.orbit;
    if (o && params.lights.length >= 2) {
      const t = smoothstep(0, 1, driven(o.drive, clock, 0));
      const sep = o.from + (o.to - o.from) * t;
      const ang = clock.time * (o.speed ?? 0.25);
      const [cx, cy, cz] = o.center;
      const attr = liveRef.current.geometry.getAttribute("position") as BufferAttribute;
      const r = sep / 2;
      attr.setXYZ(
        0,
        cx + Math.cos(ang) * r,
        cy + Math.sin(ang * 0.7) * r * 0.25,
        cz + Math.sin(ang) * r * 0.5,
      );
      attr.setXYZ(
        1,
        cx - Math.cos(ang) * r,
        cy - Math.sin(ang * 0.7) * r * 0.25,
        cz - Math.sin(ang) * r * 0.5,
      );
      attr.needsUpdate = true;
      u.uSync!.value = o.sync ? smoothstep(1.2, 0.2, sep) : 0;
    }
  });

  return <primitive object={built.points} />;
}
