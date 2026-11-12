import type { Metadata } from "next";

import { PrivacyPage } from "@/features/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What The Aspirants measures, who sees it and how to say no: Cloudflare Web Analytics, and Google Analytics only if you accept.",
};

export default function Page() {
  return <PrivacyPage />;
}
