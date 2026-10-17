"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
} from "three";

import { smoothstep } from "@/lib/math";

import { col, driven, useClock, useLatest } from "../context";
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

/* Board: Obsidia's game of war, one white pawn a little ahead of the rest. */

const BOARD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uDark, uLight, uLine;
uniform float uTime;
void main() {
  vec2 g = vUv * 8.0;
  vec2 cell = floor(g);
  float checker = mod(cell.x + cell.y, 2.0);
  vec3 c = mix(uDark, uLight, checker);
  vec2 f = abs(fract(g) - 0.5);
  float line = smoothstep(0.49, 0.5, max(f.x, f.y));
  c += uLine * line * 0.6;
  float fade = smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
  gl_FragColor = vec4(c * fade, 1.0);
}
`;
const UV_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export function Board({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const group = new Group();
    const plane = new PlaneGeometry(9, 9);
    const mat = new ShaderMaterial({
      vertexShader: UV_VERT,
      fragmentShader: BOARD_FRAG,
      uniforms: {
        uDark: { value: col(p.color) },
        uLight: { value: col(p.color2 ?? "#1c1830") },
        uLine: { value: col(p.color3 ?? "#5b4a8a") },
        uTime: { value: 0 },
      },
    });
    const board = new Mesh(plane, mat);
    board.rotation.x = -Math.PI / 2;
    board.position.set(0, -1.7, -3.5);
    group.add(board);
    const profile = [
      [0, 0],
      [0.3, 0],
      [0.3, 0.07],
      [0.2, 0.13],
      [0.12, 0.46],
      [0.22, 0.52],
      [0.09, 0.57],
      [0.16, 0.7],
      [0.12, 0.8],
      [0, 0.84],
    ].map(([x, y]) => new Vector2(x, y));
    const lathe = new LatheGeometry(profile, 24);
    const darkMat = new MeshBasicMaterial({ color: col("#0c0b14"), fog: true });
    const whiteMat = new MeshBasicMaterial({ color: col("#f2efe8"), fog: false });
    const pawns = new InstancedMesh(lathe, darkMat, 15);
    const m = new Matrix4();
    let n = 0;
    const square = 9 / 8;
    for (let i = 0; i < 8; i++) {
      if (i === 4) continue;
      m.makeScale(0.75, 0.75, 0.75);
      m.setPosition(-4.5 + square * (i + 0.5), -1.7, -3.5 + 4.5 - square * 1.5);
      pawns.setMatrixAt(n++, m);
    }
    // Back rank shapes, taller and dim.
    for (let i = 0; i < 8; i++) {
      m.makeScale(0.9, 1.3 + (i % 3) * 0.15, 0.9);
      m.setPosition(-4.5 + square * (i + 0.5), -1.7, -3.5 + 4.5 - square * 0.5);
      pawns.setMatrixAt(n++, m);
    }
    pawns.count = n;
    group.add(pawns);
    const white = new Mesh(lathe, whiteMat);
    white.scale.setScalar(0.75);
    white.position.set(-4.5 + square * 4.5, -1.7, -3.5 + 4.5 - square * 2.5);
    group.add(white);
    return { group, white, list: [plane, mat, lathe, darkMat, whiteMat] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  const liveRef = useLatest(built);
  useFrame(() => {
    // The pawn turns a quarter toward the lit squares, slowly.
    liveRef.current.white.rotation.y =
      Math.sin(clock.time * 0.2) * 0.3 + smoothstep(0, 1, clock.chapter) * 1.57;
  });
  return <primitive object={built.group} />;
}

/* Portal: a disc of light hanging like a mirror (the Aperture), or a black gate. */

const PORTAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uRim, uInner;
uniform float uTime, uBright, uOpen, uBeat;
${NOISE}
void main() {
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0;
  float a = atan(q.y, q.x);
  float swirl = fbm(vec2(a * 2.0 + uTime * 0.3 - r * 3.0, r * 4.0 - uTime * 0.4));
  float open = uOpen;
  float inside = smoothstep(open, open - 0.02, r);
  float rim = exp(-abs(r - open) * 40.0) * 1.6 + exp(-abs(r - open) * 8.0) * 0.4;
  vec3 c = uInner * inside * (0.25 + swirl * 0.9) * uBright;
  c += uRim * rim * (0.8 + 0.2 * sin(uTime * 3.0 + a * 5.0)) * (1.0 + uBeat);
  float star = step(0.995, hash21(floor(q * 260.0))) * inside * (1.0 - uBright);
  c += vec3(0.8, 0.85, 1.0) * star;
  float alpha = max(inside * mix(0.96, 0.6, uBright), clamp(rim, 0.0, 1.0));
  gl_FragColor = vec4(c, alpha);
}
`;

