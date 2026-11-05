import type { ReactNode } from "react";

import { SearchHost } from "@/features/library/search/search-host";

/** The shelf and every room share the library search (the slash key opens it). */
export default function CollectionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SearchHost />
    </>
  );
}
