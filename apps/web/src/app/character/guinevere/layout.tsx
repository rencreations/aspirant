import type { ReactNode } from "react";

import { GuinevereMusic } from "@/features/character/guinevere/guinevere-music";

/**
 * Guinevere's page and her two story pages share this layout, which holds her music, so it plays on
 * without a break while the address changes between them.
 */
export default function GuinevereLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <GuinevereMusic />
      {children}
    </>
  );
}
