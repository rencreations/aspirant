import type { Metadata } from "next";

import { LibraryRoom } from "@/features/library/library-room";
import { getCollection } from "@/features/library/registry";

const meta = getCollection("voicelines");

export const metadata: Metadata = { title: meta.name, description: meta.line };

/**
 * The film, the ten Aspirants and a shortcut to each of the eight languages. The page of each
 * Aspirant is `/collection/voicelines/<slug>`, and the language is a parameter of that page.
 */
export default function Page() {
  return <LibraryRoom slug="voicelines" />;
}
