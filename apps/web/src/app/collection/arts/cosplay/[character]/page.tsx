import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CosplayView } from "@/features/library/arts/core/arts-room";
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
  if (!isCharacterSlug(character)) return { title: "Cosplay", robots: { index: false } };
  return {
    title: `${CHARACTER_NAMES[character]}, cosplay`,
    description: `Cosplay of ${CHARACTER_NAMES[character]}, each piece credited.`,
  };
}

export default async function Page({ params }: { params: Promise<{ character: string }> }) {
  const { character } = await params;
  if (!isCharacterSlug(character)) notFound();
  return <CosplayView character={character} />;
}
