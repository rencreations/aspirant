import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import type { StoryIndex } from "@/content/story-types";
import { Book } from "@/features/experience/reader/Book";
import { routes } from "@/lib/site";

// The front matter ("Before you begin") is read at build time, so the opening is static HTML.
import storyIndexJson from "../../../public/data/story/index.json";

export const metadata: Metadata = {
  title: "Experience",
  description:
    "Read the whole Aspirant story as a web novel. Scroll, and the narrator carries you through all twelve Parts.",
};

const front = (storyIndexJson as unknown as StoryIndex).beforeYouBegin;

export default function ExperiencePage() {
  return (
    <>
      <Book front={front} />
      <NextFooter
        eyebrow="Next"
        label="The world"
        sublabel="Places, the Cycle, the Enders, and what the story leaves open."
        href={routes.story}
        image="/img/hero-stills/selena-obsidia-01.webp"
      />
    </>
  );
}
