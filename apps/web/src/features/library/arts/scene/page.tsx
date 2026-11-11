"use client";

import { useMemo } from "react";

import { useArtsData } from "../core/data";
import { FlowRoom } from "../core/flow";
import { ASPIRANT_SECTIONS } from "../core/flow/sections";
import type { ArtsItem } from "../core/types";
import { sceneFacetOf, sceneFacets, sceneSearchOf } from "./facets";

/** Scene: the stills of the official films, as a still wall grouped by Aspirant and filtered by who or what they show. */
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
      facetLabel="Aspirants and places"
      sections={ASPIRANT_SECTIONS}
      leadChips={10}
      nouns={["still", "stills"]}
      searchLabel="Search scenes"
    />
  );
}
