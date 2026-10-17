import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { siteCopy } from "@/content/site-copy";
import { getPortalPairs } from "@/features/home/data";
import { PortalHero } from "@/features/home/hero/PortalHero";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "The Aspirants: Someone is always waiting." },
  description: siteCopy.meta.home,
};

export default function HomePage() {
  return (
    <>
      <PortalHero pairs={getPortalPairs()} />
      <div id="what-is" />
      <NextFooter
        label="Experience"
        sublabel="The whole story, told as you scroll."
        href={routes.experience}
        image="/img/hero-stills/fanny-layla-01.webp"
      />
    </>
  );
}
