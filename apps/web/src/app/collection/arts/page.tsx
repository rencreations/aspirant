import type { Metadata } from "next";

import { ArtsRoomView } from "@/features/library/arts/core/arts-room";

export const metadata: Metadata = {
  title: "Splash art",
  description: "The official splash art of the Aspirants, one picture to a screen.",
};

/** Official, Splash art. The other sub-pages are `/collection/arts/<room>`. */
export default function Page() {
  return <ArtsRoomView room="splash" />;
}
