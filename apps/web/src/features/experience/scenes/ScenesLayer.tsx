"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

import { hasWebGL } from "@/components/gl/use-gl-ready";
import { asset } from "@/lib/asset";
import { guessDeviceTier, useDeviceTier } from "@/lib/device";
import { useMounted, usePageVisible, useReducedMotion, useViewport } from "@/lib/hooks";

import type { Mood } from "../contract";
import { driver, onSceneChange, syncDriver } from "./driver";
import { LETTERBOXED_STILLS } from "./parts";
import styles from "./scenes.module.css";
import { ThemeScrim } from "./ThemeScrim";
import { useSceneAudio } from "./useSceneAudio";

const SceneCanvas = dynamic(() => import("./canvas/SceneCanvas"), { ssr: false });

export interface ScenesLayerProps {
  /**
   * Width of the text column the backdrop keeps legible (CSS length). Default "46rem".
   * The veil is centred on the viewport.
   */
  column?: string;
}

interface Look {
  still: string;
  mood: Mood;
  active: boolean;
}

function readLook(): Look {
  return { still: driver.still, mood: driver.mood, active: driver.part !== null };
}

let lookCache: Look = readLook();
function subscribeLook(onChange: () => void) {
  return onSceneChange(() => {
    const next = readLook();
    if (
      next.still !== lookCache.still ||
      next.mood !== lookCache.mood ||
      next.active !== lookCache.active
    ) {
      lookCache = next;
      onChange();
    }
  });
}
const getLook = () => lookCache;

/** Two stacked stills so a change of art crossfades instead of cutting. */
function StillBackdrop({ still, mood, drift }: { still: string; mood: Mood; drift: boolean }) {
  const [layers, setLayers] = useState<{ a: string; b: string | null; front: "a" | "b" }>({
    a: still,
    b: null,
    front: "a",
  });
  // Adjust state while rendering when the still changes (no effect needed).
  const current = layers.front === "a" ? layers.a : layers.b;
  if (current !== still) {
    setLayers(
      layers.front === "a"
        ? { ...layers, b: still, front: "b" }
        : { ...layers, a: still, front: "a" },
    );
  }

  const render = (src: string | null, on: boolean) =>
    src ? (
      <div
        className={styles.still}
        data-on={on ? "" : undefined}
        data-letterbox={LETTERBOXED_STILLS.has(src) ? "" : undefined}
        data-drift={drift ? "" : undefined}
      >
        {/* Decorative backdrop: the story text carries the content. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(src)} alt="" decoding="async" />
      </div>
    ) : null;

  return (
    <div className={styles.stills}>
      {render(layers.a, layers.front === "a")}
      {render(layers.b, layers.front === "b")}
      <div className={styles.wash} data-mood={mood} />
    </div>
  );
}

/**
 * The fixed, full-bleed scene layer behind the Experience text. Mount it once inside <main>
 * on /experience (not inside an element with its own background). It reads `useExperience`
 * and shows the scene, mood and sound for the active Part, chapter and paragraph.
 *
 * Modes: a live WebGL scene; or still art with a slow drift (Calm: reduced motion or a weak
 * device; also the fallback when WebGL is missing or fails). A veil behind the text column
 * keeps body text at 7:1 in both themes.
 */
export default function ScenesLayer({ column }: ScenesLayerProps) {
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const tier = useDeviceTier();
  const visible = usePageVisible();
  const viewport = useViewport();
  const look = useSyncExternalStore(subscribeLook, getLook, getLook);
  const [glFailed, setGlFailed] = useState(false);
  const [glReady, setGlReady] = useState(false);

  useEffect(() => syncDriver(), []);
  useSceneAudio();

  // Calm on reduced motion or weak hardware. The FPS probe can dip during first load, so it
  // only lowers quality; it never switches the scene off.
  const calm = reduced || (mounted && guessDeviceTier() === "low");
  const live = mounted && !calm && !glFailed && hasWebGL();
  const quality = tier !== "low" && viewport.w >= 900 ? 1 : 0.6;

  useEffect(() => {
    if (!live) return;
    const id = window.setTimeout(() => setGlReady(true), 250);
    return () => window.clearTimeout(id);
  }, [live]);

  const style = column ? ({ "--scene-column": column } as CSSProperties) : undefined;

  return (
    <div className={styles.layer} style={style} data-scenes-layer="" data-overlay="" aria-hidden>
      <StillBackdrop still={look.still} mood={look.mood} drift={calm && !reduced} />
      {live ? (
        <div className={styles.canvas} data-on={glReady && live ? "" : undefined}>
          <SceneCanvas
            running={look.active && visible}
            quality={quality}
            onFail={() => setGlFailed(true)}
          />
        </div>
      ) : null}
      <ThemeScrim strong={!live} />
    </div>
  );
}
