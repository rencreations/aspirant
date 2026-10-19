import type { ReactNode } from "react";

import { nextCharacter } from "@/content/characters";
import { SelenaPage } from "@/features/character/selena/selena-page";
import { characterRoute } from "@/lib/site";

/**
 * Selena's page and her three pages (About, Skills, Gallery) share this layout. It holds the
 * stage, the music and the drawers, and the layout stays mounted while the address changes
 * between them, so no animation is cut. The pages below only give each address its own title.
 */
export default function SelenaLayout({ children }: { children: ReactNode }) {
  const n = nextCharacter("selena");
  return (
    <>
      <SelenaPage next={{ label: n.name, name: n.name, href: characterRoute(n.slug) }} />
      {children}
    </>
  );
}
