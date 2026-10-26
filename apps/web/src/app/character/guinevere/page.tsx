import type { Metadata } from "next";

import { nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { GuinevereRoot } from "@/features/character/guinevere/guinevere-page";
import { characterMetadata } from "@/features/character/metadata";
import { readable } from "@/features/character/theme";
import { characterRoute } from "@/lib/site";

export const metadata: Metadata = characterMetadata("guinevere");

export default function GuinevereRootPage() {
  const next = nextCharacter("guinevere");
  const art = ART[next.slug];
  return (
    <GuinevereRoot
      next={{
        slug: next.slug,
        name: next.name,
        aspirantName: next.aspirantName,
        tagline: next.tagline,
        order: next.order,
        href: characterRoute(next.slug),
        image: `/img/char/${next.slug}/splash.webp`,
        accent: readable(next.palette[art.accent.accent], "daybreak"),
      }}
    />
  );
}
