/**
 * Server-side data for the roster: slim, serialisable entries for the client island, so the
 * voice tables and the full character files stay out of the browser bundle.
 */
import type { CSSProperties } from "react";

import { characters, keyVoiceLines } from "@/content/characters";
import { pairs } from "@/content/pairs";
import type { PairId, Side, Slug } from "@/content/types";

import type { FrameShape } from "@/components/frame/frame-shapes";

import { ART, type ArtImage } from "../art";
import { characterVars } from "../theme";

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
  readonly focus: string;
  readonly shape: FrameShape;
  readonly cutout: ArtImage | null;
  /** object-position for the cut-out in the preview panel. */
  readonly cutoutFocus: string;
  /** Signature voice line (public path) and its translation. */
  readonly voice: { readonly src: string; readonly en: string } | null;
  /** Accent tokens computed for the roster's world (Storm). */
  readonly vars: CSSProperties;
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
    const line = keyVoiceLines(c.slug)[0] ?? c.voice[0];
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
      focus: `${art.focus.x}% ${art.focus.y}%`,
      shape: art.shape,
      cutout: art.cutout,
      cutoutFocus: art.cutoutAligned ? `${art.focus.x}% ${art.focus.y}%` : "50% 12%",
      voice: line ? { src: `/${line.file}`, en: line.en } : null,
      vars: characterVars(c.palette, "storm", art.accent),
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
