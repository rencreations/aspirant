"use client";

import { Drama } from "@/features/character/vexana/drama/drama";
import { useReturnTo } from "@/lib/use-return-to";

/**
 * `/story/interactive-drama/`: the official interactive drama on a page of its own. It is the
 * game and nothing else; the story page tells the reader why it matters.
 *
 * Its way out is the story. A visitor who was sent here by another page (`from=about` in the
 * address, `lib/return-to.ts`) is led back to that page instead.
 */
export function InteractiveDramaPage() {
  const back = useReturnTo();
  return <Drama back={back} />;
}
