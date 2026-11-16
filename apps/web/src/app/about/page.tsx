import type { Metadata } from "next";

import { siteCopy } from "@/content/site-copy";
import { AboutPage } from "@/features/about/about-page";

export const metadata: Metadata = {
  title: "About",
  description: siteCopy.meta.about,
};

export default function Page() {
  return <AboutPage />;
}
