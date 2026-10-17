import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { RosterHeader } from "@/features/character/roster/header";
import { rosterCharacters, rosterPairs } from "@/features/character/roster/entries";
import { Roster } from "@/features/character/roster/roster";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Characters",
  description:
    "The ten Aspirants of Selrick Academy in five pairs: who they are, their sides, and a voice line from each.",
};

export default function CharactersPage() {
  return (
    <>
      <RosterHeader />
      <section aria-label="Roster" className="shell pb-sp-xl">
        <Roster characters={rosterCharacters()} pairs={rosterPairs()} />
      </section>
      <NextFooter
        label="The collection"
        sublabel="Every film, song, comic and drawing, in one archive."
        href={routes.collection}
        image="/img/hero-stills/guinevere-vexana-01.webp"
      />
    </>
  );
}
