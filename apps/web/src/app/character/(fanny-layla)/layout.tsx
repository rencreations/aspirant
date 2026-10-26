import type { ReactNode } from "react";

import { LfMusic } from "@/features/character/layla-fanny/lf-music";

/**
 * Layla's page and Fanny's share this layout, which holds their theme, so it plays on without a
 * break while the address changes between them.
 */
export default function PairLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LfMusic />
      {children}
    </>
  );
}
