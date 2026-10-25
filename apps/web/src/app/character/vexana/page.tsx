import type { Metadata } from "next";

import { nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { characterMetadata } from "@/features/character/metadata";
import { readable } from "@/features/character/theme";
import { VexanaPage } from "@/features/character/vexana/vexana-page";
import { characterRoute } from "@/lib/site";

export const metadata: Metadata = characterMetadata("vexana");

export default function VexanaRoot() {
  const next = nextCharacter("vexana");
  const art = ART[next.slug];
  return (
    <VexanaPage
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
