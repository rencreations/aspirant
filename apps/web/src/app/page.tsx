import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "The Aspirants: Someone is always waiting." },
};

export default function HomePage() {
  return (
    <>
      <PageIntro
        code="01 / Home"
        title="The Aspirants"
        lead="Someone is always waiting. This archive tells the whole story of the ten Aspirants, start to finish."
        note="Home is being built. The portal hero, the versus stage and the roster land here next."
      />
      <NextFooter
        label="Experience"
        sublabel="The whole story, told as you scroll."
        href={routes.experience}
        image="/img/hero-stills/fanny-layla-01.webp"
      />
    </>
  );
}
