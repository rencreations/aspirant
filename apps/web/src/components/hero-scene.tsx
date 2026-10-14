"use client";

import { Float, Icosahedron, MeshDistortMaterial } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useRef } from "react";
import type { Mesh } from "three";

function Orb({ animate }: { animate: boolean }) {
  const ref = useRef<Mesh>(null);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh || !animate) return;
    mesh.rotation.y += delta * 0.25;
    mesh.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    // Parallax toward the pointer.
    mesh.position.x += (state.pointer.x * 0.6 - mesh.position.x) * 0.05;
    mesh.position.y += (state.pointer.y * 0.4 - mesh.position.y) * 0.05;
  });

  return (
    <Float speed={animate ? 1.5 : 0} rotationIntensity={0.4} floatIntensity={0.8}>
      <Icosahedron ref={ref} args={[1.6, 24]}>
        <MeshDistortMaterial
          color="#7c5cff"
          roughness={0.2}
          metalness={0.6}
          distort={animate ? 0.35 : 0.1}
          speed={animate ? 1.6 : 0}
        />
      </Icosahedron>
    </Float>
  );
}

export default function HeroScene({ animate = true }: { animate?: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 4, 4]} intensity={2.2} />
      <pointLight position={[-4, -2, -3]} intensity={30} color="#22d3ee" />
      <Orb animate={animate} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.6} luminanceThreshold={0.4} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.7} blendFunction={BlendFunction.NORMAL} />
      </EffectComposer>
    </Canvas>
  );
}
