import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";

export const metadata: Metadata = characterMetadata("obsidia", "Obsidia, Skills");

/** The address of her Skills page. The picture, the drawers and the music come from the layout. */
export default function ObsidiaSkills() {
  return null;
}
