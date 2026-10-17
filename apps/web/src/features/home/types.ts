/**
 * Serializable view models for the Home page. The server page (`app/page.tsx`) builds them
 * from `@/content` in `data.ts` and hands them to the client islands as props, so the full
 * character and voice modules never ship to the browser.
 */
import type { CharacterSlug } from "@/lib/slugs";
import type { ExternalHref } from "@/lib/site";

type World = "daybreak" | "storm";

/** One voice line, ready to play: `file` is a relative public path (wrap in asset()). */
export interface VoiceRef {
  readonly file: string;
  readonly en: string;
  readonly jp: string;
}

/** One figure of a portal pair (the base form or the form behind the portal). */
export interface PortalFigure {
  readonly slug: CharacterSlug;
  readonly name: string;
  readonly aspirantName: string;
  readonly jp: string;
  readonly formLabel: string;
  readonly world: World;
  /** Bright glow colour for the rim, embers and accents (hex). */
  readonly glow: string;
  /** Second glow colour, blended along the rim (hex). */
  readonly glow2: string;
  /** Deep colour for the other world seen through the portal (hex). */
  readonly tint: string;
  /** Portrait image, 1100 x 1375, public path. */
  readonly image: string;
  /** Matching depth map (near is white), public path. */
  readonly depth: string;
  /** True when the image has no transparent background. */
  readonly opaque: boolean;
  /** Splash art used blurred behind the figure, public path. */
  readonly backdrop: string;
  readonly alt: string;
  readonly voice: VoiceRef;
}

export interface PortalPair {
  readonly id: "vexana" | "selena-obsidia" | "guinevere-vexana";
  /** Tab title, for example "Selena / Obsidia". */
  readonly tab: string;
  /** Short line under the tab title. */
  readonly tabNote: string;
  /** The base face, in figure UV (0 to 1, top left origin): "Hold portal open" opens here. */
  readonly hold: readonly [number, number];
  /**
   * Where the other form's face sits relative to this one's, in figure UV. The portal view of
   * the other form is shifted by this much so face meets face.
   */
  readonly align: readonly [number, number];
  readonly base: PortalFigure;
  readonly alt: PortalFigure;
}

export interface VersusSide {
  readonly slug: CharacterSlug;
  readonly title: string;
  readonly name: string;
  readonly line: string;
  readonly idle: { readonly src: string; readonly width: number; readonly height: number };
  readonly active: {
    readonly src: string;
    readonly width: number;
    readonly height: number;
    readonly position: string;
    readonly cutout: boolean;
  };
  readonly alt: string;
  readonly idlePosition: string;
  readonly voice: VoiceRef;
}

export interface VersusPairing {
  readonly id: string;
  readonly tab: string;
  readonly title: string;
  readonly note: string;
  readonly day: VersusSide;
  readonly storm: VersusSide;
}

export interface RosterCard {
  readonly slug: CharacterSlug;
  readonly order: number;
  readonly name: string;
  readonly aspirantName: string;
  readonly jp: string;
  readonly pairName: string;
  readonly pairColours: readonly [string, string];
  readonly primary: string;
  readonly world: World;
  readonly objectPosition: string;
  readonly voice: VoiceRef;
}

export interface ContrastView {
  readonly place: string;
  readonly before: { readonly line: string; readonly quote: string; readonly chapter: string };
  readonly after: { readonly line: string; readonly quote: string; readonly chapter: string };
}

export interface FanArtView {
  readonly id: string;
  readonly title: string | null;
  readonly character: "fanny" | "layla" | "both";
  readonly credit: string;
  readonly href: ExternalHref | null;
  readonly src: string;
  readonly thumb: string;
  readonly width: number;
  readonly height: number;
  readonly color: string;
}

export interface CounterView {
  readonly value: number;
  readonly label: string;
}
