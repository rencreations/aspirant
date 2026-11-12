import type { Metadata } from "next";

import { TermsPage } from "@/features/legal/terms";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms of The Aspirants, a fan-made archive: what is ours and what is not, how to use the site, and how to ask for something to be taken down.",
};

export default function Page() {
  return <TermsPage />;
}
