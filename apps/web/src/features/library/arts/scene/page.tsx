"use client";

import { useMemo } from "react";

import { useArtsData } from "../core/data";
import { FlowRoom } from "../core/flow";
import type { ArtsItem } from "../core/types";
import { sceneFacetOf, sceneFacets, sceneSearchOf } from "./facets";

/** Scene: the stills of the official films, as a flow of rows filtered by the place they show. */
export default function ScenePage() {
  const { data, failed } = useArtsData<ArtsItem>("scene");
  const facets = useMemo(() => sceneFacets(data), [data]);
  return (
    <FlowRoom
      room="scene"
      title="Scene"
      items={data?.items ?? null}
      failed={failed}
      facets={facets}
      facetOf={sceneFacetOf}
      searchOf={sceneSearchOf}
      facetLabel="Places"
      nouns={["still", "stills"]}
      searchLabel="Search scenes"
    />
  );
}
