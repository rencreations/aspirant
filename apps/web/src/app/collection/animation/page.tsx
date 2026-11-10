import type { Metadata } from "next";

import { LibraryRoom } from "@/features/library/library-room";
import { getCollection } from "@/features/library/registry";

const meta = getCollection("animation");

export const metadata: Metadata = { title: meta.name, description: meta.line };

/** The carousel of the ten. Each character's full screen view is `/collection/animation/<slug>`. */
export default function Page() {
  return <LibraryRoom slug="animation" />;
}
