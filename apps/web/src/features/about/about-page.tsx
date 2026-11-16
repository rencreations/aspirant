import { NextFooter } from "@/components/next-footer/next-footer";
import { routes } from "@/lib/site";

import { AboutRoot } from "./about-root";
import { DroneLayer } from "./drone/drone-layer";
import { Opening } from "./opening/opening";
import { Label } from "./sections/label";
import { Ledger } from "./sections/ledger";
import { Outro } from "./sections/outro";
import { Phases } from "./sections/phases";
import { Statement } from "./sections/statement";

/**
 * /about: what the Aspirants series is. One drone flies through the whole page: it writes the
 * title, lands beside it, shows off while the reel grows into its window, rolls through the
 * statement and then keeps the visitor company down the five phases. The story itself is read at
 * /story.
 */
export function AboutPage() {
  return (
    <AboutRoot>
      <Opening />
      <Statement />
      <Phases />
      <Ledger />
      <Label />
      <Outro />
      <DroneLayer />
      <NextFooter
        eyebrow="Next"
        label="Story"
        sublabel="Eighty-seven chapters in six acts, one chapter to a page."
        href={routes.story}
        image="/img/hero-stills/fanny-layla-01.webp"
      />
    </AboutRoot>
  );
}
