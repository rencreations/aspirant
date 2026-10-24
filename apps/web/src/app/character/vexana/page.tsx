import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { nextCharacter } from "@/content/characters";
import { ART } from "@/features/character/art";
import { characterMetadata } from "@/features/character/metadata";
import { characterVars, readable } from "@/features/character/theme";
import { MusicCredit } from "@/features/character/vexana/music-credit";
import { VexanaPage } from "@/features/character/vexana/vexana-page";
import { characterRoute } from "@/lib/site";

export const metadata: Metadata = characterMetadata("vexana");

const pad = (n: number) => String(n).padStart(2, "0");

export default function VexanaRoot() {
  const next = nextCharacter("vexana");
  const art = ART[next.slug];
  return (
    <>
      <VexanaPage />
      <MusicCredit />
      <div
        data-theme="daybreak"
        style={{
          ...characterVars(next.palette, "daybreak", art.accent),
          position: "relative",
          background: "var(--bg)",
          color: "var(--text)",
        }}
      >
        <NextFooter
          eyebrow="Next in queue"
          label={next.name}
          sublabel={`${next.aspirantName}. Unit ${pad(next.order)} of 10. ${next.tagline}`}
          href={characterRoute(next.slug)}
          image={`/img/char/${next.slug}/splash.webp`}
          accent={readable(next.palette[art.accent.accent], "daybreak")}
        />
      </div>
    </>
  );
}
