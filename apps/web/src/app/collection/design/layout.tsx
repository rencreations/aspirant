import type { ReactNode } from "react";

import { LibraryRoom } from "@/features/library/library-room";

/**
 * The design room and every post of it. The room lives in the layout, so opening a post (the address
 * becomes `/collection/design/<slug>/`) does not remount it; the pages below draw nothing but the
 * words a search engine reads.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <LibraryRoom slug="design" />
      {children}
    </>
  );
}
