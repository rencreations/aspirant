import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { StoryPage } from "@/features/character/guinevere/story/story-page";

export const metadata: Metadata = characterMetadata("guinevere", "Guinevere, Partner");

export default function GuineverePartnerStory() {
  return <StoryPage side="partner" />;
}
