import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { PageIntro } from "@/components/page-intro";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Story",
  description:
    "The world of Aspirant explained: Dawnbreak, Selrick Academy, the Cycle, the Enders and what the story leaves open.",
};

export default function StoryPage() {
  return (
    <>
      <PageIntro
        code="03 / Story"
        title="Story"
        lead="Where you are, what came before, and what the story leaves open."
        note="The places index, the Cycle and the timeline arrive here next."
        theme="daybreak"
      />
      <NextFooter
        label="Characters"
        sublabel="Meet the ten Aspirants, starting with Fanny."
        href={routes.characters}
        image="/img/char/fanny/splash.webp"
      />
    </>
  );
}
