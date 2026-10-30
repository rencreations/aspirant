import type { Metadata } from "next";

import { characters } from "@/content/characters";
import { rosterCharacters, rosterPairs } from "@/features/character/roster/entries";
import { RosterIntroMount } from "@/features/character/roster/intro/roster-intro-lazy";
import { Roster } from "@/features/character/roster/roster";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Characters",
  description:
    "The ten Aspirants of Selrick Academy in five pairs, on one wall you scroll sideways: who they are, their sides, and a voice line from each.",
};

export default function CharactersPage() {
  const voiceLines = characters.reduce((sum, c) => sum + c.voice.length, 0);
  return (
    <>
      <Roster
        characters={rosterCharacters()}
        pairs={rosterPairs()}
        voiceLines={voiceLines}
        next={{ href: routes.collection, label: "The collection", name: "The collection" }}
      />
      <RosterIntroMount />
    </>
  );
}
