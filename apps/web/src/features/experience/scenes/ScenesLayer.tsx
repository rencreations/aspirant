"use client";

/**
 * Stub, owned by the scene engineer: the fixed full-bleed backdrop behind the text.
 * Reads `useExperience` and renders the scene for the active Part and chapter.
 */
export default function ScenesLayer() {
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" />;
}
