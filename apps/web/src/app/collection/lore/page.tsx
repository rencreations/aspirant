import type { Metadata } from "next";

import { getCollection } from "@/features/library/registry";

const meta = getCollection("lore");

export const metadata: Metadata = { title: meta.name, description: meta.line };

/** Nothing here: the room is drawn by the layout. */
export default function Page() {
  return null;
}
