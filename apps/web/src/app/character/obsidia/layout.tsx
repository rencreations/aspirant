import type { ReactNode } from "react";

import { nextCharacter } from "@/content/characters";
import { ObsidiaPage } from "@/features/character/obsidia/obsidia-page";
import { characterRoute } from "@/lib/site";

/**
 * Obsidia's page and her three pages (About, Skills, Gallery) share this layout. It holds the
 * stage, the music and the drawers, and the layout stays mounted while the address changes
 * between them, so no animation is cut. The pages below only give each address its own title.
 */
export default function ObsidiaLayout({ children }: { children: ReactNode }) {
  const n = nextCharacter("obsidia");
  return (
    <>
      <ObsidiaPage next={{ label: n.name, name: n.name, href: characterRoute(n.slug) }} />
      {children}
    </>
  );
}
