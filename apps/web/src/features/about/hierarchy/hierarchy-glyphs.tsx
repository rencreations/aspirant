import type { ReactNode } from "react";

/** Line drawings for the five layers (48 x 48). The core is drawn as a device, not a figure. */
const GLYPHS: Readonly<Record<string, ReactNode>> = {
  will: (
    <>
      <circle cx="24" cy="24" r="19" />
      <path d="M6 24c5-8 11-12 18-12s13 4 18 12c-5 8-11 12-18 12S11 32 6 24z" />
      <circle cx="24" cy="24" r="5" />
    </>
  ),
  matrix: (
    <>
      <circle cx="24" cy="24" r="6" />
      <circle cx="24" cy="24" r="13" />
      <circle cx="24" cy="24" r="20" />
      <path d="M24 4v40M4 24h40M10 10l28 28M38 10L10 38" />
    </>
  ),
  obsidia: (
    <>
      <path d="M24 3l5 15 15 6-15 6-5 15-5-15-15-6 15-6z" />
      <path d="M24 12v24M12 24h24" />
    </>
  ),
  enders: (
    <>
      <path d="M8 40l6-22 6 22zM20 40l8-30 8 30zM34 40l4-14 4 14z" />
      <path d="M4 40h40" />
    </>
  ),
  core: (
    <>
      <path d="M24 5l12 8v14l-12 8-12-8V13z" />
      <path d="M24 5v30M12 13l24 14M36 13L12 27" />
      <path d="M6 40h8M34 40h8M10 44h28" strokeDasharray="3 3" />
    </>
  ),
};

/** Glyph for a layer id (decorative). */
export function LayerGlyph({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {GLYPHS[id] ?? null}
    </svg>
  );
}
