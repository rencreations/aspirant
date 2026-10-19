import type { Metadata } from "next";

import { findCharacter } from "@/content/characters";
import { asset } from "@/lib/asset";
import { siteConfig } from "@/lib/site";

/** The page metadata of a character: title, description, social cards. `title` replaces the default. */
export function characterMetadata(slug: string, title?: string): Metadata {
  const c = findCharacter(slug);
  if (!c) return {};
  const name = title ?? `${c.name}, ${c.aspirantName}`;
  const description = `${c.tagline} ${c.summary}`;
  const image = {
    url: asset(`/img/char/${c.slug}/splash-sm.webp`),
    width: 800,
    height: 450,
    alt: `${c.name}, official splash art`,
  };
  return {
    title: name,
    description,
    openGraph: {
      title: name,
      description,
      type: "profile",
      siteName: siteConfig.name,
      locale: "en",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: name, description, images: [image.url] },
  };
}
