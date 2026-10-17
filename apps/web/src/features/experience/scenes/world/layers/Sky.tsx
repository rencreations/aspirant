"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { ShaderMaterial, Vector2, Vector3, type Camera } from "three";

import { smoothstep } from "@/lib/math";

import { col, driven, useClock, useLatest } from "../context";
import { NOISE, STAR4 } from "../glsl";
import type { SkyParams } from "../types";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uAspect, uTime, uExposure;
uniform vec2 uHorizonP, uHorizonN;
uniform vec3 uTop, uMid, uBottom, uBand;
uniform float uBandStrength;
uniform vec3 uSunColor; uniform vec4 uSun; // xy pos, z size, w glow
uniform float uSunRing;
uniform vec3 uSun2Color; uniform vec4 uSun2;
uniform vec3 uCloudColor, uCloudLight, uCloudUnder;
uniform vec4 uClouds; // amount, speed, storm, height
uniform float uStars, uFlash;
uniform vec3 uRiftRim; uniform vec4 uRift; // xy pos, z size, w open
uniform vec3 uVortexA, uVortexB; uniform float uVortex;
uniform vec3 uAurora; uniform float uAuroraAmount;
uniform vec3 uWater; uniform vec2 uWaterK; // glitter, waves
uniform float uHasWater;
uniform vec3 uWhiteColor; uniform float uWhite;
uniform vec3 uPillarColor; uniform vec2 uPillar; // x along the horizon, width
${NOISE}
${STAR4}

vec3 skyAt(vec2 p, float h) {
  float t = smoothstep(0.0, 0.75, h);
  vec3 c = mix(uMid, uTop, t);
  return c;
}

