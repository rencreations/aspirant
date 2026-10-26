import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { StoryPage } from "@/features/character/guinevere/story/story-page";

export const metadata: Metadata = characterMetadata("guinevere", "Guinevere, Alone");

export default function GuinevereAloneStory() {
  return <StoryPage side="alone" />;
}
