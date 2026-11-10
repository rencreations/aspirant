import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CharacterView } from "@/features/library/animation/character-view";
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
  if (!isCharacterSlug(character)) return { title: "Animation", robots: { index: false } };
  return {
    title: `${CHARACTER_NAMES[character]}, animation`,
    description: `The in-game animation of ${CHARACTER_NAMES[character]}, full screen.`,
  };
}

export default async function Page({ params }: { params: Promise<{ character: string }> }) {
  const { character } = await params;
  if (!isCharacterSlug(character)) notFound();
  return <CharacterView character={character} />;
}
