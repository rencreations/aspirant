import { NextFooter } from "@/components/next-footer/next-footer";
import { routes } from "@/lib/site";

import { BeforeAfter } from "./before-after/before-after";
import { Cycle } from "./cycle/cycle";
import { Hierarchy } from "./hierarchy/hierarchy";
import { CouplingLab } from "./lab/coupling-lab";
import { Intro } from "./intro/intro";
import { Timeline } from "./timeline/timeline";
import { WhosWho } from "./who/whos-who";
import { buildAlso, buildPeople } from "./who/whos-who-data";
import { OpenQuestions } from "./open/open-questions";
import { buildGlossary } from "./glossary/glossary-data";
import { Glossary } from "./glossary/glossary";
import { PlacesIndex } from "./places/places-index";

/** /story: the world explained, in contrast and diagrams. The narrative itself is /experience. */
export function StoryPage() {
  return (
    <>
      <Intro />
      <PlacesIndex />
      <BeforeAfter />
      <Cycle />
      <Hierarchy />
      <CouplingLab />
      <Timeline />
      <WhosWho people={buildPeople()} also={buildAlso()} />
      <OpenQuestions />
      <Glossary entries={buildGlossary()} />
      <NextFooter
        eyebrow="Next"
        label="The ten"
        sublabel="Meet the ten Aspirants, starting with Fanny."
        href={routes.characters}
        image="/img/char/fanny/splash.webp"
      />
    </>
  );
}
