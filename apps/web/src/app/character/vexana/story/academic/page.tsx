import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { StoryPage } from "@/features/character/vexana/story/story-page";

export const metadata: Metadata = characterMetadata("vexana", "Vexana, the academic story");

export default function VexanaAcademicStory() {
  return <StoryPage side="academic" />;
}
