import { NextFooter } from "@/components/next-footer/next-footer";
import { routes } from "@/lib/site";

import { BeforeAfter } from "./before-after/before-after";
import { Intro } from "./intro/intro";
import { PlacesIndex } from "./places/places-index";

/** /story: the world explained, in contrast and diagrams. The narrative itself is /experience. */
export function StoryPage() {
  return (
    <>
      <Intro />
      <PlacesIndex />
      <BeforeAfter />
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
