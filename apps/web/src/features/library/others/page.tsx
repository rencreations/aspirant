"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the others room is built. Replace the whole file. */
export default function OthersPage() {
  const { data } = useLibraryData("others");
  return (
    <LibraryShell slug="others" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
