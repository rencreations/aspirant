"use client";

import { useMemo } from "react";

import { useArtsData } from "../core/data";
import { FlowRoom } from "../core/flow";
import {
  othersFacetOf,
  othersFacets,
  othersSearchOf,
  type OthersHead,
  type OthersItem,
} from "./facets";

/** Others: the official art that fits no other room, and the pictures made for this site, filtered by kind and by Aspirant. */
export default function OthersPage() {
  const { data, failed } = useArtsData<OthersItem, OthersHead>("others");
  const facets = useMemo(() => othersFacets(data), [data]);
  return (
    <FlowRoom
      room="others"
      title="Others"
      items={data?.items ?? null}
      failed={failed}
      facets={facets}
      facetOf={othersFacetOf}
      searchOf={othersSearchOf}
      facetLabel="Kinds and Aspirants"
      searchLabel="Search the others"
    />
  );
}
