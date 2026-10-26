import type { Metadata } from "next";

import { nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { DuoView } from "@/features/character/duo/duo-view";
import { characterMetadata } from "@/features/character/metadata";
import { readable } from "@/features/character/theme";
import { characterRoute } from "@/lib/site";

export const metadata: Metadata = characterMetadata("ruby");

export default function RubyPage() {
  const next = nextCharacter("ruby");
  const art = ART[next.slug];
  return (
    <DuoView
      who="ruby"
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
