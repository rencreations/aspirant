import type { Metadata } from "next";

import { CollectionsRedirect } from "@/features/library/collections-redirect";
import { COLLECTION_SLUGS } from "@/features/library/types";

export const dynamicParams = false;

export const metadata: Metadata = {
  title: "Collection",
  robots: { index: false, follow: true },
};

export function generateStaticParams() {
  return [{ slug: [] as string[] }, ...COLLECTION_SLUGS.map((slug) => ({ slug: [slug] }))];
}

/**
 * `/collections` and `/collections/<name>` are the plural spellings. A static export has no
 * server redirects, so this small page sends the visitor to `/collection/...`.
 */
export default function Page() {
  return <CollectionsRedirect />;
}
