import type { Metadata } from "next";

import { TakedownPage } from "@/features/legal/takedown/takedown-page";

export const metadata: Metadata = {
  title: "Copyright and takedown",
  description:
    "Ask for a picture, video, model or any other item to be removed from The Aspirants, and write the message in one step.",
};

export default function Page() {
  return <TakedownPage />;
}
