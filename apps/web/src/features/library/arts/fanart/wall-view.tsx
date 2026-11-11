"use client";

import { useMemo } from "react";

import { FlowRoom } from "../core/flow";
import { ASPIRANT_SECTIONS } from "../core/flow/sections";
import { fanCaption } from "./caption";
import { fanFacetOf, fanFacets, fanSearchOf, picturesNewest, videosOrdered } from "./model";
import type { FanItem } from "./types";
import { VideoStrip } from "./video-strip";
import { ViewToggle } from "./view-toggle";

const NOUNS = ["picture", "pictures"] as const;
const CONTROLS = <ViewToggle />;

/**
 * Fanart as a still wall: the pictures in rows that fill the page, grouped by Aspirant, with a
 * search, a filter (the Aspirants, then the pairs, platforms and artists with more than one
 * picture, behind "See more"), the zoom with the credit in its caption, and the videos as a row of
 * their own over the wall.
 */
export function WallView({ all, failed }: { all: readonly FanItem[] | null; failed: boolean }) {
  const pictures = useMemo(() => (all ? picturesNewest(all) : null), [all]);
  const videos = useMemo(() => (all ? videosOrdered(all) : []), [all]);
  // The chips count the pictures, which is what the rows show.
  const facets = useMemo(() => (pictures ? fanFacets(pictures) : []), [pictures]);
  return (
    <FlowRoom<FanItem>
      room="fanart"
      title="Fanart"
      items={pictures}
      failed={failed}
      facets={facets}
      facetOf={fanFacetOf}
      searchOf={fanSearchOf}
      facetLabel="Filter by Aspirant, pair, platform or artist"
      sections={ASPIRANT_SECTIONS}
      nouns={NOUNS}
      searchLabel="Search fan art"
      controls={CONTROLS}
      header={videos.length > 0 ? <VideoStrip videos={videos} facets={facets} /> : null}
      caption={fanCaption}
    />
  );
}
