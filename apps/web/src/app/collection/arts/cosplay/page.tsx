import type { Metadata } from "next";

import { CosplayView } from "@/features/library/arts/core/arts-room";

export const metadata: Metadata = {
  title: "Cosplay",
  description: "Cosplay of the ten Aspirants, a page for each, each piece credited.",
};

/** Cosplay, the roster of the ten Aspirants. */
export default function Page() {
  return <CosplayView />;
}
