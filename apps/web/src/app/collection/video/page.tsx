import type { Metadata } from "next";

import VideoChooser from "@/features/library/video/chooser";
import { getCollection } from "@/features/library/registry";

const meta = getCollection("video");

export const metadata: Metadata = { title: meta.name, description: meta.line };

export default function Page() {
  return <VideoChooser />;
}
