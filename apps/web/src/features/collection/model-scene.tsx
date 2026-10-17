"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentRef } from "react";
import type { Group, Mesh, Texture } from "three";

import { asset } from "@/lib/asset";
import { useReducedMotion } from "@/lib/hooks";

/** What the page can ask the viewer to do (buttons and keys). */
export interface ModelApi {
  rotate: (radians: number) => void;
  zoom: (factor: number) => void;
  reset: () => void;
}

interface ModelSceneProps {
  src: string;
  onReady: (api: ModelApi) => void;
  /** Called once the model has loaded and is on screen. */
  onLoaded: () => void;
}

const DECODER = () => asset("/draco/");
const HIDDEN = /weapon|robot/i;
const HOME = { x: 0, y: 0.1, z: 4.4 };

/**
 * The Layla or Fanny model: the character only (the weapon and the robot companion sit beside
 * her in model space, so they are hidden). Orbit with a pointer, a finger or the buttons; the
 * model turns slowly when idle. Everything it loads is disposed when it unmounts.
 */
export default function ModelScene({ src, onReady, onLoaded }: ModelSceneProps) {
  const url = asset(src);
  const gltf = useGLTF(url, DECODER());
  const group = useRef<Group>(null);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const idle = useRef({ timer: 0 });
  const reduced = useReducedMotion();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((node) => {
      if (HIDDEN.test(node.name)) node.visible = false;
    });
    return clone;
  }, [gltf.scene]);

  useEffect(() => {
    onReady({
      rotate: (radians) => {
        if (group.current) group.current.rotation.y += radians;
      },
      zoom: (factor) => {
        camera.position.multiplyScalar(factor);
        const d = camera.position.length();
        if (d < 2.4) camera.position.setLength(2.4);
        if (d > 8) camera.position.setLength(8);
        controls.current?.update();
      },
      reset: () => {
        camera.position.set(HOME.x, HOME.y, HOME.z);
        if (group.current) group.current.rotation.y = 0;
        controls.current?.update();
      },
    });
  }, [camera, onReady]);

  useEffect(() => {
    onLoaded();
  }, [onLoaded]);

  // Dispose what this viewer created when it closes.
  useEffect(() => {
    const canvas = gl.domElement;
    const auto = idle.current;
    return () => {
      window.clearTimeout(auto.timer);
      model.traverse((node) => {
        const mesh = node as Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          for (const value of Object.values(mat)) {
            if (value && (value as Texture).isTexture) (value as Texture).dispose();
          }
          mat.dispose();
        }
      });
      useGLTF.clear(url);
      canvas.style.touchAction = "";
    };
  }, [gl, model, url]);

  const stopAuto = () => {
    window.clearTimeout(idle.current.timer);
    if (controls.current) controls.current.autoRotate = false;
  };
  const startAuto = () => {
    window.clearTimeout(idle.current.timer);
    idle.current.timer = window.setTimeout(() => {
      if (controls.current && !reduced) controls.current.autoRotate = true;
    }, 2200);
  };

  return (
    <>
      <hemisphereLight args={["#dfe9ff", "#1b1630", 1.1]} />
      <directionalLight position={[3, 4, 5]} intensity={2.2} color="#fff4e0" />
      <directionalLight position={[-4, 1.5, -3]} intensity={1.1} color="#7fd8ff" />
      <group ref={group}>
        <primitive object={model} />
      </group>
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.4}
        maxDistance={8}
        minPolarAngle={0.5}
        maxPolarAngle={Math.PI - 0.7}
        autoRotate={!reduced}
        autoRotateSpeed={1.4}
        onStart={stopAuto}
        onEnd={startAuto}
      />
    </>
  );
}
