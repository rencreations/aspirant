import type { Metadata } from "next";

import { LegacyRedirect } from "@/features/story/legacy-redirect";

export const metadata: Metadata = {
  title: "Story",
  robots: { index: false, follow: true },
};

/**
 * The story used to be read here. It lives at /story now, one Part to a page. A static export has no
 * server redirects, so this small page sends an old link (and an old `#c12` chapter link) on.
 */
export default function ExperienceMoved() {
  return <LegacyRedirect />;
}
