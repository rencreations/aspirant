import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";

export const metadata: Metadata = characterMetadata("obsidia");

/** Her own address. The picture is drawn by the layout. */
export default function ObsidiaRoot() {
  return null;
}
