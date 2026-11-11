"use client";

import { useEffect, useMemo } from "react";

import { asset } from "@/lib/asset";

import { useLibraryData } from "../../data";
import { useQueryState } from "../../use-query-state";
import { ArtistsView } from "./artists-view";
import { adaptFan, allNewest, movedTarget } from "./model";
import type { FanRaw } from "./types";
import { WallView } from "./wall-view";

/**
 * Fanart: fan art and fan videos with their makers. The default view is the flow of rows with the
 * videos in a row of their own; `?view=artist` groups the pieces under the artist who made them.
 * An old address that names one of the twelve cosplay photos (they moved to Cosplay) is sent on.
 */
export default function FanartPage() {
  const { data, failed } = useLibraryData<FanRaw>("arts-fanart");
  const [view] = useQueryState("view");
  const [wanted] = useQueryState("i");

  const forward = movedTarget(wanted);
  useEffect(() => {
    if (forward) window.location.replace(asset(forward));
  }, [forward]);

  const all = useMemo(() => (data ? allNewest(data.items.map(adaptFan)) : null), [data]);

  // The cosplay photos left this room: the page says nothing while the visitor is sent on.
  if (forward) return <main style={{ minHeight: "100svh" }} data-fanart-forward="" />;
  return view === "artist" ? (
    <ArtistsView all={all} failed={failed} />
  ) : (
    <WallView all={all} failed={failed} />
  );
}
