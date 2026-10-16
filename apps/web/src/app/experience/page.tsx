import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Experience",
  description:
    "Read the whole Aspirant story as a web novel. Scroll, and the narrator carries you through all twelve Parts.",
};

export default function ExperiencePage() {
  return (
    <>
      <PageIntro
        code="02 / Experience"
        title="Experience"
        lead="The story, told by scrolling. Twelve Parts, sixty chapters, one narrator."
        note="The web novel is being typeset. Parts will load here as you approach them."
      />
      <NextFooter
        label="Story"
        sublabel="The world explained: places, the Cycle, the Enders."
        href={routes.story}
        image="/img/hero-stills/selena-obsidia-01.webp"
      />
    </>
  );
}
