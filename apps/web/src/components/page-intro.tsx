import { StarGlyph } from "@/components/star-glyph";
import { ThemeZone } from "@/components/theme-zone";
import type { ThemeName } from "@/lib/stores";

export interface PageIntroProps {
  /** HUD code line, for example "02 / Experience". */
  code: string;
  /** The page's h1. */
  title: string;
  /** One or two sentences under the title. */
  lead?: string;
  /** Optional status note in a small panel (for pages in progress). */
  note?: string;
  /** World for this block. Default "storm". */
  theme?: ThemeName;
}

/**
 * Page opening block: HUD code, a huge display h1, a serif lead and an optional status note.
 * Used by the route stubs; real pages replace it with their hero.
 */
export function PageIntro({ code, title, lead, note, theme = "storm" }: PageIntroProps) {
  return (
    <ThemeZone
      theme={theme}
      surface={theme !== "storm"}
      className="flex min-h-[min(78svh,46rem)] flex-col justify-end overflow-hidden below-nav pb-sp-xl"
    >
      <div
        className="grid-hex pointer-events-none absolute inset-0 opacity-70 fade-edges"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(60% 55% at 72% 38%, color-mix(in srgb, var(--glow) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative shell">
        <p className="mb-sp-m flex items-center gap-sp-2xs hud-label">
          <StarGlyph className="size-3 text-accent" />
          {code}
        </p>
        <h1 className="m-0 display text-step-8 break-words">{title}</h1>
        {lead && (
          <p className="mt-sp-m mb-0 max-w-[30ch] serif text-step-3 text-text-dim italic">{lead}</p>
        )}
        {note && (
          <p className="mt-sp-l mb-0 inline-flex max-w-full items-center gap-sp-xs border-l-2 border-accent bg-bg-2 px-sp-s py-sp-xs mono text-step--1 text-text-dim chamfer">
            <span className="hud-label text-accent">Status</span>
            <span>{note}</span>
          </p>
        )}
      </div>
    </ThemeZone>
  );
}
