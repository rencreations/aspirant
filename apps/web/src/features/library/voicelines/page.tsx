"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the voicelines room is built. Replace the whole file. */
export default function VoicelinesPage() {
  const { data } = useLibraryData("voicelines");
  return (
    <LibraryShell slug="voicelines" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
