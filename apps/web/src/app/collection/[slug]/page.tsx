import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LibraryRoom } from "@/features/library/library-room";
import { getCollection } from "@/features/library/registry";
import { COLLECTION_SLUGS, isCollectionSlug } from "@/features/library/types";

export const dynamicParams = false;

const OWN_ROUTES: ReadonlySet<string> = new Set(["arts", "video", "animation", "lore", "design"]);

export function generateStaticParams() {
  // Arts, Video, Animation, Lore and Design have their own routes (`app/collection/arts/`, `.../video/`, `.../animation/`, `.../lore/`, `.../design/`).
  return COLLECTION_SLUGS.filter((slug) => !OWN_ROUTES.has(slug)).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isCollectionSlug(slug)) return { title: "Collection", robots: { index: false } };
  const meta = getCollection(slug);
  return { title: meta.name, description: meta.line };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isCollectionSlug(slug) || OWN_ROUTES.has(slug)) notFound();
  return <LibraryRoom slug={slug} />;
}
