"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useState } from "react";
import { Vector2 } from "three";

import { useDeviceTier } from "@/lib/device";
import { useReducedMotion } from "@/lib/hooks";

/** @public */
export interface BloomOptions {
  /** Default 0.9. */
  intensity?: number;
  /** Luminance threshold, 0 to 1. Default 0.6. */
  threshold?: number;
  /** Mipmap blur radius, 0 to 1. Default 0.7. */
  radius?: number;
}

export interface PostFXProps {
  /** Bloom on (default) or off, or tuned. */
  bloom?: boolean | BloomOptions;
  /** Chromatic aberration off (default), on, or an offset in UV units (about 0.0015). */
  chromatic?: boolean | number;
  /** Force the whole stack off. Default true (on). */
  enabled?: boolean;
}

/**
 * The site's post-processing preset for <GLStage> scenes: mipmap bloom plus optional
 * chromatic aberration. Switches itself off on "low" tier devices, under reduced motion, and
 * when the frame rate stays low (drei PerformanceMonitor).
 *
 * <PostFX bloom={{ intensity: 1.2 }} chromatic={0.0012} />
 */
export function PostFX({ bloom = true, chromatic = false, enabled = true }: PostFXProps) {
  const tier = useDeviceTier();
  const reduced = useReducedMotion();
  const [struggling, setStruggling] = useState(false);
  const offset = typeof chromatic === "number" ? chromatic : 0.0015;
  const caOffset = useMemo(() => new Vector2(offset, offset * 0.6), [offset]);
  const bloomOptions: BloomOptions = typeof bloom === "object" ? bloom : {};
  const active = enabled && tier !== "low" && !reduced && !struggling;

  return (
    <>
      <PerformanceMonitor
        flipflops={3}
        onChange={({ factor }) => {
          // Factor starts at 0.5 and drops 0.1 per sustained decline.
          if (factor < 0.2) setStruggling(true);
        }}
        onFallback={() => setStruggling(true)}
      />
      {active && (bloom !== false || chromatic !== false) ? (
        <EffectComposer multisampling={0}>
          <>
            {bloom !== false && (
              <Bloom
                mipmapBlur
                intensity={bloomOptions.intensity ?? 0.9}
                luminanceThreshold={bloomOptions.threshold ?? 0.6}
                luminanceSmoothing={0.2}
                radius={bloomOptions.radius ?? 0.7}
              />
            )}
            {chromatic !== false && (
              <ChromaticAberration
                offset={caOffset}
                radialModulation={false}
                modulationOffset={0}
              />
            )}
          </>
        </EffectComposer>
      ) : null}
    </>
  );
}
