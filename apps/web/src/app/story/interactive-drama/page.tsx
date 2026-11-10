import type { Metadata } from "next";

import { InteractiveDramaPage } from "@/features/story/interactive-drama/drama-page";

export const metadata: Metadata = {
  title: "Interactive drama",
  description:
    "The official interactive drama of the story: six chapters, choices that branch, three endings. Play it in the browser.",
};

export default function Page() {
  return <InteractiveDramaPage />;
}
