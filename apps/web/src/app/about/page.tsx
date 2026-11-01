import type { Metadata } from "next";

import { AboutPage } from "@/features/about/about-page";

export const metadata: Metadata = {
  title: "About",
  description:
    "The world of Aspirant explained: Dawnbreak, Selrick Academy, the Cycle, the Enders and what the story leaves open.",
};

export default function Page() {
  return <AboutPage />;
}
