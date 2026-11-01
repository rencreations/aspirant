import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { PartFile, StoryIndex } from "@/content/story-types";
import { parts } from "@/content/story";
import { partSlug } from "@/features/story/chapter-href";
import { PartPage } from "@/features/story/reader/PartPage";

// The text of the story is read at build time, so each Part is plain static HTML.
const DATA = path.join(process.cwd(), "public", "data", "story");

export const dynamicParams = false;

export function generateStaticParams() {
  return parts.map((part) => ({ part: partSlug(part.number) }));
}

function numberOf(slug: string): number | null {
  const match = /^part-(\d{2})$/u.exec(slug);
  const n = match ? Number(match[1]) : NaN;
  return parts.some((part) => part.number === n) ? n : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ part: string }>;
}): Promise<Metadata> {
  const n = numberOf((await params).part);
  const part = parts.find((p) => p.number === n);
  if (!part) return {};
  return {
    title: `${part.label}: ${part.title}`,
    description: `${part.label} of the Aspirant story, ${part.title}. ${part.setting}`,
  };
}

export default async function Page({ params }: { params: Promise<{ part: string }> }) {
  const n = numberOf((await params).part);
  if (n === null) notFound();
  const file = JSON.parse(
    fs.readFileSync(path.join(DATA, `part-${String(n).padStart(2, "0")}.json`), "utf8"),
  ) as PartFile;
  const index = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8")) as StoryIndex;
  return <PartPage file={file} front={index.beforeYouBegin} />;
}
