"use client";

import { createElement, lazy, Suspense, useEffect, useRef, useState } from "react";

import { HudPanel } from "@/components/ui/hud-panel";
import { useReducedMotion } from "@/lib/hooks";

import type { SetPieceAnchor } from "../contract";
import { setPieceRegistry } from "../scenes/setpieces";
import s from "./reader.module.css";

/** One lazy component per registered set piece, created once at module load. */
const PIECES = new Map(
  Object.entries(setPieceRegistry).map(([id, load]) => [id, lazy(load)] as const),
);

/**
 * Frames an inline set piece after its paragraph: a HUD panel with the caption, skip links
 * before and after for keyboard users, an `active` flag from an IntersectionObserver and the
 * reduced-motion flag. Renders nothing for ids the scene library does not register.
 */
export function SetPieceHost({ anchor }: { anchor: SetPieceAnchor }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const reduced = useReducedMotion();
  const known = PIECES.has(anchor.id);

  useEffect(() => {
    const el = ref.current;
    if (!el || !known) return;
    const io = new IntersectionObserver(
      (entries) => setActive(entries[entries.length - 1]?.isIntersecting ?? false),
      {
        rootMargin: "10% 0px",
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [known]);

  const Piece = PIECES.get(anchor.id);
  if (!Piece) return null;
  const before = `setpiece-${anchor.id}-before`;
  const after = `setpiece-${anchor.id}-after`;
  return (
    <div className={s.setPiece} data-setpiece={anchor.id}>
      <a id={before} href={`#${after}`} className={s.skipPiece}>
        Skip the scene: {anchor.caption}
      </a>
      <div ref={ref}>
        <HudPanel
          as="figure"
          label={anchor.caption}
          code="Interactive"
          tone="glass"
          scan={!reduced}
        >
          <div role="group" aria-label={anchor.label} className={s.setPieceStage}>
            <Suspense fallback={<p className={s.setPieceWait}>{anchor.caption}</p>}>
              {/* `Piece` comes from the module-level PIECES map, so its identity is stable. */}
              {createElement(Piece, { active, reduced, chapterId: anchor.chapterId })}
            </Suspense>
          </div>
        </HudPanel>
      </div>
      <a id={after} href={`#${before}`} className={s.skipPiece}>
        Back before the scene: {anchor.caption}
      </a>
    </div>
  );
}
