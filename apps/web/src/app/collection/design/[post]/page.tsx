import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

export const dynamicParams = false;

interface Row {
  slug: string;
  title: string;
  caption: string;
}

/** The posts of the design room, read from its data file at build time. */
function posts(): Row[] {
  const file = path.join(process.cwd(), "public", "data", "library", "design.json");
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { items: Row[] }).items;
}

export function generateStaticParams() {
  return posts().map((p) => ({ post: p.slug }));
}

/** The first sentence or two of a caption, for the page description. */
function summary(caption: string): string {
  const flat = caption.replace(/\s+/gu, " ").trim();
  return flat.length > 170 ? `${flat.slice(0, 167).trimEnd()}...` : flat;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ post: string }>;
}): Promise<Metadata> {
  const { post } = await params;
  const found = posts().find((p) => p.slug === post);
  if (!found) return { title: "Design", robots: { index: false } };
  return { title: `${found.title}, design`, description: summary(found.caption) };
}

/**
 * The window is drawn by the room (see the layout). What is here is the post's words, for a search
 * engine and for a reader without scripts; it is not shown.
 */
export default async function Page({ params }: { params: Promise<{ post: string }> }) {
  const { post } = await params;
  const found = posts().find((p) => p.slug === post);
  if (!found) return null;
  return (
    <article className="sr-only">
      <h2>{found.title}</h2>
      <p>{found.caption}</p>
    </article>
  );
}
