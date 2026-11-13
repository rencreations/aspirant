"use client";

import { useMemo } from "react";

import { TLink } from "@/components/transition/t-link";
import { collectionRoute } from "@/lib/site";

import { useLibraryData } from "../data";
import { parsePage, readProgress } from "./progress";
import { Reader } from "./reader";
import type { ComicItem } from "./types";

/**
 * The page of one comic. It finds the comic by its slug in the room's data (already in the cache
 * from the loading list) and opens the reader on the page the address names, or on the place the
 * visitor reached last.
 */
export default function ReaderPage({ slug }: { slug: string }) {
  const { data, failed } = useLibraryData<ComicItem>("comic");
  const comics = useMemo(() => data?.items ?? [], [data]);
  const index = comics.findIndex((c) => c.slug === slug);
  const comic = index >= 0 ? comics[index] : undefined;

  if (failed || (data && !comic)) {
    return (
      <main className="shell" style={{ paddingBlock: "8rem" }}>
        <p>This comic could not be found.</p>
        <TLink href={collectionRoute("comic")} className="link">
          Back to the comics
        </TLink>
      </main>
    );
  }
  if (!comic) return null;

  const prev = index > 0 ? (comics[index - 1] ?? null) : null;
  const next = index < comics.length - 1 ? (comics[index + 1] ?? null) : null;
  const fromAddress = parsePage(new URLSearchParams(window.location.search).get("p"));
  return (
    <Reader
      key={comic.id}
      comic={comic}
      prev={prev}
      next={next}
      startPage={fromAddress ?? readProgress(comic.id)}
    />
  );
}
