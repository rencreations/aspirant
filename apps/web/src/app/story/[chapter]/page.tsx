import fs from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { chapterBySlug, chapterFile, chapterLabel, chapters } from "@/content/story";
import type { Chapter, EndFile } from "@/content/story-types";
import { LEGACY_PART_SLUGS } from "@/features/story/chapter-href";
import { LegacyPartRedirect } from "@/features/story/legacy-part-redirect";
import { ChapterPage } from "@/features/story/reader/ChapterPage";
import { EndPage } from "@/features/story/reader/EndPage";

// The text of the story is read at build time, so each chapter is plain static HTML.
const PUBLIC = path.join(process.cwd(), "public");

export const dynamicParams = false;

const END = "the-end";

export function generateStaticParams() {
  return [
    ...chapters.map((c) => ({ chapter: c.slug })),
    { chapter: END },
    ...LEGACY_PART_SLUGS.map((chapter) => ({ chapter })),
  ];
}

function legacyPart(slug: string): number | null {
  const match = /^part-(\d{2})$/u.exec(slug);
  return match ? Number(match[1]) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chapter: string }>;
}): Promise<Metadata> {
  const slug = (await params).chapter;
  if (slug === END) {
    return {
      title: "Who is who",
      description: "The people of the Aspirant story, and a timeline of when it all happened.",
    };
  }
  const entry = chapterBySlug(slug);
  if (!entry) return { title: "Story", robots: { index: false } };
  const title = entry.number === 0 ? "Prologue" : `${chapterLabel(entry)}: ${entry.title}`;
  return {
    title,
    description:
      `${title} of Aspirant, the story. ${entry.dateline ?? ""} ${entry.mood ?? ""}`.trim(),
  };
}

export default async function Page({ params }: { params: Promise<{ chapter: string }> }) {
  const slug = (await params).chapter;
  if (slug === END) {
    const end = JSON.parse(
      fs.readFileSync(path.join(PUBLIC, "data", "story", "end.json"), "utf8"),
    ) as EndFile;
    return <EndPage end={end} />;
  }
  const part = legacyPart(slug);
  if (part !== null && LEGACY_PART_SLUGS.includes(slug)) return <LegacyPartRedirect part={part} />;
  const entry = chapterBySlug(slug);
  if (!entry) notFound();
  const chapter = JSON.parse(
    fs.readFileSync(path.join(PUBLIC, chapterFile(entry.id)), "utf8"),
  ) as Chapter;
  return <ChapterPage chapter={chapter} entry={entry} />;
}
