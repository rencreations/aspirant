import type { Metadata } from "next";

import { HOME_DESCRIPTION, HOME_TITLE } from "@/features/home/content";
import { HomePage } from "@/features/home/home-page";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
};

export default function Page() {
  return <HomePage />;
}
