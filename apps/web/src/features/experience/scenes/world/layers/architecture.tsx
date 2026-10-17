"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Texture,
} from "three";

import { asset } from "@/lib/asset";
import { mulberry32, smoothstep } from "@/lib/math";

import { col, driven, useClock } from "../context";
import { NOISE } from "../glsl";
import type { ShapeParams } from "../types";

interface Disposable {
  dispose(): void;
}

function useDisposables(list: Disposable[]) {
  useEffect(
    () => () => {
      for (const d of list) d.dispose();
    },
    [list],
  );
}

const POINT_VERT = /* glsl */ `
attribute float phase;
uniform float uTime, uPixel, uSize, uLit, uWave;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float on = step(phase, uLit);
  float wave = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.4 - position.x * 0.35 + phase * 2.0), 3.0);
  vA = mix(0.18, 1.0, on) * mix(1.0, wave, uWave);
  gl_PointSize = max(1.5, uSize * uPixel * projectionMatrix[1][1] / max(0.5, -mv.z));
}
`;
const POINT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = exp(-d * d * 40.0) * 1.6 + exp(-d * 8.0) * 0.3;
  gl_FragColor = vec4(uColor * a * vA, 1.0);
}
`;

function glowPoints(positions: number[], phases: number[], color: string, size: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("phase", new BufferAttribute(new Float32Array(phases), 1));
  const material = new ShaderMaterial({
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixel: { value: 360 },
      uSize: { value: size },
      uLit: { value: 1 },
      uWave: { value: 0 },
      uColor: { value: col(color) },
    },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, geometry, material };
}

/* Corridor: long and white, cold blue lamps, a black gate at the end. Walk it with progress. */

const CORRIDOR_VERT = /* glsl */ `
varying vec3 vW;
varying vec3 vL;
void main() {
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const CORRIDOR_FRAG = /* glsl */ `
precision highp float;
varying vec3 vW;
varying vec3 vL;
uniform vec3 uWall, uLamp, uFog;
uniform float uLights, uTime, uLength;
void main() {
  float z = vL.z * uLength;
  float seam = smoothstep(0.03, 0.0, abs(fract(z / 2.4) - 0.5) - 0.47);
  vec3 c = uWall * (0.55 + 0.1 * step(0.0, vL.y));
  c *= 1.0 - seam * 0.35;
  // Ceiling lamps every 4 units, pools of cold light under them.
  float lz = fract(z / 4.0) - 0.5;
  float onCeiling = smoothstep(0.45, 0.5, vL.y);
  float lamp = onCeiling * smoothstep(0.1, 0.05, abs(lz)) * smoothstep(0.12, 0.08, abs(vL.x));
  float pool = exp(-lz * lz * 30.0) * (1.0 - onCeiling * 0.5);
  float flick = uLights * (0.92 + 0.08 * sin(uTime * 13.0 + floor(z / 4.0)));
  c = c * (0.25 + 0.75 * pool * flick) + uLamp * (lamp * 3.0 + pool * 0.25) * flick;
  float fogK = smoothstep(4.0, uLength * 0.9, -vW.z + 10.0);
  gl_FragColor = vec4(mix(c, uFog, fogK), 1.0);
}
`;

export function Corridor({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const L = 64;
    const group = new Group();
    const geo = new BoxGeometry(1, 1, 1);
    const mat = new ShaderMaterial({
      vertexShader: CORRIDOR_VERT,
      fragmentShader: CORRIDOR_FRAG,
      side: BackSide,
      uniforms: {
        uWall: { value: col(p.color) },
        uLamp: { value: col(p.color2 ?? "#6fb6ff") },
        uFog: { value: col(p.color3 ?? "#0b1220") },
        uLights: { value: 1 },
        uTime: { value: 0 },
        uLength: { value: L },
      },
    });
    const box = new Mesh(geo, mat);
    box.scale.set(3.6, 3.2, L);
    box.position.set(0, 0.1, 11 - L / 2);
    group.add(box);
    // The black gate at the far end.
    const gg = new PlaneGeometry(1.4, 2.4);
    const gm = new ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec2 vUv; uniform float uTime, uOpen;
        ${NOISE}
        void main() {
          vec2 q = (vUv - 0.5) * vec2(1.4, 2.4);
          float edge = 0.5 * uOpen + (fbm(q * 6.0 + uTime * 0.3) - 0.5) * 0.15;
          float d = max(abs(q.x) * 1.6, abs(q.y)) - edge * 2.2;
          float inside = smoothstep(0.02, -0.02, d);
          float rim = exp(-abs(d) * 30.0) * uOpen;
          vec3 c = vec3(0.0) + vec3(0.75, 0.82, 1.0) * rim * 1.5;
          gl_FragColor = vec4(c, max(inside, clamp(rim, 0.0, 1.0)));
        }`,
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 } },
    });
    const gate = new Mesh(gg, gm);
    gate.position.set(0, 0.1, 11 - L + 2);
    group.add(gate);
    return { group, mat, gm, L, list: [geo, mat, gg, gm] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    const walk = smoothstep(p.a ?? 0, p.b ?? 1, driven(p.drive ?? "chapter", clock));
    built.group.position.z = walk * (built.L - 16);
    const u = built.mat.uniforms;
    u.uTime!.value = clock.time;
    // At the end the lights go out and the gate opens.
    u.uLights!.value = 1 - smoothstep(0.62, 0.75, walk) * 0.85;
    built.gm.uniforms.uTime!.value = clock.time;
    built.gm.uniforms.uOpen!.value = smoothstep(0.55, 0.8, walk);
  });
  return <primitive object={built.group} />;
}

/* Hall: two rows of tall shapes receding into the dark (glass cells, vats, machines). */

const HALL_VERT = /* glsl */ `
varying vec3 vLocal;
varying float vDepth;
varying float vId;
void main() {
  vec4 local = vec4(position, 1.0);
  vId = 0.0;
  #ifdef USE_INSTANCING
  local = instanceMatrix * local;
  vId = float(gl_InstanceID);
  #endif
  vLocal = position;
  vec4 mv = modelViewMatrix * local;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const HALL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vLocal;
varying float vDepth;
varying float vId;
uniform vec3 uBase, uGlow, uFog;
uniform float uStyle, uTime, uFar, uBeat;
${NOISE}
void main() {
  float y = vLocal.y + 0.5;
  vec3 c = uBase;
  float r = hash11(vId * 7.13);
  if (uStyle < 0.5) {
    // Glass cells with a cold light inside.
    float fill = smoothstep(0.0, 0.9, y) * 0.35 + 0.15;
    float frame = smoothstep(0.46, 0.5, max(abs(vLocal.x), abs(vLocal.z)));
    c = mix(uBase, uGlow, fill * (0.6 + 0.4 * sin(uTime * 0.6 + r * 10.0))) + uGlow * frame * 0.3;
  } else if (uStyle < 1.5) {
    // Vats: glowing liquid with slow bubbles.
    float level = 0.82;
    float liquid = step(y, level);
    float bub = step(0.97, vnoise(vec2(vLocal.x * 12.0 + r * 9.0, y * 20.0 - uTime * 1.5)));
    c = mix(uBase, uGlow * (0.5 + y * 0.5), liquid) + uGlow * bub * liquid;
  } else if (uStyle < 2.5) {
    // Machines: banks of small lights.
    vec2 g = vec2(vLocal.x + vLocal.z, y) * vec2(8.0, 22.0);
    float led = step(0.82, hash21(floor(g) + floor(uTime * (0.5 + r)) * 0.01)) * smoothstep(0.35, 0.1, length(fract(g) - 0.5));
    c = uBase + uGlow * led * 1.6 + uGlow * 0.04;
  } else {
    // Spine: red eyes in rings up the column.
    float ring = smoothstep(0.08, 0.0, abs(fract(y * 9.0) - 0.5));
    float a = atan(vLocal.z, vLocal.x);
    float eye = step(0.6, sin(a * 6.0 + floor(y * 9.0))) * ring;
    c = uBase + uGlow * eye * (1.5 + uBeat);
  }
  c = mix(c, uFog, smoothstep(6.0, uFar, vDepth));
  gl_FragColor = vec4(c, 1.0);
}
`;

export function Hall({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const style = p.a ?? 0;
    const per = Math.round((p.b ?? 14) * Math.max(0.6, clock.quality));
    const geo =
      style === 1
        ? new CylinderGeometry(0.5, 0.5, 1, 24, 1, false)
        : style === 3
          ? new CylinderGeometry(0.5, 0.6, 1, 32, 1, false)
          : new BoxGeometry(1, 1, 1);
    const mat = new ShaderMaterial({
      vertexShader: HALL_VERT,
      fragmentShader: HALL_FRAG,
      uniforms: {
        uBase: { value: col(p.color) },
        uGlow: { value: col(p.color2 ?? "#7fd6ff") },
        uFog: { value: col(p.color3 ?? "#05060a") },
        uStyle: { value: style },
        uTime: { value: 0 },
        uFar: { value: 70 },
        uBeat: { value: 0 },
      },
    });
    const count = style === 3 ? 1 : per * 2;
    const mesh = new InstancedMesh(geo, mat, count);
    const m = new Matrix4();
    const rand = mulberry32(17 + style);
    if (style === 3) {
      m.makeScale(2.2, 26, 2.2);
      m.setPosition(0, 9, -22);
      mesh.setMatrixAt(0, m);
    } else {
      for (let i = 0; i < per; i++) {
        for (const side of [-1, 1]) {
          const h = style === 1 ? 3.4 : 2.6 + rand() * (style === 2 ? 3 : 0.8);
          const w = style === 1 ? 1.5 : 1.2;
          m.makeScale(w, h, w);
          m.setPosition(side * (3.2 + (style === 2 ? rand() * 0.8 : 0)), -2 + h / 2, 6 - i * 4.4);
          mesh.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m);
        }
      }
    }
    mesh.frustumCulled = false;
    return { mesh, mat, list: [geo, mat] as Disposable[] };
  }, [p, clock.quality]);
  useDisposables(built.list);
  useFrame(() => {
    built.mat.uniforms.uTime!.value = clock.time;
    built.mat.uniforms.uBeat!.value = clock.beat;
  });
  return <primitive object={built.mesh} />;
}

/* Citadel: a tall spired ship with red light in its seams. */

const CITADEL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vLocal;
varying float vDepth;
varying float vId;
uniform vec3 uBase, uGlow;
uniform float uTime, uBeat;
${NOISE}
void main() {
  float y = vLocal.y + 0.5;
  float seam = smoothstep(0.03, 0.0, abs(fract(y * 7.0 + hash11(vId) * 3.0) - 0.5) - 0.45);
  float vert = smoothstep(0.02, 0.0, abs(fract(atan(vLocal.z, vLocal.x) * 1.2 + vId) - 0.5) - 0.47);
  float flick = 0.7 + 0.3 * sin(uTime * 2.0 + vId * 3.0 + y * 8.0);
  vec3 c = uBase + uGlow * (seam + vert * 0.6) * flick * (1.2 + uBeat);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function Citadel({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const geo = new CylinderGeometry(0.0, 0.5, 1, 6, 1, false);
    const mat = new ShaderMaterial({
      vertexShader: HALL_VERT,
      fragmentShader: CITADEL_FRAG,
      uniforms: {
        uBase: { value: col(p.color) },
        uGlow: { value: col(p.color2 ?? "#ff3b4e") },
        uTime: { value: 0 },
        uBeat: { value: 0 },
      },
    });
    const rand = mulberry32(5);
    const n = 13;
    const mesh = new InstancedMesh(geo, mat, n);
    const m = new Matrix4();
    for (let i = 0; i < n; i++) {
      const centre = i === 0;
      const h = centre ? 9 : 2.5 + rand() * 5;
      const w = centre ? 2.2 : 0.6 + rand() * 1.1;
      const x = centre ? 0 : (rand() * 2 - 1) * 3.2;
      m.makeScale(w, h, w);
      m.setPosition(x, h / 2 - 2 + (centre ? 0 : rand() * 1.5), (rand() - 0.5) * 2);
      mesh.setMatrixAt(i, m);
    }
    // The hull under the spires.
    const hull = new Mesh(
      new SphereGeometry(1, 24, 12),
      new MeshBasicMaterial({ color: col(p.color) }),
    );
    hull.scale.set(4.2, 1.6, 2.2);
    hull.position.set(0, -2, 0);
    const group = new Group();
    group.add(hull, mesh);
    const [x, y, z] = p.pos ?? [0, 3.5, -40];
    group.position.set(x, y, z);
    group.scale.setScalar(p.scale ?? 1);
    return {
      group,
      mat,
      list: [geo, mat, hull.geometry, hull.material as MeshBasicMaterial] as Disposable[],
    };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    built.mat.uniforms.uTime!.value = clock.time;
    built.mat.uniforms.uBeat!.value = clock.beat;
    const descend = p.drive ? smoothstep(0, 1, driven(p.drive, clock)) : 0;
    built.group.position.y = (p.pos?.[1] ?? 3.5) + Math.sin(clock.time * 0.3) * 0.15 - descend * 2;
  });
  return <primitive object={built.group} />;
}

/* Terrain: snow mountains the sun runs down, a shore of lighthouses, a cliff. */

const RIDGE_VERT = /* glsl */ `
attribute float hgt;
varying float vH;
varying float vDepth;
void main() {
  vH = hgt;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;
const RIDGE_FRAG = /* glsl */ `
precision highp float;
varying float vH;
varying float vDepth;
uniform vec3 uSnow, uLit, uBase, uFog;
uniform float uRun, uFogK;
void main() {
  vec3 c = mix(uBase, uSnow, smoothstep(0.1, 0.75, vH));
  float lit = smoothstep(uRun - 0.25, uRun, vH);
  c = mix(c, uLit, lit * 0.8);
  c = mix(c, uFog, uFogK);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function Terrain({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const group = new Group();
    const list: Disposable[] = [];
    const ridgeMats: ShaderMaterial[] = [];
    const rand = mulberry32(31);
    const fbm1 = (x: number, seed: number) => {
      let v = 0;
      let a = 0.5;
      let f = 1;
      for (let o = 0; o < 5; o++) {
        v += a * Math.sin(x * f * 0.11 + seed * (o + 1) * 1.7) * Math.cos(x * f * 0.053 + seed);
        f *= 2.1;
        a *= 0.5;
      }
      return v;
    };
    if ((p.a ?? 0) > 0) {
      const layers = [
        { z: -150, h: 30, fog: 0.45 },
        { z: -120, h: 22, fog: 0.25 },
        { z: -95, h: 14, fog: 0.1 },
      ];
      layers.forEach((layer, k) => {
        const segs = 220;
        const geo = new PlaneGeometry(420, 1, segs, 1);
        const pos = geo.getAttribute("position") as BufferAttribute;
        const hgt = new Float32Array(pos.count);
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const top = pos.getY(i) > 0;
          const peak = Math.max(
            0.15,
            0.55 + fbm1(x, 3 + k) * 0.9 + Math.exp(-(((x - 20 + k * 30) / 60) ** 2)) * 0.5,
          );
          const y = top ? -2.2 + peak * layer.h : -4;
          pos.setY(i, y);
          hgt[i] = top ? Math.min(1, peak) : 0;
        }
        geo.setAttribute("hgt", new BufferAttribute(hgt, 1));
        const mat = new ShaderMaterial({
          vertexShader: RIDGE_VERT,
          fragmentShader: RIDGE_FRAG,
          uniforms: {
            uSnow: { value: col(p.color) },
            uLit: { value: col(p.color2 ?? "#ffcf9a") },
            uBase: { value: col(p.color3 ?? "#5a6478") },
            uFog: { value: col("#dfe4ec") },
            uRun: { value: 1 },
            uFogK: { value: layer.fog },
          },
        });
        const mesh = new Mesh(geo, mat);
        mesh.position.z = layer.z;
        group.add(mesh);
        ridgeMats.push(mat);
        list.push(geo, mat);
      });
    }
    let lamps: ReturnType<typeof glowPoints> | null = null;
    const lit = p.b ?? 0;
    if (lit > 0 || p.drive) {
      // A hundred and seventeen lighthouses along the far shore.
      const n = 117;
      const geo = new BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      const mat = new MeshBasicMaterial({ color: col("#e9edf3"), fog: true });
      const towers = new InstancedMesh(geo, mat, n);
      const m = new Matrix4();
      const lp: number[] = [];
      const ph: number[] = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = -46 + t * 92;
        const z = -34 - Math.sin(t * Math.PI) * 6 + rand() * 0.8;
        const h = 0.9 + rand() * 0.5;
        m.makeScale(0.16, h, 0.16);
        m.setPosition(x, -2.25, z);
        towers.setMatrixAt(i, m);
        lp.push(x, -2.25 + h + 0.06, z);
        ph.push(rand());
      }
      towers.frustumCulled = false;
      group.add(towers);
      lamps = glowPoints(lp, ph, p.color2 ?? "#ffd9a0", 0.3);
      lamps.material.uniforms.uWave!.value = 1;
      group.add(lamps.points);
      list.push(geo, mat, lamps.geometry, lamps.material);
    }
    if ((p.c ?? 0) > 0) {
      // A dark cliff edge in the foreground.
      const geo = new PlaneGeometry(26, 1, 80, 1);
      const pos = geo.getAttribute("position") as BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const top = pos.getY(i) > 0;
        const edge = Math.max(0, (x + 13) / 26);
        pos.setY(i, top ? -1.2 + (1 - edge) * 1.6 + fbm1(x * 6, 9) * 0.35 : -8);
      }
      const mat = new MeshBasicMaterial({ color: col(p.color3 ?? "#0b0e16"), fog: false });
      const cliff = new Mesh(geo, mat);
      cliff.position.set(-12, 0, -4);
      group.add(cliff);
      list.push(geo, mat);
    }
    return { group, ridgeMats, lamps, list };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    const run = p.drive ? 1 - smoothstep(0, 1, driven(p.drive, clock)) * 0.9 : 0.4;
    for (const m of built.ridgeMats) m.uniforms.uRun!.value = run + 0.15;
    if (built.lamps) {
      const u = built.lamps.material.uniforms;
      u.uTime!.value = clock.time;
      u.uPixel!.value = clock.pixelH * 0.5;
      u.uLit!.value = p.drive ? driven(p.drive, clock) : (p.b ?? 0);
    }
  });
  return <primitive object={built.group} />;
}

/* Tree: a small crooked tree that leans east toward a light that is not there. */

export function Tree({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const rand = mulberry32(73);
    const geo = new CylinderGeometry(0.5, 0.7, 1, 6, 1, false);
    geo.translate(0, 0.5, 0);
    const mat = new MeshBasicMaterial({ color: col(p.color), fog: true });
    const branches: Matrix4[] = [];
    const tips: number[] = [];
    const lean = p.a ?? 0.35;
    const up = new Vector3(0, 1, 0);
    const grow = (base: Vector3, dir: Vector3, len: number, width: number, depth: number) => {
      const q = new Quaternion().setFromUnitVectors(up, dir.clone().normalize());
      const m = new Matrix4().compose(base, q, new Vector3(width, len, width));
      branches.push(m);
      const end = base.clone().add(dir.clone().normalize().multiplyScalar(len));
      if (depth === 0) {
        tips.push(end.x, end.y, end.z);
        return;
      }
      for (let k = 0; k < 2 + (rand() < 0.4 ? 1 : 0); k++) {
        const d = dir
          .clone()
          .normalize()
          .add(new Vector3((rand() - 0.5) * 1.3 + lean * 0.5, rand() * 0.4, (rand() - 0.5) * 0.6));
        grow(end, d, len * (0.62 + rand() * 0.15), width * 0.62, depth - 1);
      }
    };
    grow(new Vector3(0, 0, 0), new Vector3(lean, 1, 0), 1.6, 0.16, 5);
    const mesh = new InstancedMesh(geo, mat, branches.length);
    branches.forEach((m, i) => mesh.setMatrixAt(i, m));
    const leaves = glowPoints(
      tips.flatMap((v, i) => (i % 3 === 0 ? [v, tips[i + 1]!, tips[i + 2]!] : [])),
      tips.filter((_, i) => i % 3 === 0).map(() => rand()),
      p.color2 ?? "#7fbf6a",
      0.22,
    );
    const group = new Group();
    group.add(mesh, leaves.points);
    const [x, y, z] = p.pos ?? [2.5, -2.2, -4];
    group.position.set(x, y, z);
    group.scale.setScalar(p.scale ?? 1);
    return { group, leaves, list: [geo, mat, leaves.geometry, leaves.material] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    const u = built.leaves.material.uniforms;
    u.uTime!.value = clock.time;
    u.uPixel!.value = clock.pixelH * 0.5;
    built.group.rotation.z = Math.sin(clock.time * 0.4) * 0.01;
  });
  return <primitive object={built.group} />;
}

/* Ship: small, silver with a green sheen and three cyan jets. */

export function Ship({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const geo = new SphereGeometry(1, 32, 16);
    const mat = new ShaderMaterial({
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `precision highp float; varying vec3 vN; varying vec3 vV; uniform vec3 uSilver, uSheen;
        void main() { float f = pow(1.0 - max(0.0, dot(vN, vV)), 2.0); float top = smoothstep(-0.2, 0.8, vN.y);
        gl_FragColor = vec4(uSilver * (0.25 + top * 0.6) + uSheen * f * 1.2, 1.0); }`,
      uniforms: { uSilver: { value: col(p.color) }, uSheen: { value: col(p.color2 ?? "#7dffc9") } },
    });
    const hull = new Mesh(geo, mat);
    hull.scale.set(1.6, 0.42, 0.7);
    const jets = glowPoints(
      [-1.65, 0.05, 0, -1.6, -0.12, 0.22, -1.6, -0.12, -0.22],
      [0, 0, 0],
      p.color3 ?? "#5ce1ff",
      0.7,
    );
    const group = new Group();
    group.add(hull, jets.points);
    const s = p.scale ?? 1;
    group.scale.setScalar(s);
    return { group, jets, list: [geo, mat, jets.geometry, jets.material] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    const [x, y, z] = p.pos ?? [3, 0.5, -10];
    const land = p.drive ? smoothstep(0, 1, driven(p.drive, clock)) : 1;
    built.group.position.set(
      x + (1 - land) * 6,
      y + (1 - land) * 5 + Math.sin(clock.time * 0.8) * 0.05,
      z,
    );
    built.group.rotation.z = (1 - land) * -0.25;
    const u = built.jets.material.uniforms;
    u.uTime!.value = clock.time;
    u.uPixel!.value = clock.pixelH * 0.5;
  });
  return <primitive object={built.group} />;
}

/* Giant: a vast silhouette with lit eyes; a gem on the brow, or a golden halo. */

export function Giant({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const kind = p.a ?? 0;
    const group = new Group();
    const list: Disposable[] = [];
    const dark = new MeshBasicMaterial({ color: col(p.color), fog: true });
    list.push(dark);
    const box = new BoxGeometry(1, 1, 1);
    list.push(box);
    const part = (sx: number, sy: number, sz: number, x: number, y: number, z = 0, rz = 0) => {
      const m = new Mesh(box, dark);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      m.rotation.z = rz;
      group.add(m);
      return m;
    };
    part(2.4, 4.4, 1.4, 0, 2.2); // body
    part(4.6, 1.0, 1.6, 0, 4.2); // shoulders
    part(1.0, 1.2, 1.0, 0, 5.3); // head
    part(0.8, 4.2, 0.8, -2.5, 2.3, 0, 0.12); // arms
    part(0.8, 4.2, 0.8, 2.5, 2.3, 0, -0.12);
    part(0.9, 3.4, 0.9, -0.7, -1.4); // legs
    part(0.9, 3.4, 0.9, 0.7, -1.4);
    if (kind === 3) {
      part(0.25, 1.6, 0.25, -0.55, 6.4, 0, 0.5); // horns
      part(0.25, 1.6, 0.25, 0.55, 6.4, 0, -0.5);
    }
    const glowMat = new MeshBasicMaterial({ color: col(p.color2 ?? "#ffa24a") });
    list.push(glowMat);
    const eyeGeo = new BoxGeometry(0.22, 0.08, 0.05);
    list.push(eyeGeo);
    for (const x of [-0.24, 0.24]) {
      const e = new Mesh(eyeGeo, glowMat);
      e.position.set(x, 5.4, 0.52);
      group.add(e);
    }
    if (kind === 1) {
      const gem = new Mesh(new SphereGeometry(0.28, 12, 8), glowMat);
      gem.position.set(0, 5.75, 0.5);
      group.add(gem);
      list.push(gem.geometry);
    }
    let halo: Mesh | null = null;
    if (kind === 2) {
      const tg = new TorusGeometry(1.25, 0.06, 8, 64);
      const tm = new MeshBasicMaterial({ color: col(p.color3 ?? "#ffd36b") });
      halo = new Mesh(tg, tm);
      halo.position.set(0, 6.0, -0.4);
      group.add(halo);
      list.push(tg, tm);
    }
    const [x, y, z] = p.pos ?? [0, -2.2, -26];
    group.position.set(x, y + 1.7 * (p.scale ?? 1), z);
    group.scale.setScalar(p.scale ?? 1);
    return { group, halo, list };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    built.group.rotation.y = Math.sin(clock.time * 0.15) * 0.08;
    if (built.halo) built.halo.rotation.z = clock.time * 0.2;
  });
  return <primitive object={built.group} />;
}

/* Ribbons: two streams of light, gold and rose, twisting round each other as they rise. */

const RIBBON_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime, uGrow, uComet;
void main() {
  float t = vUv.x;
  float shown = smoothstep(uGrow, uGrow - 0.03, t);
  float flow = 0.55 + 0.45 * sin(t * 40.0 - uTime * 4.0);
  float head = exp(-abs(t - uGrow) * 40.0) * uComet * 3.0;
  float edge = 1.0 - abs(vUv.y - 0.5) * 2.0;
  gl_FragColor = vec4(uColor * (shown * flow * edge * 1.4 + head), 1.0);
}
`;

export function Ribbons({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const group = new Group();
    const list: Disposable[] = [];
    const mats: ShaderMaterial[] = [];
    [p.color, p.color2 ?? "#ff8fb0"].forEach((color, k) => {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const a = t * Math.PI * 6 + k * Math.PI;
        const r = 1.1 * (1 - t * 0.55);
        pts.push(new Vector3(Math.cos(a) * r, -3 + t * 12, Math.sin(a) * r - 4));
      }
      const curve = new CatmullRomCurve3(pts);
      const geo = new TubeGeometry(curve, 400, 0.07, 8, false);
      const mat = new ShaderMaterial({
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: RIBBON_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uColor: { value: col(color) },
          uTime: { value: 0 },
          uGrow: { value: 1 },
          uComet: { value: p.c ?? 0 },
        },
      });
      group.add(new Mesh(geo, mat));
      mats.push(mat);
      list.push(geo, mat);
    });
    const [x, y, z] = p.pos ?? [0, 0, 0];
    group.position.set(x, y, z);
    group.scale.setScalar(p.scale ?? 1);
    return { group, mats, list };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    const grow = p.drive ? 0.15 + smoothstep(0, 1, driven(p.drive, clock)) * 0.85 : 1;
    for (const m of built.mats) {
      m.uniforms.uTime!.value = clock.time;
      m.uniforms.uGrow!.value = Math.min(grow, 0.2 + clock.age * 0.25);
    }
    built.group.rotation.y = clock.time * 0.25;
  });
  return <primitive object={built.group} />;
}

/* Memories: pictures floating round her like open windows (the void, c48). */

export function Memories({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const stills = [
      "/img/hero-stills/guinevere-vexana-04.webp",
      "/img/hero-stills/guinevere-vexana-01.webp",
      "/img/hero-stills/guinevere-vexana-03.webp",
    ];
    const loader = new TextureLoader();
    const group = new Group();
    const list: Disposable[] = [];
    const textures: Texture[] = [];
    const frameMat = new MeshBasicMaterial({
      color: col(p.color),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const frameGeo = new PlaneGeometry(1, 1);
    list.push(frameMat, frameGeo);
    const places: [number, number, number, number][] = [
      [-4.2, 1.4, -6, 0.25],
      [4.0, 0.6, -8, -0.2],
      [-1.2, -1.6, -10, 0.1],
    ];
    stills.forEach((src, i) => {
      const tex = loader.load(asset(src));
      tex.colorSpace = SRGBColorSpace;
      textures.push(tex);
      const mat = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const pic = new Mesh(frameGeo, mat);
      const [x, y, z, r] = places[i]!;
      pic.scale.set(3.2, 1.35, 1);
      pic.position.set(x, y, z);
      pic.rotation.set(0, r, r * 0.2);
      const frame = new Mesh(frameGeo, frameMat);
      frame.scale.set(3.32, 1.47, 1);
      frame.position.set(x, y, z - 0.02);
      frame.rotation.copy(pic.rotation);
      group.add(frame, pic);
      list.push(mat);
    });
    for (const t of textures) list.push(t);
    return { group, list };
  }, [p]);
  useDisposables(built.list);
  useFrame(() => {
    built.group.position.y = Math.sin(clock.time * 0.3) * 0.2 - clock.chapter * 1.5;
    built.group.rotation.z = Math.sin(clock.time * 0.1) * 0.05;
  });
  return <primitive object={built.group} />;
}
