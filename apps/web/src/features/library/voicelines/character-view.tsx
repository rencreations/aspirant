"use client";

import dynamic from "next/dynamic";

import type { CharacterSlug } from "@/lib/slugs";

// The loading list (`preload.ts`) fetches this chunk first, so it is in when the page opens.
const CharacterPage = dynamic(() => import("./character-page"));

/** The client side of `/collection/voicelines/<slug>`. */
export function VoicelinesCharacter({ character }: { character: CharacterSlug }) {
  return <CharacterPage character={character} />;
}
