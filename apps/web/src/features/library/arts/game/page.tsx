"use client";

import { useMemo } from "react";

import { useArtsData } from "../core/data";
import { FlowRoom } from "../core/flow";
import type { ArtsItem } from "../core/types";
import { gameFacetOf, gameFacets, gameSearchOf } from "./facets";

/** Game: stills of the in-game animation and the game's own art, as a flow of rows filtered by who they show. */
export default function GamePage() {
  const { data, failed } = useArtsData<ArtsItem>("game");
  const facets = useMemo(() => gameFacets(data), [data]);
  return (
    <FlowRoom
      room="game"
      title="Game"
      items={data?.items ?? null}
      failed={failed}
      facets={facets}
      facetOf={gameFacetOf}
      searchOf={gameSearchOf}
      facetLabel="Who is shown"
      nouns={["still", "stills"]}
      searchLabel="Search the game"
    />
  );
}
