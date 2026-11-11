"use client";

import { useEffect, useState } from "react";

import { fetchLibraryJson } from "../../data";
import { haystack } from "./model";
import type { CodexEntry, CodexFile, CodexKind, CodexPair } from "./types";

export const CODEX_PATH = "/data/library/lore-codex.json";

/** The codex file with the lookups the room and the window need. */
export interface Codex {
  file: CodexFile;
  entry: ReadonlyMap<string, CodexEntry>;
  pair: ReadonlyMap<string, CodexPair>;
  byKind: ReadonlyMap<CodexKind, readonly CodexEntry[]>;
  hay: ReadonlyMap<string, ReturnType<typeof haystack>>;
  /** How much an entry matters, for ordering: the ten first, then by the number of ties. */
  weight: (slug: string) => number;
}

function index(file: CodexFile): Codex {
  const entry = new Map(file.entries.map((e) => [e.slug, e] as const));
  const pair = new Map(file.pairs.map((p) => [p.slug, p] as const));
  const byKind = new Map<CodexKind, CodexEntry[]>();
  for (const e of file.entries) {
    const list = byKind.get(e.kind) ?? [];
    list.push(e);
    byKind.set(e.kind, list);
  }
  const hay = new Map(file.entries.map((e) => [e.slug, haystack(e)] as const));
  const weight = (slug: string): number => {
    const e = entry.get(slug);
    if (!e) return 0;
    return (e.character ? 10_000 : 0) + (e.tier === "A" ? 100 : 0) + Math.min(99, e.rel.length);
  };
  return { file, entry, pair, byKind, hay, weight };
}

let cached: Promise<Codex> | null = null;

/** The codex, fetched once per visit. */
function loadCodex(): Promise<Codex> {
  cached ??= fetchLibraryJson<CodexFile>(CODEX_PATH).then(index);
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

export function useCodex(): { codex: Codex | null; failed: boolean } {
  const [state, setState] = useState<{ codex: Codex | null; failed: boolean }>({
    codex: null,
    failed: false,
  });
  useEffect(() => {
    let live = true;
    loadCodex().then(
      (codex) => {
        if (live) setState({ codex, failed: false });
      },
      () => {
        if (live) setState({ codex: null, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}
