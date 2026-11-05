"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the music room is built. Replace the whole file. */
export default function MusicPage() {
  const { data } = useLibraryData("music");
  return (
    <LibraryShell slug="music" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
