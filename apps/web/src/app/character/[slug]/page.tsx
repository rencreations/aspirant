import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findCharacter } from "@/content/characters";
import { characterMetadata } from "@/features/character/metadata";
import { CharacterView } from "@/features/character/page/character-view";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  // Selena, Obsidia and Vexana have their own route folders (a page and its three pages share a layout).
  return CHARACTER_SLUGS.filter(
    (slug) => slug !== "selena" && slug !== "obsidia" && slug !== "vexana",
  ).map((slug) => ({
    slug,
  }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return characterMetadata(slug);
}

export default async function CharacterPage({ params }: Props) {
  const { slug } = await params;
  const c = findCharacter(slug);
  if (!c) notFound();
  return <CharacterView slug={c.slug} />;
}
