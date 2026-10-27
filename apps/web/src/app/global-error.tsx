"use client";

import { useEffect } from "react";

import { isChunkError, reloadOnce } from "@/lib/chunk-guard";

/**
 * The last resort: the layout itself failed, so nothing of the site (styles, fonts, providers) can
 * be counted on. It carries its own page and its own styles, and offers a reload and a way home.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkError(error)) reloadOnce();
    else console.error("[aspirants] fatal error:", error.digest ?? error.message);
  }, [error]);

  const home = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
  const button = {
    minHeight: 44,
    padding: "12px 24px",
    borderRadius: 999,
    border: "1px solid currentColor",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontWeight: 600,
    cursor: "pointer",
  } as const;

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f4f6f9",
          color: "#140e26",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <main role="alert" style={{ maxWidth: 460 }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, letterSpacing: "0.18em", opacity: 0.7 }}>
            THE ASPIRANTS
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: 44, lineHeight: 1.05 }}>Static on the line</h1>
          <p style={{ margin: "0 0 24px", fontSize: 18, lineHeight: 1.5 }}>
            The page could not start. Nothing you did caused it. Reload to try again.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              style={button}
              onClick={() => {
                reset();
                window.location.reload();
              }}
            >
              Reload
            </button>
            <a href={home} style={{ ...button, display: "inline-flex", alignItems: "center" }}>
              Back to the archive
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
