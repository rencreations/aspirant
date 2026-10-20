/**
 * Server-side data for the roster: slim, serialisable entries for the client island, so the
 * voice tables and the full character files stay out of the browser bundle.
 */
import { characters } from "@/content/characters";
import { pairs } from "@/content/pairs";
import type { PairId, Side, Slug } from "@/content/types";

import { ART } from "../art";

export interface RosterCharacter {
  readonly slug: Slug;
  readonly order: number;
  readonly name: string;
  readonly aspirantName: string;
  readonly jp: string;
  readonly romaji: string | null;
  readonly tagline: string;
  readonly side: Side;
  readonly pair: PairId;
  /** The character's signature colour, raw, for lines and glows. */
  readonly colour: string;
}

export interface RosterPair {
  readonly id: PairId;
  readonly names: string;
  readonly kind: "partners" | "creator-and-creation";
  readonly tagline: string;
  readonly colours: readonly [string, string];
  readonly members: readonly [Slug, Slug];
}

export function rosterCharacters(): RosterCharacter[] {
  return characters.map((c) => {
    const art = ART[c.slug];
    return {
      slug: c.slug,
      order: c.order,
      name: c.name,
      aspirantName: c.aspirantName,
      jp: c.jp.script,
      romaji: c.jp.romaji,
      tagline: c.tagline,
      side: c.side,
      pair: c.pair,
      colour: c.palette[art.accent.accent],
    };
  });
}

export function rosterPairs(): RosterPair[] {
  return pairs.map((p) => ({
    id: p.id,
    names: p.names,
    kind: p.kind,
    tagline: p.tagline,
    colours: p.colours,
    members: p.members,
  }));
}
