import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { LfRoute } from "@/features/character/layla-fanny/lf-route";

export const metadata: Metadata = characterMetadata("fanny");

export default function Page() {
  return <LfRoute who="fanny" />;
}
