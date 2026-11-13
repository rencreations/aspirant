import type { Metadata } from "next";

import { LibraryRoom } from "@/features/library/library-room";
import { getCollection } from "@/features/library/registry";

const meta = getCollection("comic");

export const metadata: Metadata = { title: meta.name, description: meta.line };

/** The comic room: the two official webtoons and the fan comics. Each comic is a page of its own. */
export default function Page() {
  return <LibraryRoom slug="comic" />;
}
