"use client";

import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  Box3,
  Color,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";

type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

import GLStage from "@/components/gl/gl-stage";
import { asset } from "@/lib/asset";
import { audio } from "@/lib/audio";
import { useReducedMotion } from "@/lib/hooks";

import type { ModelInfo } from "./media-section";
import styles from "./model-viewer.module.css";

type Exhibit = "character" | "weapon" | "robot";

/** Node names in the GLB (see docs/design/assets.md, Models). */
const NODES: Record<Exhibit, readonly string[]> = {
  character: ["body", "face", "hair_eyes"],
  weapon: ["weapon"],
  robot: ["robot", "robot_screen"],
};

/** World height each exhibit is scaled to on the pedestal. */
const FIT: Record<Exhibit, number> = { character: 2, weapon: 2.1, robot: 1.15 };

const DRACO = "/vendor/draco/";

/**
 * The robot's face texture is a 3 by 3 atlas of expressions; the screen's UVs cover the top
 * middle cell, so a face is chosen by shifting the texture offset. Labels are our own.
 */
interface Face {
  readonly c: number;
  readonly r: number;
  readonly label: string;
}

const FACES: readonly Face[] = [
  { c: 1, r: 0, label: "Wide eyes" },
  { c: 2, r: 0, label: "Squeezed eyes" },
  { c: 0, r: 1, label: "Smiling eyes" },
  { c: 1, r: 1, label: "Crossed eyes" },
  { c: 2, r: 1, label: "Pulse readout" },
  { c: 0, r: 2, label: "Signal readout" },
  { c: 1, r: 2, label: "Resting eyes" },
  { c: 2, r: 2, label: "Sharp eyes" },
];

/** The cell the screen's UVs point at when the offset is zero. */
const BASE_CELL = { c: 1, r: 0 };
const KEY_STEP = Math.PI / 12;

interface Colours {
  lead: string;
  second: string;
  glow: string;
}

interface ViewerProps {
  model: ModelInfo;
  colours: Colours;
}

/**
 * The 3D viewer for Layla and Fanny: the GLB on a lit pedestal with orbit controls (drag,
 * touch, the arrow keys, plus and minus), auto-rotation when idle, and three exhibits
 * (character, weapon, robot companion). The robot's face screen shows the chosen emote.
 * Reduced motion: no auto-rotation and no idle drift. Resources are disposed on unmount.
 */
