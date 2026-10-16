import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Collection",
  description:
    "The Aspirant archive: films, music, comics, art, fan art, 3D models and voice lines, with credits.",
};

export default function CollectionPage() {
  return (
    <>
      <PageIntro
        code="05 / Collection"
        title="Collection"
        lead="Films, music, comics, art, fan art, 3D and voice. Every piece, with credit."
        note="The archive terminal is being stocked."
      />
      <NextFooter
        label="Home"
        sublabel="Back to the start. The lamp is on."
        href={routes.home}
        image="/img/char/vexana/splash.webp"
      />
    </>
  );
}
