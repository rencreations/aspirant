import type { ReactNode } from "react";

import { VexanaMusic } from "@/features/character/vexana/vexana-music";

/**
 * Vexana's page and her two story pages share this layout, which holds her music, so it plays on
 * without a break while the address changes between them.
 */
export default function VexanaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <VexanaMusic />
      {children}
    </>
  );
}
