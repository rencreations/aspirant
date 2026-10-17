"use client";

import { lazy, Suspense, useMemo, useState, type ComponentType } from "react";

import type { SetPieceProps } from "@/features/experience/contract";
import { SET_PIECE_ANCHORS, setPieceRegistry } from "@/features/experience/scenes/setpieces";

/** Dev gallery: every registered set piece, in reading order, in a reader-like column. */
export function PiecesGallery() {
  const [theme, setTheme] = useState<"storm" | "daybreak">("storm");
  const [reduced, setReduced] = useState(false);
  const only =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("piece");
  const pieces = useMemo(
    () =>
      SET_PIECE_ANCHORS.filter((a) => setPieceRegistry[a.id] && (!only || a.id === only)).map(
        (a) => ({
          anchor: a,
          Comp: lazy(setPieceRegistry[a.id]!) as ComponentType<SetPieceProps>,
        }),
      ),
    [only],
  );
  return (
    <div
      data-theme={theme}
      style={{ background: "var(--bg)", minHeight: "100vh", paddingBlock: "8vh" }}
    >
      <h1 className="sr-only">Set pieces</h1>
      <div style={{ position: "fixed", right: 8, bottom: 8, zIndex: 60, display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => setTheme((t) => (t === "storm" ? "daybreak" : "storm"))}
        >
          theme {theme}
        </button>
        <button type="button" onClick={() => setReduced((r) => !r)}>
          reduced {String(reduced)}
        </button>
      </div>
      <div className="shell">
        <div style={{ maxWidth: "var(--measure)", marginInline: "auto" }}>
          {pieces.map(({ anchor, Comp }) => (
            <section key={anchor.id} data-piece-section={anchor.id}>
              <p className="text-text-dim">
                {anchor.chapterId} after {anchor.after}
              </p>
              <Suspense fallback={<p>loading {anchor.id}</p>}>
                <Comp active reduced={reduced} chapterId={anchor.chapterId} />
              </Suspense>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
