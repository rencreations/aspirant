"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { CollectionSlug } from "./types";

// One chunk per room. The loading list (`preload.ts` of each room) fetches the chunk first.
const ROOMS: Record<CollectionSlug, ComponentType> = {
  arts: dynamic(() => import("./arts/page")),
  video: dynamic(() => import("./video/chooser")),
  music: dynamic(() => import("./music/page")),
  voicelines: dynamic(() => import("./voicelines/page")),
  fanart: dynamic(() => import("./fanart/page")),
  comic: dynamic(() => import("./comic/page")),
  lore: dynamic(() => import("./lore/page")),
  design: dynamic(() => import("./design/page")),
  animation: dynamic(() => import("./animation/page")),
  others: dynamic(() => import("./others/page")),
};

/** Draws the room of one collection. */
export function LibraryRoom({ slug }: { slug: CollectionSlug }) {
  const Room = ROOMS[slug];
  return <Room />;
}
