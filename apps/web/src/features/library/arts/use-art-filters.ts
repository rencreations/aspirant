"use client";

import { useMemo } from "react";

import { useQueryState } from "../use-query-state";
import { NO_FILTERS, type ArtFilters } from "./filter";
import { ART_KINDS, type ArtKind } from "./types";

export type ArtView = "gallery" | "wall";

export interface ArtFilterState {
  filters: ArtFilters;
  setQ: (next: string) => void;
  setWho: (next: string) => void;
  setKind: (next: string) => void;
  setPair: (next: string) => void;
  clear: () => void;
  view: ArtView;
  setView: (next: ArtView) => void;
}

/** The filters and the view of the official tab, each kept in the address (`?who=layla&kind=splash`). */
export function useArtFilters(): ArtFilterState {
  const [q, setQ] = useQueryState("q");
  const [who, setWho] = useQueryState("who");
  const [kindRaw, setKind] = useQueryState("kind");
  const [pair, setPair] = useQueryState("pair");
  const [viewRaw, setViewRaw] = useQueryState("view");

  const kind: ArtKind | "" = (ART_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as ArtKind)
    : NO_FILTERS.kind;
  const filters = useMemo<ArtFilters>(() => ({ q, who, kind, pair }), [q, who, kind, pair]);

  return {
    filters,
    setQ,
    setWho,
    setKind,
    setPair,
    clear: () => {
      setQ("");
      setWho("");
      setKind("");
      setPair("");
    },
    view: viewRaw === "wall" ? "wall" : "gallery",
    setView: (next) => {
      setViewRaw(next === "wall" ? "wall" : "");
    },
  };
}