export default function ModelViewer({ model, colours }: ViewerProps) {
  const [exhibit, setExhibit] = useState<Exhibit>("character");
  const [face, setFace] = useState(0);
  const reduced = useReducedMotion();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const keyTarget = useRef<{ az: number; pol: number } | null>(null);
  const hintId = useId();
  const alive = useRef(false);
  const modelUrl = asset(model.src);

  // Drop the parsed model from the loader cache once the viewer is really gone (the timeout
  // lets a development double mount pass without a reload).
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.setTimeout(() => {
        if (!alive.current) useGLTF.clear(modelUrl);
      }, 0);
    };
  }, [modelUrl]);

  const labels: Record<Exhibit, string> = {
    character: model.name,
    weapon: model.weapon,
    robot: "Robot companion",
  };

  const choose = (next: Exhibit) => {
    audio.blip("click");
    setExhibit(next);
    controls.current?.reset();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const c = controls.current;
    if (!c) return;
    const base = keyTarget.current ?? { az: c.getAzimuthalAngle(), pol: c.getPolarAngle() };
    let handled = true;
    if (e.key === "ArrowLeft") base.az -= KEY_STEP;
    else if (e.key === "ArrowRight") base.az += KEY_STEP;
    else if (e.key === "ArrowUp") base.pol = Math.max(0.5, base.pol - KEY_STEP / 2);
    else if (e.key === "ArrowDown") base.pol = Math.min(1.9, base.pol + KEY_STEP / 2);
    else if (e.key === "+" || e.key === "=") c.dollyIn(1.15);
    else if (e.key === "-" || e.key === "_") c.dollyOut(1.15);
    else if (e.key === "0" || e.key === "Home") {
      c.reset();
      keyTarget.current = null;
      e.preventDefault();
      return;
    } else handled = false;
    if (!handled) return;
    e.preventDefault();
    keyTarget.current = base;
    c.update();
  };

  const fallback = (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.fallback} src={asset(model.fallback)} alt="" />
  );

  return (
    <div className={styles.viewer}>
      <div
        className={styles.stage}
        tabIndex={0}
        role="application"
        aria-roledescription="3D viewer"
        aria-label={`3D model: ${labels[exhibit]}`}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        data-cursor="DRAG"
      >
        <GLStage camera={{ position: [0, 0.35, 6.2], fov: 28 }} fallback={fallback}>
          <Suspense fallback={null}>
            <Scene
              src={modelUrl}
              exhibit={exhibit}
              atlas={model.screen ? asset(model.screen) : null}
              face={FACES[face] ?? FACES[0]}
              reduced={reduced}
              colours={colours}
              controlsRef={controls}
              keyTarget={keyTarget}
            />
          </Suspense>
        </GLStage>
        <span className={styles.hudTop} aria-hidden="true">
          <span>Model / {model.src.split("/").pop()}</span>
          <span>{labels[exhibit]}</span>
        </span>
        <span className={styles.corner} data-pos="tl" aria-hidden="true" />
        <span className={styles.corner} data-pos="tr" aria-hidden="true" />
        <span className={styles.corner} data-pos="bl" aria-hidden="true" />
        <span className={styles.corner} data-pos="br" aria-hidden="true" />
      </div>

      <div className={styles.panel}>
        <p id={hintId} className={styles.hint}>
          Drag to turn the model, pinch or scroll to zoom. With the keyboard: arrow keys turn it,
          plus and minus zoom, 0 resets.
        </p>
        <div role="group" aria-label="Exhibit" className={styles.exhibits}>
          {(Object.keys(NODES) as Exhibit[]).map((key, i) => (
            <button
              key={key}
              type="button"
              className={styles.exhibit}
              aria-pressed={exhibit === key}
              onClick={() => choose(key)}
            >
              <span className={styles.exhibitCode} aria-hidden="true">
                0{i + 1}
              </span>
              {key === "character" ? model.name : key === "weapon" ? "Weapon" : "Robot"}
            </button>
          ))}
        </div>
        {model.screen && (
          <div className={styles.emotes}>
            <p className="hud-label">Robot face screen</p>
            <div role="group" aria-label="Robot face" className={styles.emoteGrid}>
              {FACES.map((f, i) => (
                <button
                  key={f.label}
                  type="button"
                  className={styles.emote}
                  aria-pressed={face === i}
                  aria-label={f.label}
                  title={f.label}
                  onClick={() => {
                    audio.blip("star");
                    setFace(i);
                    if (exhibit !== "robot") choose("robot");
                  }}
                >
                  <span
                    className={styles.emoteCell}
                    aria-hidden="true"
                    style={{
                      backgroundImage: `url(${asset(model.screen ?? "")})`,
                      backgroundPosition: `${f.c * 50}% ${f.r * 50}%`,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SceneProps {
  src: string;
  exhibit: Exhibit;
  atlas: string | null;
  face: Face;
  reduced: boolean;
  colours: Colours;
  controlsRef: RefObject<OrbitControlsImpl | null>;
  keyTarget: RefObject<{ az: number; pol: number } | null>;
}

function Scene({
  src,
  exhibit,
  atlas,
  face,
  reduced,
  colours,
  controlsRef,
  keyTarget,
}: SceneProps) {
  const gltf = useGLTF(src, asset(DRACO), false);
  const rig = useRef<Group>(null);
  const turntable = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [interacting, setInteracting] = useState(false);
  const idleSince = useRef(0);

  const nodes = useMemo(() => {
    const map = new Map<string, Object3D>();
    gltf.scene.traverse((o) => {
      if (o.name) map.set(o.name, o);
    });
    return map;
  }, [gltf]);

  // Bounds of each exhibit, measured once.
  const frames = useMemo(() => {
    const out = {} as Record<Exhibit, { center: Vector3; scale: number }>;
    for (const key of Object.keys(NODES) as Exhibit[]) {
      const box = new Box3();
      for (const name of NODES[key]) {
        const node = nodes.get(name);
        if (node) box.expandByObject(node);
      }
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const tall = key === "character" ? size.y : Math.max(size.x, size.y, size.z);
      out[key] = { center, scale: tall > 0 ? FIT[key] / tall : 1 };
    }
    return out;
  }, [nodes]);

  // Show only the chosen exhibit.
  useEffect(() => {
    for (const [key, names] of Object.entries(NODES) as Array<[Exhibit, readonly string[]]>) {
      for (const name of names) {
        const node = nodes.get(name);
        if (node) node.visible = key === exhibit;
      }
    }
    invalidate();
  }, [exhibit, nodes, invalidate]);

  // Matte materials read a little flat under studio light: lift them gently.
  useEffect(() => {
    gltf.scene.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      const mat = mesh.material as MeshStandardMaterial;
      if (mat && "roughness" in mat) {
        mat.roughness = 0.62;
        mat.metalness = 0.04;
        mat.envMapIntensity = 0.8;
      }
    });
  }, [gltf]);

  // The robot's face screen: the expression atlas, lit from within, glTF conventions
  // (flipY off, sRGB) and repeat wrapping, because the screen's UVs sit at v = 4.
  const [screenTex, setScreenTex] = useState<Texture | null>(null);
  useEffect(() => {
    const screen = nodes.get("robot_screen") as Mesh | undefined;
    const mat = screen?.material as MeshStandardMaterial | undefined;
    if (!mat || !atlas) return;
    let alive = true;
    let tex: Texture | null = null;
    new TextureLoader().load(atlas, (t) => {
      if (!alive) {
        t.dispose();
        return;
      }
      t.flipY = false;
      t.colorSpace = SRGBColorSpace;
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      tex = t;
      mat.map = t;
      mat.emissive = new Color("#ffffff");
      mat.emissiveMap = t;
      mat.emissiveIntensity = 0.9;
      mat.needsUpdate = true;
      setScreenTex(t);
    });
    return () => {
      alive = false;
      tex?.dispose();
    };
  }, [atlas, nodes]);

  useEffect(() => {
    if (!screenTex) return;
    screenTex.offset.set((face.c - BASE_CELL.c) / 3, (face.r - BASE_CELL.r) / 3);
    invalidate();
  }, [face, screenTex, invalidate]);

  // Dispose the model when the viewer unmounts.
  useEffect(() => {
    const scene = gltf.scene;
    return () => {
      scene.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
        for (const m of mats) {
          for (const value of Object.values(m)) {
            if (value && typeof value === "object" && (value as Texture).isTexture)
              (value as Texture).dispose();
          }
          m.dispose();
        }
      });
    };
  }, [gltf]);

  const target = useRef({ x: 0, y: 0, z: 0, s: 1 });
  useFrame((state, dt) => {
    const g = rig.current;
    const t = turntable.current;
    if (!g || !t) return;
    const f = frames[exhibit];
    const goal = target.current;
    goal.s = f.scale;
    goal.x = -f.center.x * f.scale;
    goal.y = -f.center.y * f.scale;
    goal.z = -f.center.z * f.scale;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    g.scale.setScalar(g.scale.x + (goal.s - g.scale.x) * k);
    g.position.x += (goal.x - g.position.x) * k;
    g.position.y += (goal.y - g.position.y) * k;
    g.position.z += (goal.z - g.position.z) * k;
    // Idle breathing: a slow float.
    t.position.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.9) * 0.025;

    const c = controlsRef.current;
    const kt = keyTarget.current;
    if (c && kt) {
      const az = c.getAzimuthalAngle();
      const pol = c.getPolarAngle();
      const step = reduced ? 1 : 1 - Math.exp(-dt * 10);
      c.setAzimuthalAngle(az + (kt.az - az) * step);
      c.setPolarAngle(pol + (kt.pol - pol) * step);
      if (Math.abs(kt.az - az) < 0.002 && Math.abs(kt.pol - pol) < 0.002) keyTarget.current = null;
    }
    if (idleSince.current < 0) idleSince.current = state.clock.elapsedTime;
    if (c) {
      const idle = !interacting && state.clock.elapsedTime - idleSince.current > 2.5;
      c.autoRotate = !reduced && idle && keyTarget.current === null;
    }
  });

  return (
    <>
      <hemisphereLight args={["#ffffff", colours.second, 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.5, 4, 3.5]} intensity={2.2} color="#fff6ec" />
      <directionalLight position={[-3, 2, -3]} intensity={2.4} color={colours.glow} />
      <pointLight position={[0, -0.6, 2]} intensity={1.4} color={colours.lead} distance={6} />

      <group ref={turntable}>
        <group ref={rig}>
          <primitive object={gltf.scene} dispose={null} />
        </group>
      </group>

      <Pedestal colours={colours} reduced={reduced} />
      <ContactShadows
        position={[0, -1.02, 0]}
        opacity={0.5}
        scale={4.5}
        blur={2.4}
        far={2.5}
        frames={reduced ? 1 : Infinity}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.4}
        maxDistance={9}
        minPolarAngle={0.5}
        maxPolarAngle={1.9}
        autoRotateSpeed={0.9}
        target={[0, 0, 0]}
        onStart={() => {
          setInteracting(true);
          keyTarget.current = null;
        }}
        onEnd={() => {
          setInteracting(false);
          // Stamped with the scene clock on the next frame.
          idleSince.current = -1;
        }}
      />
    </>
  );
}

function Pedestal({ colours, reduced }: { colours: Colours; reduced: boolean }) {
  const ring = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ring.current && !reduced) ring.current.rotation.y += dt * 0.25;
  });
  return (
    <group position={[0, -1.04, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.25, 6]} />
        <meshStandardMaterial
          color="#0e141f"
          roughness={0.4}
          metalness={0.5}
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[1.22, 1.26, 6]} />
        <meshBasicMaterial color={colours.lead} toneMapped={false} />
      </mesh>
      <group ref={ring}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[1.42, 1.45, 64, 1, 0, Math.PI * 1.4]} />
          <meshBasicMaterial color={colours.glow} toneMapped={false} transparent opacity={0.8} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, Math.PI]} position={[0, 0.006, 0]}>
          <ringGeometry args={[1.42, 1.45, 64, 1, 0, Math.PI * 0.3]} />
          <meshBasicMaterial color={colours.second} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
