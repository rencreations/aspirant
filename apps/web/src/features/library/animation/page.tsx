"use client";

import { useLibraryData } from "../data";
import { LibraryShell } from "../shell/library-shell";

/** Placeholder until the animation room is built. Replace the whole file. */
export default function AnimationPage() {
  const { data } = useLibraryData("animation");
  return (
    <LibraryShell slug="animation" count={data ? data.items.length : null}>
      <div className="shell">
        <p>This room is being built.</p>
      </div>
    </LibraryShell>
  );
}