vec3 sunAt(vec2 p, vec4 sun, vec3 color, float ring) {
  if (sun.z <= 0.0) return vec3(0.0);
  vec2 d = p - sun.xy;
  float r = length(d);
  float disc;
  if (ring > 0.5) {
    // A ring of amber lamps round the Dome's rim: the false sun.
    float ang = atan(d.y, d.x);
    float lamps = pow(max(0.0, cos(ang * 24.0)), 24.0);
    float band = exp(-pow((r - sun.z * 3.0) / (sun.z * 0.35), 2.0));
    disc = band * (0.35 + 1.6 * lamps);
  } else {
    disc = smoothstep(sun.z, sun.z * 0.82, r) * 2.2;
  }
  float glow = exp(-r / max(0.001, sun.z * 4.0)) * 0.9 + exp(-r / max(0.001, sun.z * 14.0)) * 0.35;
  return color * (disc + glow * sun.w);
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float h = dot(p - uHorizonP, uHorizonN);
  float along = dot(p - uHorizonP, vec2(uHorizonN.y, -uHorizonN.x));
  vec3 col;
  float above = step(0.0, h);

  // Sky above the horizon.
  vec3 sky = skyAt(p, h);
  float bandK = exp(-abs(h) * 9.0) * uBandStrength;
  sky = mix(sky, uBand, clamp(bandK, 0.0, 1.0));

  // Stars.
  if (uStars > 0.0) {
    vec2 g = p * 140.0;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float hs = hash21(cell);
    vec2 off = hash22(cell) - 0.5;
    float star = smoothstep(0.09, 0.0, length(f - off * 0.6)) * step(1.0 - uStars * 0.08, hs);
    float tw = 0.55 + 0.45 * sin(uTime * (1.0 + hs * 3.0) + hs * 40.0);
    sky += vec3(0.85, 0.9, 1.0) * star * tw * smoothstep(0.02, 0.25, h) * 1.4;
  }

  // Aurora curtains.
  if (uAuroraAmount > 0.0) {
    float x = along * 2.2 + uTime * 0.03;
    float curtain = fbm3(vec2(x, uTime * 0.05)) ;
    float vband = smoothstep(0.08, 0.22, h) * smoothstep(0.62, 0.3, h);
    float rays = pow(vnoise(vec2(x * 9.0, h * 1.5 + uTime * 0.2)), 2.0);
    sky += uAurora * vband * (curtain * 0.8 + rays * 0.6) * uAuroraAmount;
  }

  // Vortex (the Will of the Planet): a twilight spiral with dim stars.
  if (uVortex > 0.0) {
    vec2 c = vec2(0.0, 0.05);
    vec2 d = p - c;
    float r = length(d);
    float a = atan(d.y, d.x);
    float spiral = sin(a * 3.0 + log(r + 0.02) * 6.0 - uTime * 0.25);
    float arms = smoothstep(0.2, 1.0, spiral) * exp(-r * 1.3);
    float core = exp(-r * 7.0);
    vec3 v = mix(uVortexB, uVortexA, arms) * (arms * 0.9 + core * 1.5);
    float dim = step(0.985, hash21(floor((vec2(a * 6.0, log(r + 0.02) * 8.0 - uTime * 0.1)) * 6.0)));
    v += vec3(0.9, 0.85, 1.0) * dim * arms * 2.0;
    sky += v * uVortex;
  }

  // Clouds.
  if (uClouds.x > 0.0) {
    float speed = uClouds.y;
    float storm = uClouds.z;
    float ch = h - uClouds.w;
    vec2 q = vec2(along * 1.6 + uTime * speed * 0.02, h * 4.5);
    float n = fbm(q + fbm(q * 0.6 + uTime * speed * 0.01) * (0.6 + storm));
    float layer = smoothstep(0.55 - uClouds.x * 0.45, 0.85, n) * smoothstep(-0.05, 0.12, h);
    layer *= smoothstep(0.9, 0.2, abs(ch) * (1.4 - storm * 0.6));
    float lit = clamp(dot(normalize(vec2(0.0, 1.0)), vec2(0.0, n)) , 0.0, 1.0);
    vec3 cc = mix(uCloudColor, uCloudLight, smoothstep(0.55, 0.95, n));
    // Light from the sun on the cloud edges.
    float sunNear = exp(-length(p - uSun.xy) * 3.0) * step(0.0, uSun.z);
    cc += uSunColor * sunNear * 0.6 * layer;
    // Storm underlight and flashes.
    cc += uCloudUnder * storm * smoothstep(0.3, 0.0, ch) * 0.6;
    cc += uCloudLight * uFlash * (0.5 + n) * 1.2;
    sky = mix(sky, cc, layer * (0.75 + storm * 0.2));
  }

  // Suns.
  sky += sunAt(p, uSun, uSunColor, uSunRing) * smoothstep(-0.01, 0.01, h + uSun.z * 0.2 * (1.0 - uHasWater));
  sky += sunAt(p, uSun2, uSun2Color, 0.0) * smoothstep(-0.01, 0.01, h);

  // The rift: a four-pointed tear with a molten rim and stars inside.
  if (uRift.w > 0.001) {
    vec2 d = p - uRift.xy;
    float size = uRift.z * uRift.w;
    float wob = (fbm3(d * 8.0 + uTime * 0.2) - 0.5) * 0.02;
    float sd = star4(d, size, 0.55) + wob;
    float inside = smoothstep(0.004, -0.004, sd);
    vec3 voidc = vec3(0.004, 0.002, 0.01);
    float st = step(0.992, hash21(floor(d * 220.0)));
    voidc += vec3(1.0, 0.8, 0.9) * st * 0.8;
    float rim = exp(-abs(sd) * 70.0) * 2.4 + exp(-abs(sd) * 14.0) * 0.6;
    float heat = 0.6 + 0.4 * sin(uTime * 2.0 + fbm3(d * 20.0) * 6.0);
    sky = mix(sky, voidc, inside);
    sky += uRiftRim * rim * heat * uRift.w;
  }

  // Ground or water below the horizon.
  vec3 below;
  if (uHasWater > 0.5) {
    float dh = max(0.002, -h);
    vec2 wq = vec2(along / dh * 0.6, 1.0 / dh);
    float waves = vnoise(vec2(wq.x * 3.0, wq.y * 2.0 + uTime * 0.6)) * uWaterK.y;
    vec3 refl = skyAt(p, dh * 0.8);
    refl = mix(refl, uBand, exp(-dh * 9.0) * uBandStrength);
    below = mix(uWater, refl, 0.55 * exp(-dh * 3.0));
    below *= 0.85 + waves * 0.3;
    // Glitter column under the suns.
    float colx = exp(-abs(along - dot(uSun.xy - uHorizonP, vec2(uHorizonN.y, -uHorizonN.x))) / (0.02 + dh * 0.6));
    float sparkle = step(0.72, vnoise(vec2(wq.x * 40.0, wq.y * 6.0 - uTime * 2.0)));
    below += uSunColor * colx * (0.35 + sparkle * 1.6) * uWaterK.x * step(0.0, uSun.z) * exp(-dh * 2.0);
    float colx2 = exp(-abs(along - dot(uSun2.xy - uHorizonP, vec2(uHorizonN.y, -uHorizonN.x))) / (0.02 + dh * 0.6));
    below += uSun2Color * colx2 * (0.2 + sparkle) * uWaterK.x * step(0.0, uSun2.z) * exp(-dh * 2.5) * 0.6;
  } else {
    below = mix(uBand, uBottom, smoothstep(0.0, 0.25, -h));
  }
  col = mix(below, sky, above);

  if (uPillar.y > 0.0) {
    float px = abs(along - uPillar.x);
    float beam = exp(-px / uPillar.y) * 1.6 + exp(-px / (uPillar.y * 6.0)) * 0.35;
    float flick = 0.8 + 0.2 * vnoise(vec2(h * 30.0 - uTime * 6.0, uTime));
    col += uPillarColor * beam * flick * smoothstep(-0.12, 0.05, h);
  }
  col = mix(col, uWhiteColor, uWhite);
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

const _a = new Vector3();
const _b = new Vector3();

/** Project two far points at eye level and return the horizon as a point and an upward normal. */
function horizonOf(camera: Camera, aspect: number, outP: Vector2, outN: Vector2) {
  _a.set(camera.position.x - 5000, camera.position.y, camera.position.z - 20000).project(camera);
  _b.set(camera.position.x + 5000, camera.position.y, camera.position.z - 20000).project(camera);
  const ax = _a.x * 0.5 * aspect;
  const ay = _a.y * 0.5;
  const bx = _b.x * 0.5 * aspect;
  const by = _b.y * 0.5;
  let dx = bx - ax;
  let dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  // Normal pointing up (rotate the direction by +90 degrees).
  outN.set(-dy, dx);
  // Point on the line nearest the screen centre.
  const t = -(ax * dx + ay * dy);
  outP.set(ax + dx * t, ay + dy * t);
}

/** The full-screen sky, sea and weather. Always the first layer of a world. */
export function Sky({ params }: { params: SkyParams }) {
  const clock = useClock();
  const material = useMemo(() => {
    const p = params;
    const sun = p.sun;
    const sun2 = p.sun2;
    const cl = p.clouds;
    return new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uAspect: { value: 1 },
        uTime: { value: 0 },
        uExposure: { value: p.exposure ?? 1 },
        uHorizonP: { value: new Vector2() },
        uHorizonN: { value: new Vector2(0, 1) },
        uTop: { value: col(p.top) },
        uMid: { value: col(p.mid) },
        uBottom: { value: col(p.bottom) },
        uBand: { value: col(p.band ?? p.mid) },
        uBandStrength: { value: p.bandStrength ?? 0.6 },
        uSunColor: { value: col(sun?.color ?? "#000000") },
        uSun: { value: [0, 0, sun ? sun.size : 0, sun?.glow ?? 1] },
        uSunRing: { value: sun?.ring ?? 0 },
        uSun2Color: { value: col(sun2?.color ?? "#000000") },
        uSun2: { value: [0, 0, sun2 ? sun2.size : 0, sun2?.glow ?? 1] },
        uCloudColor: { value: col(cl?.color ?? "#000000") },
        uCloudLight: { value: col(cl?.light ?? "#000000") },
        uCloudUnder: { value: col(cl?.under ?? cl?.light ?? "#000000") },
        uClouds: { value: [cl?.amount ?? 0, cl?.speed ?? 1, cl?.storm ?? 0, cl?.height ?? 0.18] },
        uStars: { value: p.stars ?? 0 },
        uFlash: { value: 0 },
        uRiftRim: { value: col(p.rift?.rim ?? "#000000") },
        uRift: { value: [p.rift?.x ?? 0, p.rift?.y ?? 0.2, p.rift?.size ?? 0, 0] },
        uVortexA: { value: col(p.vortex?.color ?? "#000000") },
        uVortexB: { value: col(p.vortex?.color2 ?? "#000000") },
        uVortex: { value: p.vortex?.amount ?? 0 },
        uAurora: { value: col(p.aurora?.color ?? "#000000") },
        uAuroraAmount: { value: p.aurora?.amount ?? 0 },
        uWater: { value: col(p.water?.color ?? "#000000") },
        uWaterK: { value: new Vector2(p.water?.glitter ?? 1, p.water?.waves ?? 1) },
        uHasWater: { value: p.water ? 1 : 0 },
        uWhiteColor: { value: col(p.whiteColor ?? "#e9ecef") },
        uWhite: { value: p.white ?? 0 },
        uPillarColor: { value: col(p.pillar?.color ?? "#000000") },
        uPillar: { value: new Vector2(p.pillar?.x ?? 0, p.pillar ? (p.pillar.width ?? 0.012) : 0) },
      },
    });
  }, [params]);

  useEffect(() => () => material.dispose(), [material]);

  const strikeRef = useRef({ next: 3, level: 0 });

  const liveRef = useLatest(material);
  useFrame((state, delta) => {
    const u = liveRef.current.uniforms;
    const aspect = state.size.width / Math.max(1, state.size.height);
    u.uAspect!.value = aspect;
    u.uTime!.value = clock.time;
    horizonOf(state.camera, aspect, u.uHorizonP!.value as Vector2, u.uHorizonN!.value as Vector2);
    const hp = u.uHorizonP!.value as Vector2;
    const hn = u.uHorizonN!.value as Vector2;
    const place = (out: number[], x: number, y: number) => {
      // x runs along the horizon (direction (n.y, -n.x)), y away from it (along n).
      out[0] = hp.x + hn.y * x + hn.x * y;
      out[1] = hp.y - hn.x * x + hn.y * y;
    };
    const sun = params.sun;
    if (sun) {
      const rise = (sun.rise ?? 0) * smoothstep(0, 1, clock.chapter);
      place(u.uSun!.value as number[], sun.x, sun.y + rise);
    }
    const sun2 = params.sun2;
    if (sun2) {
      const rise = (sun2.rise ?? 0) * smoothstep(0, 1, clock.chapter);
      place(u.uSun2!.value as number[], sun2.x, sun2.y + rise);
    }
    if (params.rift) {
      const rv = u.uRift!.value as number[];
      place(rv, params.rift.x, params.rift.y);
      rv[3] = smoothstep(0, 1, driven(params.rift.open ?? 1, clock, 1));
    }
    // Lightning: rare random strikes plus the beat. Never more than about one flash a second.
    const rate = Math.min(0.5, params.flash ?? 0);
    if (rate > 0) {
      strikeRef.current.next -= delta;
      if (strikeRef.current.next <= 0) {
        strikeRef.current.level = 1;
        strikeRef.current.next = 1.2 + (Math.random() * 2) / rate;
      }
    }
    strikeRef.current.level = Math.max(0, strikeRef.current.level - delta * 3.2);
    u.uFlash!.value =
      Math.min(1, strikeRef.current.level * strikeRef.current.level + clock.beat * 0.5) *
      (rate > 0 || clock.beat > 0 ? 1 : 0);
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1000} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
