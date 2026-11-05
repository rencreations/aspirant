"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the fanart room is built. Replace the whole file. */
export default function FanartPage() {
  const { data } = useLibraryData("fanart");
  return (
    <LibraryShell slug="fanart" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
