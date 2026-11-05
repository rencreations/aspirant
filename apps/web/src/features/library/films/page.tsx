"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the films room is built. Replace the whole file. */
export default function FilmsPage() {
  const { data } = useLibraryData("films");
  return (
    <LibraryShell slug="films" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
