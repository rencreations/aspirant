"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the arts room is built. Replace the whole file. */
export default function ArtsPage() {
  const { data } = useLibraryData("arts");
  return (
    <LibraryShell slug="arts" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
