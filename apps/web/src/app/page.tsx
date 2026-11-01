import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { siteCopy } from "@/content/site-copy";
import { BeforeAfter } from "@/features/home/before-after/BeforeAfter";
import {
  fanArtTotal,
  getContrast,
  getCounters,
  getFanArt,
  getPortalPairs,
  getRoster,
  getVersusPairings,
} from "@/features/home/data";
import { TwoDoors } from "@/features/home/doors/TwoDoors";
import { HallOfFame } from "@/features/home/hall/HallOfFame";
import { PortalHero } from "@/features/home/hero/PortalHero";
import { Manifesto } from "@/features/home/manifesto/Manifesto";
import { TheTen } from "@/features/home/ten/TheTen";
import { VersusStage } from "@/features/home/versus/VersusStage";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "The Aspirants: Someone is always waiting." },
  description: siteCopy.meta.home,
};

export default function HomePage() {
  return (
    <>
      <PortalHero pairs={getPortalPairs()} />
      <Manifesto counters={getCounters()} />
      <VersusStage pairings={getVersusPairings()} />
      <BeforeAfter contrast={getContrast()} />
      <TheTen cards={getRoster()} />
      <HallOfFame art={getFanArt()} total={fanArtTotal} />
      <TwoDoors />
      <NextFooter
        eyebrow="Next"
        label="About"
        sublabel="The world: its places, the Cycle, the Enders and what is left open."
        href={routes.about}
        image="/img/hero-stills/selena-obsidia-01.webp"
      />
    </>
  );
}
