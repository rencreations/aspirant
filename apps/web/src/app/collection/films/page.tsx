import type { Metadata } from "next";

import { FilmsRedirect } from "@/features/library/video/films-redirect";

export const metadata: Metadata = { title: "Films", robots: { index: false } };

/** The old address of the Films room. It only forwards to `/collection/video/films`. */
export default function Page() {
  return <FilmsRedirect />;
}
