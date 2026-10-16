import type { Metadata } from "next";

import { KitBody } from "./kit-body";

export const metadata: Metadata = {
  title: "Kit",
  description: "Design system reference for The Aspirants. Internal page.",
  robots: { index: false, follow: false },
};

/** Visual QA surface: every component and variant in both worlds. Not linked from the nav. */
export default function KitPage() {
  return <KitBody />;
}
