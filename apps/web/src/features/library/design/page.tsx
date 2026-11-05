"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the design room is built. Replace the whole file. */
export default function DesignPage() {
  const { data } = useLibraryData("design");
  return (
    <LibraryShell slug="design" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
