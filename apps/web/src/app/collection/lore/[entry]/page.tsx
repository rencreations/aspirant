import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import { splitPairSlug } from "@/features/library/lore/codex/model";

export const dynamicParams = false;

interface Row {
  slug: string;
  name?: string;
  line?: string;
  a?: string;
  b?: string;
}

/** The entries and the pairs of the codex, read from its data file at build time. */
function rows(): { entries: Row[]; pairs: Row[] } {
  const file = path.join(process.cwd(), "public", "data", "library", "lore-codex.json");
  if (!fs.existsSync(file)) return { entries: [], pairs: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as { entries: Row[]; pairs: Row[] };
}

export function generateStaticParams() {
  const { entries, pairs } = rows();
  return [...entries, ...pairs].map((r) => ({ entry: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entry: string }>;
}): Promise<Metadata> {
  const { entry } = await params;
  const { entries } = rows();
  const e = entries.find((r) => r.slug === entry);
  if (e) return { title: `${e.name ?? entry}, the lore`, description: e.line };
  const pair = splitPairSlug(entry);
  if (pair) {
    const name = (s: string) => entries.find((r) => r.slug === s)?.name ?? s;
    return { title: `${name(pair[0])} and ${name(pair[1])}, the lore` };
  }
  return { title: "The lore" };
}

/** Nothing here: the room and its window are drawn by the layout. */
export default function Page() {
  return null;
}
