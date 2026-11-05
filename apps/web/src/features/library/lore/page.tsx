"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the lore room is built. Replace the whole file. */
export default function LorePage() {
  const { data } = useLibraryData("lore");
  return (
    <LibraryShell slug="lore" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
