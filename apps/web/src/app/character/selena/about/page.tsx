import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";

export const metadata: Metadata = characterMetadata("selena", "Selena, About");

/** The address of her About page. The picture, the drawers and the music come from the layout. */
export default function SelenaAbout() {
  return null;
}
