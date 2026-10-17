"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { AdditiveBlending, DoubleSide, Mesh, ShaderMaterial, SphereGeometry } from "three";

import { col, driven, useClock, useLatest } from "../context";
import { NOISE } from "../glsl";
import type { DomeParams } from "../types";

const VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vLocal;
varying vec3 vNormalV;
varying vec3 vViewDir;
uniform vec3 uColor;
uniform float uOpacity, uBuild, uCrack, uCells, uFill, uTime, uRadius, uBeat;
${NOISE}
float hexDist(vec2 p) { p = abs(p); return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x); }
vec4 hexGrid(vec2 uv) {
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, uv - gv);
}
void main() {
  vec3 n = normalize(vLocal);
  float az = atan(n.z, n.x);
  float el = asin(clamp(n.y, 0.0, 1.0));
  vec2 uv = vec2(az * uCells / 3.14159, el * uCells / 1.5708 * 0.9);
  vec4 hx = hexGrid(uv);
  float edgeD = 0.5 - hexDist(hx.xy);
  float edge = smoothstep(0.06, 0.0, edgeD) + smoothstep(0.2, 0.0, edgeD) * 0.25;
  float cellRand = hash21(hx.zw);
  // Built from the ground up, a cell at a time.
  float grow = el / 1.5708 + cellRand * 0.15;
  float built = smoothstep(grow - 0.04, grow, uBuild * 1.15);
  // The breach: cells missing around a point, hot edges round it.
  vec3 breachDir = normalize(vec3(0.35, 0.55, 0.75));
  float bd = distance(n, breachDir);
  float hole = smoothstep(uCrack * 0.55, uCrack * 0.55 - 0.05, bd + (cellRand - 0.5) * 0.12);
  float rim = smoothstep(0.12, 0.0, abs(bd - uCrack * 0.55)) * step(0.01, uCrack);
  float flick = 0.85 + 0.15 * sin(uTime * 2.0 + cellRand * 40.0);
  float fres = pow(1.0 - abs(dot(vNormalV, vViewDir)), 2.2);
  float lines = edge * (0.35 + fres * 1.4) * flick;
  float fill = uFill * (0.15 + fres * 0.6) * (0.7 + 0.3 * cellRand);
  float a = (lines + fill) * built * (1.0 - hole) * uOpacity;
  vec3 c = uColor * a * (1.0 + uBeat * 0.5);
  c += vec3(1.0, 0.45, 0.25) * rim * (0.6 + 0.4 * sin(uTime * 7.0 + cellRand * 9.0)) * 1.4 * uOpacity;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** A lattice of glowing hexagons over the city, built from the ground up. */
export function Dome({ params }: { params: DomeParams }) {
  const clock = useClock();
  const mesh = useMemo(() => {
    const r = params.radius ?? 34;
    const geometry = new SphereGeometry(r, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      uniforms: {
        uColor: { value: col(params.color) },
        uOpacity: { value: params.opacity ?? 0.6 },
        uBuild: { value: 1 },
        uCrack: { value: 0 },
        uCells: { value: params.cells ?? 14 },
        uFill: { value: params.fill ?? 0.15 },
        uTime: { value: 0 },
        uRadius: { value: r },
        uBeat: { value: 0 },
      },
    });
    const m = new Mesh(geometry, material);
    const [x, y, z] = params.center ?? [0, -2.2, -46];
    m.position.set(x, y, z);
    m.frustumCulled = false;
    return m;
  }, [params]);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
    [mesh],
  );

  const liveRef = useLatest(mesh);
  useFrame(() => {
    const u = liveRef.current.material.uniforms;
    u.uTime!.value = clock.time;
    u.uBuild!.value = driven(params.build ?? 1, clock, 1);
    u.uCrack!.value = driven(params.crack ?? 0, clock, 0);
    u.uBeat!.value = clock.beat;
  });

  return <primitive object={mesh} />;
}
