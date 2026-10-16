import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { characterRoute } from "@/lib/site";
import { CHARACTER_NAMES, CHARACTER_SLUGS, isCharacterSlug, nextSlug } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return CHARACTER_SLUGS.map((slug) => ({ slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isCharacterSlug(slug)) return {};
  const name = CHARACTER_NAMES[slug];
  return {
    title: name,
    description: `${name}, one of the ten Aspirants of Selrick Academy: who she is, her voice lines and her place in the story.`,
  };
}

export default async function CharacterPage({ params }: Props) {
  const { slug } = await params;
  if (!isCharacterSlug(slug)) notFound();
  const index = CHARACTER_SLUGS.indexOf(slug);
  const next = nextSlug(slug);
  return (
    <>
      <PageIntro
        code={`Unit ${String(index + 1).padStart(2, "0")} / ${slug}`}
        title={CHARACTER_NAMES[slug]}
        lead="Profile, voice lines and her place in the story arrive here next."
      />
      <NextFooter
        eyebrow="Next in queue"
        label={CHARACTER_NAMES[next]}
        sublabel={`Unit ${String(CHARACTER_SLUGS.indexOf(next) + 1).padStart(2, "0")} of 10`}
        href={characterRoute(next)}
        image={`/img/char/${next}/splash.webp`}
      />
    </>
  );
}
