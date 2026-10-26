import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findCharacter } from "@/content/characters";
import { characterMetadata } from "@/features/character/metadata";
import { CharacterView } from "@/features/character/page/character-view";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamicParams = false;

/** Characters whose page has a route folder of its own. */
const OWN_ROUTE: ReadonlySet<string> = new Set([
  "selena",
  "obsidia",
  "vexana",
  "guinevere",
  "ruby",
  "angela",
  "layla",
  "fanny",
]);

export function generateStaticParams() {
  // Every character in the set above has a route folder of its own.
  return CHARACTER_SLUGS.filter((slug) => !OWN_ROUTE.has(slug)).map((slug) => ({
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
