import type { Metadata } from "next";

import { characterMetadata } from "@/features/character/metadata";
import { LcRoute } from "@/features/character/lesley-change/lc-route";

export const metadata: Metadata = characterMetadata("lesley");

export default function Page() {
  return <LcRoute who="lesley" />;
}
