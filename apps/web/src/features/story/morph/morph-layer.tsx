"use client";

/**
 * The place of the chapter morph in the root layout: nothing at all until a morph runs (its code
 * is fetched by the card at the foot of a chapter, ahead of time), then the layer that draws it.
 */
import { lazy, Suspense } from "react";

import { loadOverlay, useMorph } from "./morph-store";

const Overlay = lazy(loadOverlay);

export function MorphLayer() {
  const job = useMorph((st) => st.job);
  if (!job) return null;
  return (
    <Suspense fallback={null}>
      <Overlay key={job.id} job={job} />
    </Suspense>
  );
}
