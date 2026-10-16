"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";

import { usePointer, useReducedMotion } from "@/lib/hooks";
import { damp } from "@/lib/math";

export interface PointerRigProps {
  /** How far the camera travels toward the pointer, in world units. Default 0.35. */
  strength?: number;
  /** Extra roll and yaw toward the pointer, in radians. Default 0.08. */
  rotate?: number;
  /** Response rate of the damping (higher is snappier). Default 4. */
  damping?: number;
  /** Point the camera keeps looking at. Default the origin. */
  lookAt?: [number, number, number];
  /** Blend in device tilt on phones (see requestTiltPermission). Default false. */
  tilt?: boolean;
}

/**
 * Camera rig for <GLStage> scenes: the default camera drifts toward the smoothed pointer
 * (mouse, touch drag or device tilt) with frame-rate independent damping, and keeps looking
 * at `lookAt`. Still under reduced motion. Place it anywhere inside the scene.
 */
export function PointerRig({
  strength = 0.35,
  rotate = 0.08,
  damping = 4,
  lookAt = [0, 0, 0],
  tilt = false,
}: PointerRigProps) {
  const { ref: pointer } = usePointer({ tilt });
  const reduced = useReducedMotion();
  const base = useRef<Vector3 | null>(null);
  const target = useRef(new Vector3());
  const roll = useRef(0);
  const [lx, ly, lz] = lookAt;

  useFrame((state, delta) => {
    const camera = state.camera;
    base.current ??= camera.position.clone();
    const origin = base.current;
    const p = pointer.current;
    const tx = reduced ? 0 : p.x * strength;
    const ty = reduced ? 0 : -p.y * strength;
    const dt = Math.min(delta, 0.1);
    camera.position.x = damp(camera.position.x, origin.x + tx, damping, dt);
    camera.position.y = damp(camera.position.y, origin.y + ty, damping, dt);
    target.current.set(lx, ly, lz);
    camera.lookAt(target.current);
    roll.current = damp(roll.current, reduced ? 0 : -p.x * rotate, damping, dt);
    camera.rotateZ(roll.current);
  });

  return null;
}
