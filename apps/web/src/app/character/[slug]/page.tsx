import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { findCharacter, nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { CharacterView } from "@/features/character/page/character-view";
import { SelenaPage } from "@/features/character/selena/selena-page";
import { characterVars, readable } from "@/features/character/theme";
import { asset } from "@/lib/asset";
import { characterRoute, siteConfig } from "@/lib/site";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams() {
  return CHARACTER_SLUGS.map((slug) => ({ slug }));
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = findCharacter(slug);
  if (!c) return {};
  const title = `${c.name}, ${c.aspirantName}`;
  const description = `${c.tagline} ${c.summary}`;
  const image = {
    url: asset(`/img/char/${c.slug}/splash-sm.webp`),
    width: 800,
    height: 450,
    alt: `${c.name}, official splash art`,
  };
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      siteName: siteConfig.name,
      locale: "en",
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function CharacterPage({ params }: Props) {
  const { slug } = await params;
  const c = findCharacter(slug);
  if (!c) notFound();
  if (c.slug === "selena") {
    const n = nextCharacter(c.slug);
    const art = ART[n.slug];
    return (
      <SelenaPage
        next={{
          label: n.name,
          sublabel: `${n.aspirantName}. Unit ${String(n.order).padStart(2, "0")} of 10. ${n.tagline}`,
          href: characterRoute(n.slug),
          image: `/img/char/${n.slug}/splash.webp`,
          accent: readable(n.palette[art.accent.accent], "daybreak"),
          vars: characterVars(n.palette, "daybreak", art.accent),
        }}
      />
    );
  }
  return <CharacterView slug={c.slug} />;
}
