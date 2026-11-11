import type { Metadata } from "next";

import { FanartRedirect } from "@/features/library/arts/core/fanart-redirect";

export const metadata: Metadata = { title: "Fanart", robots: { index: false } };

/** The old address of the Fanart room. It only forwards to `/collection/arts/fanart`. */
export default function Page() {
  return <FanartRedirect />;
}
