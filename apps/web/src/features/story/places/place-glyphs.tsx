import type { ReactNode } from "react";

/** Small line drawings for the places index (48 x 48, stroke only). */
const GLYPHS: Readonly<Record<string, ReactNode>> = {
  gantry: (
    <>
      <path d="M17 43V12h9v31" />
      <path d="M11 12h24M26 18l11-7M37 11v13" />
      <path d="M17 24h9M17 33h9" />
    </>
  ),
  "tanners-row": (
    <>
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={9 + c * 12} y={9 + r * 12} width="7" height="8" />
        )),
      )}
    </>
  ),
  "crown-heights": (
    <>
      <path d="M3 40c9-16 33-16 42 0" />
      <path d="M19 31v-8l6-5 6 5v8z" />
      <path d="M24 18v-6M21 14h6" />
    </>
  ),
  "harbour-front": (
    <>
      <path d="M3 36c4-4 8-4 12 0s8 4 12 0 8-4 12 0 4 2 6 0" />
      <path d="M8 28h32M12 28V16M36 28V16M10 16h6M32 16h6" />
    </>
  ),
  "bell-tower": (
    <>
      <path d="M17 43V17h14v26M17 17l7-10 7 10" />
      <path d="M20 28h8l-1 7h-6zM24 35v3" />
    </>
  ),
  underhill: (
    <>
      <path d="M8 43V25a16 16 0 0 1 32 0v18" />
      <path d="M16 43V27a8 8 0 0 1 16 0v16M3 43h42" />
    </>
  ),
  valemont: (
    <>
      <path d="M2 38l11-16 8 10 10-17 15 23z" />
      <path d="M2 38h44" />
    </>
  ),
  "hollin-reach": (
    <>
      <path d="M10 40l7-26 6 15 7-20 8 31z" />
      <path d="M17 14l6 15 7-20" />
    </>
  ),
  dorado: (
    <>
      <path d="M6 37a18 18 0 0 1 36 0M3 37h42" />
      <path d="M15 37v-9M24 37V19M33 37v-9" />
      <circle cx="24" cy="12" r="2" />
    </>
  ),
};

/** The glyph for a place id (decorative). */
export function PlaceGlyph({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {GLYPHS[id] ?? null}
    </svg>
  );
}
