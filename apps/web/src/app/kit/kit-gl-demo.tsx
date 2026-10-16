"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

import { PointerRig } from "@/components/gl/pointer-rig";
import { PostFX } from "@/components/gl/post-fx";

function Crystal() {
  const ref = useRef<Mesh>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.4;
    ref.current.rotation.x += dt * 0.15;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.2, 0]} />
      <meshStandardMaterial
        color="#0e141f"
        emissive="#5ce1ff"
        emissiveIntensity={1.6}
        flatShading
        metalness={0.4}
        roughness={0.3}
      />
    </mesh>
  );
}

/** Demo scene for /kit: a resonance crystal with the pointer rig and the post preset. */
export default function KitGLDemo() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[3, 3, 4]} intensity={40} color="#ffcf5c" />
      <Crystal />
      <PointerRig strength={0.5} />
      <PostFX bloom={{ intensity: 1.2, threshold: 0.4 }} chromatic={0.0012} />
    </>
  );
}
