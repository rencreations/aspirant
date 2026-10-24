import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { StoryPage } from "@/features/character/vexana/story/story-page";

export const metadata: Metadata = characterMetadata("vexana", "Vexana, the ender story");

export default function VexanaEnderStory() {
  return <StoryPage side="ender" />;
}
