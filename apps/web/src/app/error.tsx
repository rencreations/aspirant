"use client";

import { useEffect } from "react";

import { StarGlyph } from "@/components/star-glyph";
import { isChunkError, reloadOnce } from "@/lib/chunk-guard";
import { siteConfig } from "@/lib/site";

/**
 * A page that threw while it was drawn. The visitor gets a way back in two clicks and nothing
 * technical. When the cause is a file that went missing in a new deploy, the page reloads once by
 * itself, which is what fixes it.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (isChunkError(error)) reloadOnce();
    else console.error("[aspirants] page error:", error.digest ?? error.message);
  }, [error]);

  return (
    <section
      role="alert"
      className="grid-hex relative shell flex min-h-[86svh] flex-col justify-center below-nav pb-sp-xl"
    >
      <p className="mb-sp-m flex items-center gap-sp-2xs hud-label">
        <StarGlyph className="size-3 text-crimson" />
        Something broke on this page
      </p>
      <h1 className="m-0 display text-step-7">Static on the line</h1>
      <p className="mt-sp-m mb-0 max-w-[36ch] serif text-step-3 text-text-dim italic">
        This page did not load as it should. Nothing you did caused it. Try again, or go back to the
        archive.
      </p>
      <div className="mt-sp-l flex flex-wrap gap-sp-s">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 cursor-pointer rounded-full border border-current px-6 py-3 text-[0.9375rem] font-semibold"
        >
          Try again
        </button>
        {/* A plain link: the page transition may be what broke. */}
        <a
          href={`${siteConfig.basePath}/`}
          className="inline-flex min-h-11 items-center rounded-full px-6 py-3 text-[0.9375rem] font-semibold underline underline-offset-4"
        >
          Back to the archive
        </a>
      </div>
    </section>
  );
}
