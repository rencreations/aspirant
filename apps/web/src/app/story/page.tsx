import type { Metadata } from "next";

import { StoryLanding } from "@/features/story/landing/story-landing";

export const metadata: Metadata = {
  title: "Story",
  description:
    "Read the whole Aspirant story: sixty chapters in twelve parts, one Part to a page, with your place kept.",
};

export default function Page() {
  return <StoryLanding />;
}
