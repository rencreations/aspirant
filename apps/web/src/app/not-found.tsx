import type { Metadata } from "next";

import { StarGlyph } from "@/components/star-glyph";
import { StarButton } from "@/components/ui/star-button";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Signal lost",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section className="grid-hex relative shell flex min-h-[86svh] flex-col justify-center below-nav pb-sp-xl">
      <p className="mb-sp-m flex items-center gap-sp-2xs hud-label">
        <StarGlyph className="size-3 text-crimson" />
        Error 404 / Record not found
      </p>
      <h1 className="m-0 display text-step-7">Signal lost</h1>
      <p className="mt-sp-m mb-0 max-w-[34ch] serif text-step-3 text-text-dim italic">
        The terminal looked everywhere and found nothing at this address. That is all right. The
        lamp is still on at home.
      </p>
      <div className="mt-sp-l">
        <StarButton href={routes.home} pulse transitionLabel="Home">
          Back to the archive
        </StarButton>
      </div>
    </section>
  );
}
