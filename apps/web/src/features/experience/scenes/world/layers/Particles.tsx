"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";

import { mulberry32 } from "@/lib/math";

import { col, driven, useClock, useLatest } from "../context";
import type { ParticleMode, ParticleParams } from "../types";

const MODES: Record<ParticleMode, number> = {
  motes: 0,
  sparks: 1,
  ash: 2,
  rain: 3,
  snow: 4,
  lanterns: 5,
  embers: 6,
  leaves: 7,
  eyes: 8,
  dust: 9,
  fireworks: 10,
  blacksnow: 11,
  stars: 12,
  petals: 13,
  darts: 14,
};

const ADDITIVE = new Set<ParticleMode>([
  "motes",
  "sparks",
  "lanterns",
  "embers",
  "eyes",
  "fireworks",
  "stars",
  "darts",
  "rain",
  "snow",
]);

const DEFAULTS: Record<ParticleMode, { count: number; size: number; speed: number }> = {
  motes: { count: 900, size: 0.05, speed: 1 },
  sparks: { count: 700, size: 0.14, speed: 1 },
  ash: { count: 1400, size: 0.07, speed: 1 },
  rain: { count: 2200, size: 0.22, speed: 1 },
  snow: { count: 1600, size: 0.06, speed: 1 },
  lanterns: { count: 420, size: 0.16, speed: 1 },
  embers: { count: 700, size: 0.07, speed: 1 },
  leaves: { count: 260, size: 0.11, speed: 1 },
  eyes: { count: 2400, size: 0.06, speed: 1 },
  dust: { count: 1600, size: 0.08, speed: 1 },
  fireworks: { count: 1800, size: 0.08, speed: 1 },
  blacksnow: { count: 700, size: 0.16, speed: 1 },
  stars: { count: 1800, size: 0.05, speed: 1 },
  petals: { count: 240, size: 0.1, speed: 1 },
  darts: { count: 160, size: 0.09, speed: 1 },
};

