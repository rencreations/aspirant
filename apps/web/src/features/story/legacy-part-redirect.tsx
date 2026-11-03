"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

import { legacyPartHref } from "./chapter-href";

/**
 * An old `/story/part-NN/` address (the story of before was read one Part to a page). It opens the
 * chapter of the new book that the old Part began with.
 */
export function LegacyPartRedirect({ part }: { part: number }) {
  useEffect(() => {
    window.location.replace(asset(legacyPartHref(part)));
  }, [part]);
  return (
    <div className="shell below-nav" style={{ minHeight: "60vh" }}>
      <h1 className="display text-step-5">The story has a new home</h1>
      <p>
        <a className="link" href={asset(`${routes.story}/`)}>
          Open the story
        </a>
      </p>
    </div>
  );
}
