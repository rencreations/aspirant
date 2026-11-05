"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the comic room is built. Replace the whole file. */
export default function ComicPage() {
  const { data } = useLibraryData("comic");
  return (
    <LibraryShell slug="comic" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
