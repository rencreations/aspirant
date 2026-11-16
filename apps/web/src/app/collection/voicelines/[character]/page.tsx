import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VoicelinesCharacter } from "@/features/library/voicelines/character-view";
import { CHARACTER_NAMES, CHARACTER_SLUGS, isCharacterSlug } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return CHARACTER_SLUGS.map((character) => ({ character }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ character: string }>;
}): Promise<Metadata> {
  const { character } = await params;
  if (!isCharacterSlug(character)) return { title: "Voicelines", robots: { index: false } };
  return {
    title: `${CHARACTER_NAMES[character]}, voicelines`,
    description: `Every voice line of ${CHARACTER_NAMES[character]} in eight languages, with the text, a translation and a download.`,
  };
}

/** The voice lines of one Aspirant. The language is `?lang=` (Japanese when there is none). */
export default async function Page({ params }: { params: Promise<{ character: string }> }) {
  const { character } = await params;
  if (!isCharacterSlug(character)) notFound();
  return <VoicelinesCharacter character={character} />;
}
