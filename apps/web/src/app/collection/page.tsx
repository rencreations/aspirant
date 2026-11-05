import type { Metadata } from "next";

import { ShelfPage } from "@/features/library/shelf/shelf-page";

export const metadata: Metadata = {
  title: "Collection",
  description:
    "The Aspirant library in ten rooms: arts, films, music, voice lines, fan art, comics, lore, design and animation, and what fits nowhere else.",
};

export default function Page() {
  return <ShelfPage />;
}