export function Portal({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const radius = p.a ?? 2.5;
    const geo = new PlaneGeometry(radius * 2.4, radius * 2.4);
    const mat = new ShaderMaterial({
      vertexShader: UV_VERT,
      fragmentShader: PORTAL_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        uRim: { value: col(p.color) },
        uInner: { value: col(p.color2 ?? p.color) },
        uTime: { value: 0 },
        uBright: { value: p.b ?? 1 },
        uOpen: { value: 0.8 },
        uBeat: { value: 0 },
      },
    });
    const mesh = new Mesh(geo, mat);
    const [x, y, z] = p.pos ?? [0, 0.5, -6];
    mesh.position.set(x, y, z);
    return { mesh, mat, list: [geo, mat] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  const liveRef = useLatest(built);
  useFrame(() => {
    const u = liveRef.current.mat.uniforms;
    u.uTime!.value = clock.time;
    const open = p.drive ? smoothstep(0, 0.6, driven(p.drive, clock)) : 1;
    u.uOpen!.value = 0.8 * Math.max(0.02, open) * Math.min(1, clock.age / 1.5 + 0.2);
    u.uBeat!.value = clock.beat;
  });
  return <primitive object={built.mesh} />;
}

/* Ticks: a ring of forty marks, one for each of the forty days. */

export function Ticks({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const n = 40;
    const radius = p.a ?? 3;
    const geo = new PlaneGeometry(0.06, 0.5);
    const lit = new MeshBasicMaterial({
      color: col(p.color),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const dim = new MeshBasicMaterial({
      color: col(p.color2 ?? "#2a3550"),
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const group = new Group();
    const marks: Mesh[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 - (i / n) * Math.PI * 2;
      const m = new Mesh(geo, dim);
      m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      m.rotation.z = a - Math.PI / 2;
      const long = i % 5 === 0 ? 1.5 : 1;
      m.scale.set(1, long, 1);
      group.add(m);
      marks.push(m);
    }
    const [x, y, z] = p.pos ?? [0, 0.6, -5];
    group.position.set(x, y, z);
    return { group, marks, lit, dim, list: [geo, lit, dim] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  const liveRef = useLatest(built);
  useFrame(() => {
    const count = Math.round(smoothstep(0, 0.9, driven(p.drive ?? "chapter", clock)) * 40);
    liveRef.current.marks.forEach((m, i) => {
      m.material = i < count ? liveRef.current.lit : liveRef.current.dim;
    });
    liveRef.current.group.rotation.z = Math.sin(clock.time * 0.1) * 0.03;
  });
  return <primitive object={built.group} />;
}

/* Orb: the Twilight Orb that breaks, or the Core, a crystal ball of white and violet threads. */

const ORB_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const ORB_FRAG = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
uniform vec3 uColor, uColor2;
uniform float uTime, uCrack, uBeat;
${NOISE}
void main() {
  float fres = pow(1.0 - max(0.0, dot(vN, vV)), 2.0);
  vec3 n = normalize(vP);
  vec2 sp = vec2(atan(n.z, n.x) * 2.0, n.y * 3.0);
  float swirl = fbm(sp * 1.5 + vec2(uTime * 0.15, -uTime * 0.1));
  // Cracks: thin bright seams on the cellular edges of a noise field.
  float cn = abs(fbm(sp * 3.0 + 4.0) - 0.5);
  float crack = smoothstep(0.03 * uCrack, 0.0, cn) * uCrack;
  vec3 c = uColor2 * (0.25 + swirl * 0.6) + uColor * fres * 1.4;
  c += uColor * crack * 4.0;
  float pulse = 0.85 + 0.15 * sin(uTime * 1.6) + uBeat * 0.5;
  gl_FragColor = vec4(c * pulse, 1.0);
}
`;

export function Orb({ p }: { p: ShapeParams }) {
  const clock = useClock();
  const built = useMemo(() => {
    const geo = new SphereGeometry(p.scale ?? 1.4, 64, 48);
    const mat = new ShaderMaterial({
      vertexShader: ORB_VERT,
      fragmentShader: ORB_FRAG,
      uniforms: {
        uColor: { value: col(p.color) },
        uColor2: { value: col(p.color2 ?? "#1a1030") },
        uTime: { value: 0 },
        uCrack: { value: 0 },
        uBeat: { value: 0 },
      },
    });
    const mesh = new Mesh(geo, mat);
    const [x, y, z] = p.pos ?? [0, 0.6, -4];
    mesh.position.set(x, y, z);
    // A halo disc behind the orb.
    const hg = new CircleGeometry((p.scale ?? 1.4) * 3.2, 48);
    const hm = new ShaderMaterial({
      vertexShader: UV_VERT,
      fragmentShader: /* glsl */ `
        precision highp float; varying vec2 vUv; uniform vec3 uColor; uniform float uK;
        void main() { float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(uColor * exp(-r * 4.0) * uK, 1.0); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uColor: { value: col(p.color) }, uK: { value: 0.6 } },
    });
    const halo = new Mesh(hg, hm);
    halo.position.set(x, y, z - 0.5);
    const group = new Group();
    group.add(halo, mesh);
    return { group, mesh, mat, hm, list: [geo, mat, hg, hm] as Disposable[] };
  }, [p]);
  useDisposables(built.list);
  const liveRef = useLatest(built);
  useFrame(() => {
    const u = liveRef.current.mat.uniforms;
    u.uTime!.value = clock.time;
    u.uCrack!.value = p.drive ? driven(p.drive, clock) * (p.a ?? 1) : (p.a ?? 0);
    u.uBeat!.value = clock.beat;
    liveRef.current.mesh.rotation.y = clock.time * 0.12;
    liveRef.current.hm.uniforms.uK!.value =
      0.5 + (u.uCrack!.value as number) * 0.6 + clock.beat * 0.4;
  });
  return <primitive object={built.group} />;
}
