import type { Metadata } from "next";

import { StoryLanding } from "@/features/story/landing/story-landing";

export const metadata: Metadata = {
  title: "Story",
  description:
    "Read the whole Aspirant story: a prologue and 87 chapters in six acts, one chapter to a page, with your place kept.",
};

export default function Page() {
  return <StoryLanding />;
}
