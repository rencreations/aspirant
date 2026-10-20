import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";

export const metadata: Metadata = characterMetadata("obsidia", "Obsidia, Gallery");

/** The address of her Gallery page. The picture, the drawers and the music come from the layout. */
export default function ObsidiaGallery() {
  return null;
}
