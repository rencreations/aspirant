import type { Metadata } from "next";

import { StoryPage } from "@/features/story/story-page";

export const metadata: Metadata = {
  title: "Story",
  description:
    "The world of Aspirant explained: Dawnbreak, Selrick Academy, the Cycle, the Enders and what the story leaves open.",
};

export default function Page() {
  return <StoryPage />;
}
