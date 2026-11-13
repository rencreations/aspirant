import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import { ComicReaderRoute } from "@/features/library/comic/reader-route";

export const dynamicParams = false;

interface Row {
  slug: string;
  title: string;
  description: string;
}

/** The comics of the room, read from the data file at build time. */
function comics(): Row[] {
  const file = path.join(process.cwd(), "public", "data", "library", "comic.json");
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { items: Row[] }).items;
}

export function generateStaticParams() {
  return comics().map((c) => ({ comic: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ comic: string }>;
}): Promise<Metadata> {
  const { comic } = await params;
  const found = comics().find((c) => c.slug === comic);
  if (!found) return { title: "Comic", robots: { index: false } };
  return { title: `${found.title}, comic`, description: found.description };
}

/** One comic, read page by page. Each comic has its own address. */
export default async function Page({ params }: { params: Promise<{ comic: string }> }) {
  const { comic } = await params;
  const found = comics().find((c) => c.slug === comic);
  if (!found) return null;
  return (
    <>
      <ComicReaderRoute slug={comic} />
      <noscript>
        <h1>{found.title}</h1>
        <p>{found.description}</p>
      </noscript>
    </>
  );
}
