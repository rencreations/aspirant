"use client";

import dynamic from "next/dynamic";

// The reader is its own chunk. The loading list of the page fetches it first (`preload.ts`).
const ReaderPage = dynamic(() => import("./reader-page"));

/** The reader of one comic, for the page `/collection/comic/<slug>/`. */
export function ComicReaderRoute({ slug }: { slug: string }) {
  return <ReaderPage slug={slug} />;
}
