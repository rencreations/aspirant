import type { ReactNode } from "react";

import { LibraryRoom } from "@/features/library/library-room";

/**
 * The lore room and every window of it. The room lives in the layout, so opening an entry (the
 * address becomes `/collection/lore/<slug>/`) does not remount it; the pages below draw nothing.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <LibraryRoom slug="lore" />
      {children}
    </>
  );
}
