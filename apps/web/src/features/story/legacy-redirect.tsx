"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

import { storyChapterHref } from "./chapter-href";

const CHAPTER = /^#(c\d{2}|i-far-above-\d)(-p\d{3})?$/u;

/** Where an old address (`/experience/` or `/experience/#c12`) points now. */
export function legacyTarget(hash: string): string {
  const match = CHAPTER.exec(hash);
  return match ? storyChapterHref(hash.slice(1)) : `${routes.story}/`;
}

/** Sends an old `/experience/` link to the story, a chapter link to the chapter's Part. */
export function LegacyRedirect() {
  useEffect(() => {
    window.location.replace(asset(legacyTarget(window.location.hash)));
  }, []);
  return (
    <div className="shell below-nav" style={{ minHeight: "60vh" }}>
      <h1 className="display text-step-5">The story has moved</h1>
      <p>
        <a className="link" href={asset(`${routes.story}/`)}>
          Open the story
        </a>
      </p>
    </div>
  );
}