const VERT = /* glsl */ `
attribute vec4 seed;
uniform float uTime, uMode, uSize, uSpeed, uPixel, uAmount, uTilt, uBeat;
uniform vec4 uAreaA; // halfX, yBottom, yTop, zNear
uniform float uZFar;
varying float vAlpha;
varying float vMix;
varying float vKind;

float fr(float x) { return fract(x); }

void main() {
  vec3 p = position;
  float t = uTime * uSpeed;
  float s = seed.x; float s2 = seed.y; float s3 = seed.z; float s4 = seed.w;
  float h = uAreaA.z - uAreaA.y;
  float size = uSize * (0.55 + s2 * 0.9);
  vAlpha = 1.0;
  vMix = s3;
  vKind = 0.0;
  int m = int(uMode + 0.5);
  if (m == 0) { // motes: slow drift in light
    p.x += sin(t * 0.13 + s * 30.0) * 0.6;
    p.y += sin(t * 0.17 + s2 * 20.0) * 0.4 + fr(t * 0.004 + s) * 0.0;
    p.z += cos(t * 0.11 + s3 * 10.0) * 0.4;
    vAlpha = 0.45 + 0.55 * sin(t * (0.8 + s4) + s * 50.0);
  } else if (m == 1 || m == 3) { // sparks, rain: fall with a slant
    float fall = fr(s + t * (m == 1 ? 0.07 + s2 * 0.08 : 0.55 + s2 * 0.4));
    p.y = uAreaA.z - fall * h;
    p.x += fall * h * uTilt;
    vAlpha = m == 1 ? smoothstep(0.0, 0.1, fall) * (1.0 - fall) * 1.6 : 0.5;
    vKind = 1.0;
  } else if (m == 2 || m == 4 || m == 11) { // ash, snow, black snow: slow fall with sway
    float rate = m == 4 ? 0.035 : (m == 11 ? 0.03 : 0.02);
    float fall = fr(s + t * rate * (0.6 + s2));
    p.y = uAreaA.z - fall * h;
    p.x += sin(t * 0.5 + s * 40.0) * 0.35 + fall * h * uTilt;
    p.z += cos(t * 0.4 + s2 * 30.0) * 0.25;
    vAlpha = smoothstep(0.0, 0.08, fall) * smoothstep(1.0, 0.85, fall);
  } else if (m == 5) { // lanterns on the water: bob and drift out to sea
    float out_ = fr(s + t * 0.006);
    p.z = mix(uAreaA.w, uZFar, out_);
    p.y = uAreaA.y + sin(t * 0.8 + s * 30.0) * 0.03;
    p.x += sin(t * 0.07 + s2 * 9.0) * 0.4;
    vAlpha = smoothstep(0.0, 0.05, out_) * smoothstep(1.0, 0.7, out_) * (0.75 + 0.25 * sin(t * 2.3 + s * 70.0));
  } else if (m == 6) { // embers rising
    float rise = fr(s + t * (0.05 + s2 * 0.05));
    p.y = uAreaA.y + rise * h;
    p.x += sin(t * 1.3 + s * 40.0) * 0.25 * rise;
    vAlpha = smoothstep(0.0, 0.1, rise) * (1.0 - rise) * (0.6 + 0.4 * sin(t * 9.0 + s * 90.0));
  } else if (m == 7 || m == 13) { // leaves, petals: tumble down and sideways
    float fall = fr(s + t * (m == 7 ? 0.025 : 0.02) * (0.6 + s2));
    p.y = uAreaA.z - fall * h;
    p.x += sin(t * 0.7 + s * 40.0) * 0.8 + (m == 13 ? fall * 6.0 : 0.0);
    size *= 0.6 + 0.4 * abs(sin(t * (1.5 + s3 * 2.0) + s * 20.0));
    vAlpha = smoothstep(0.0, 0.05, fall) * smoothstep(1.0, 0.9, fall);
    vKind = 2.0;
  } else if (m == 8) { // eyes: pairs that open with the amount and blink
    float open = step(s, uAmount);
    float blink = step(0.04, fr(t * 0.11 + s2 * 13.0));
    vAlpha = open * blink * (0.6 + 0.4 * sin(t * 0.7 + s3 * 40.0));
  } else if (m == 9) { // dust blowing sideways
    float drift = fr(s + t * (0.03 + s2 * 0.04));
    p.x = mix(-uAreaA.x, uAreaA.x, drift);
    p.y += sin(t * 0.9 + s * 50.0) * 0.2;
    vAlpha = smoothstep(0.0, 0.1, drift) * smoothstep(1.0, 0.85, drift) * 0.7;
  } else if (m == 10) { // fireworks: bursts of gold and crimson
    float burst = floor(s4 * 9.0);
    float period = 3.2 + fr(burst * 0.37) * 2.0;
    float local = fr(t / period + fr(burst * 0.713));
    vec3 c = vec3(-uAreaA.x * 0.8 + fr(burst * 0.531 + floor(t / period) * 0.19) * uAreaA.x * 1.6,
                  uAreaA.y + h * (0.55 + fr(burst * 0.917) * 0.4), position.z);
    float th = s * 6.2832; float ph = acos(1.0 - 2.0 * s2);
    vec3 dir = vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
    float r = (1.0 - exp(-local * 5.0)) * (1.2 + fr(burst * 0.3) * 0.8);
    p = c + dir * r - vec3(0.0, local * local * 0.9, 0.0);
    vAlpha = smoothstep(0.0, 0.03, local) * pow(1.0 - local, 1.6);
    vMix = fr(burst * 0.47);
  } else if (m == 12) { // fixed stars in depth
    vAlpha = 0.5 + 0.5 * sin(t * (0.5 + s2 * 2.0) + s * 60.0);
  } else if (m == 14) { // darts circling the Citadel
    float ang = t * (0.25 + s2 * 0.3) + s * 6.2832;
    float rad = 2.0 + s3 * 4.0;
    p = position + vec3(cos(ang) * rad, sin(ang * 1.7) * 0.6 + s4 * 2.0, sin(ang) * rad * 0.4);
    vAlpha = 0.8;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, size * uPixel * projectionMatrix[1][1] / max(0.1, -mv.z));
  vAlpha *= smoothstep(0.2, 1.2, -mv.z);
  vAlpha *= 1.0 + uBeat * 0.6;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor, uColor2;
uniform float uOpacity, uMode;
varying float vAlpha;
varying float vMix;
varying float vKind;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a;
  if (vKind > 0.5 && vKind < 1.5) {
    // A thin vertical streak inside the sprite.
    a = smoothstep(0.08, 0.0, abs(q.x)) * smoothstep(0.5, 0.1, abs(q.y));
  } else if (vKind > 1.5) {
    // A flat tumbling flake.
    float d = length(q * vec2(1.0, 1.8));
    a = smoothstep(0.5, 0.35, d);
  } else {
    float d = length(q);
    a = exp(-d * d * 22.0) + smoothstep(0.5, 0.0, d) * 0.15;
  }
  vec3 c = mix(uColor, uColor2, vMix);
  float alpha = a * vAlpha * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(c, alpha);
}
`;

/** GPU particle field. Positions are static; all motion runs in the vertex shader. */
export function Particles({ params }: { params: ParticleParams }) {
  const clock = useClock();
  const defaults = DEFAULTS[params.mode];
  const count = Math.max(8, Math.round((params.count ?? defaults.count) * clock.quality));

  const points = useMemo(() => {
    const rand = mulberry32(count * 31 + MODES[params.mode] * 977);
    const [hx, y0, y1, zNear, zFar] = params.area ?? [12, -3, 6, 2, -30];
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const s = [rand(), rand(), rand(), rand()];
      seed.set(s, i * 4);
      let x = (rand() * 2 - 1) * hx;
      let y = y0 + rand() * (y1 - y0);
      let z = zNear + rand() * (zFar - zNear);
      if (params.mode === "eyes") {
        // Rows of sleepers: eyes come in pairs, rows recede into the dark.
        const pair = Math.floor(i / 2);
        const cols = 60;
        const row = Math.floor(pair / cols);
        const c = pair % cols;
        const rows = Math.max(1, Math.ceil(count / 2 / cols));
        z = zNear + (row / rows) * (zFar - zNear);
        const width = hx * (0.4 + (row / rows) * 1.6);
        x = (c / (cols - 1) - 0.5) * 2 * width + (i % 2 === 0 ? -0.07 : 0.07) * (1 + row * 0.05);
        y = y0 + (row / rows) * (y1 - y0) * 0.3 + (rand() - 0.5) * 0.05;
      }
      if (params.mode === "lanterns") y = y0;
      pos.set([x, y, z], i * 3);
    }
    // Eyes of a pair open together.
    if (params.mode === "eyes") for (let i = 1; i < count; i += 2) seed[i * 4] = seed[(i - 1) * 4]!;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(pos, 3));
    geometry.setAttribute("seed", new BufferAttribute(seed, 4));
    const additive = ADDITIVE.has(params.mode);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uMode: { value: MODES[params.mode] },
        uSize: { value: params.size ?? defaults.size },
        uSpeed: { value: params.speed ?? defaults.speed },
        uPixel: { value: 720 },
        uAmount: { value: 1 },
        uTilt: { value: params.tilt ?? 0 },
        uBeat: { value: 0 },
        uAreaA: { value: [hx, y0, y1, zNear] },
        uZFar: { value: zFar },
        uColor: { value: col(params.color) },
        uColor2: { value: col(params.color2 ?? params.color) },
        uOpacity: { value: params.opacity ?? 1 },
      },
    });
    const pts = new Points(geometry, material);
    pts.frustumCulled = false;
    return pts;
  }, [params, count, defaults]);

  useEffect(
    () => () => {
      points.geometry.dispose();
      points.material.dispose();
    },
    [points],
  );

  const liveRef = useLatest(points);
  useFrame(() => {
    const u = liveRef.current.material.uniforms;
    u.uTime!.value = clock.time;
    u.uPixel!.value = clock.pixelH * 0.5;
    u.uAmount!.value = driven(params.amount ?? 1, clock, 1);
    u.uBeat!.value = clock.beat;
  });

  return <primitive object={points} />;
}
