/**
 * Builds the Home page view models from the typed content. Server only: `app/page.tsx`
 * calls these at build time and passes plain props to the client islands, so the character
 * bible, the voice tables and the fan art list never enter the client bundle.
 */
import fanartFile from "../../../public/data/fanart.json";

import { characters, getCharacter } from "@/content/characters";
import { pairs } from "@/content/pairs";
import { chapterLabel, chapters, getChapterMeta, parts } from "@/content/story";
import type { Slug } from "@/content/types";
import { contrasts } from "@/content/world";
import { siteCopy } from "@/content/site-copy";
import type { ExternalHref } from "@/lib/site";

import type {
  ContrastView,
  CounterView,
  FanArtView,
  PortalFigure,
  PortalPair,
  RosterCard,
  VersusPairing,
  VersusSide,
  VoiceRef,
} from "./types";

function voice(slug: Slug, n: number): VoiceRef {
  const line = getCharacter(slug).voice.find((v) => v.n === n);
  if (!line) throw new Error(`Missing voice line ${slug} ${n}`);
  return { file: line.file, en: line.en, jp: line.jpTitle };
}

const forms = siteCopy.character.forms;

function figure(
  slug: Slug,
  extra: Omit<PortalFigure, "slug" | "name" | "aspirantName" | "jp" | "world">,
): PortalFigure {
  const c = getCharacter(slug);
  return {
    slug,
    name: c.name,
    aspirantName: c.aspirantName,
    jp: c.jp.script,
    world: c.side,
    ...extra,
  };
}

/** The three portal pairs of the hero, in switcher order. */
export function getPortalPairs(): readonly PortalPair[] {
  return [
    {
      id: "vexana",
      tab: "Vexana",
      tabNote: "Two forms",
      hold: [0.51, 0.25],
      align: [-0.315, 0.02],
      base: figure("vexana", {
        formLabel: forms.normal,
        glow: "#c9b6ff",
        glow2: "#ff6ac8",
        tint: "#1a1036",
        image: "/img/portal/vexana/base.webp",
        depth: "/img/portal/vexana/depth.webp",
        opaque: false,
        backdrop: "/img/char/vexana/splash-sm.webp",
        alt: "Vexana, the Twilight Star, in her Aspirant form",
        voice: voice("vexana", 1),
      }),
      alt: {
        ...figure("vexana", {
          formLabel: forms.ender,
          glow: "#ff6ac8",
          glow2: "#9d7bff",
          tint: "#2a0b33",
          image: "/img/portal/vexana/alt.webp",
          depth: "/img/portal/vexana/depth-alt.webp",
          opaque: true,
          backdrop: "/img/char/vexana/extra-1.webp",
          alt: "Vexana in her Ender form, in profile, with blue-lavender hair and horns",
          voice: voice("vexana", 13),
        }),
        world: "storm",
      },
    },
    {
      id: "selena-obsidia",
      tab: "Selena / Obsidia",
      tabNote: "Creator and creation",
      hold: [0.51, 0.29],
      align: [0.01, -0.07],
      base: figure("selena", {
        formLabel: "Combat suit",
        glow: "#a6dcff",
        glow2: "#5ce1ff",
        tint: "#0b1a33",
        image: "/img/portal/selena-obsidia/base.webp",
        depth: "/img/portal/selena-obsidia/depth.webp",
        opaque: false,
        backdrop: "/img/char/selena/splash-sm.webp",
        alt: "Selena, Silverbolt Raiko, in her combat suit",
        voice: voice("selena", 16),
      }),
      alt: figure("obsidia", {
        formLabel: "Imperatrix",
        glow: "#ff5468",
        glow2: "#ffcf5c",
        tint: "#2b0710",
        image: "/img/portal/selena-obsidia/alt.webp",
        depth: "/img/portal/selena-obsidia/depth-alt.webp",
        opaque: false,
        backdrop: "/img/char/obsidia/splash-sm.webp",
        alt: "Obsidia, Imperatrix Arashi, in a long black gown",
        voice: voice("obsidia", 14),
      }),
    },
    {
      id: "guinevere-vexana",
      tab: "Guinevere / Vexana",
      tabNote: "Partners",
      hold: [0.36, 0.25],
      align: [0.15, -0.01],
      base: figure("guinevere", {
        formLabel: forms.normal,
        glow: "#ffcf5c",
        glow2: "#ff8a5c",
        tint: "#2a1508",
        image: "/img/portal/guinevere-vexana/base.webp",
        depth: "/img/portal/guinevere-vexana/depth.webp",
        opaque: false,
        backdrop: "/img/char/guinevere/splash-sm.webp",
        alt: "Guinevere, the Daybreak Halo, in her Aspirant form",
        voice: voice("guinevere", 13),
      }),
      alt: figure("vexana", {
        formLabel: forms.normal,
        glow: "#b59cff",
        glow2: "#ff6ac8",
        tint: "#170d33",
        image: "/img/portal/guinevere-vexana/alt.webp",
        depth: "/img/portal/guinevere-vexana/depth-alt.webp",
        opaque: false,
        backdrop: "/img/char/vexana/splash-sm.webp",
        alt: "Vexana, the Twilight Star, in her Aspirant form",
        voice: voice("vexana", 1),
      }),
    },
  ];
}

function side(
  slug: Slug,
  data: Omit<VersusSide, "slug" | "name" | "title" | "voice">,
  line: number,
  title?: string,
): VersusSide {
  const c = getCharacter(slug);
  return { slug, name: c.name, title: title ?? c.aspirantName, voice: voice(slug, line), ...data };
}

/** The three pairings of the versus stage. Left is Daybreak, right is Storm. */
export function getVersusPairings(): readonly VersusPairing[] {
  const portrait = { width: 1100, height: 1375 } as const;
  const splash = { width: 800, height: 450 } as const;
  return [
    {
      id: "selena-obsidia",
      tab: "Selena / Obsidia",
      title: "Creator and creation",
      note: "Made so alike, standing on two sides.",
      day: side(
        "selena",
        {
          line: getCharacter("selena").tagline,
          idle: { src: "/img/char/selena/splash-sm.webp", ...splash },
          idlePosition: "80% 30%",
          active: {
            src: "/img/portal/selena-obsidia/base.webp",
            ...portrait,
            position: "50% 20%",
            cutout: true,
          },
          alt: "Selena in her combat suit",
        },
        16,
      ),
      storm: side(
        "obsidia",
        {
          line: getCharacter("obsidia").tagline,
          idle: { src: "/img/char/obsidia/splash-sm.webp", ...splash },
          idlePosition: "47% 25%",
          active: {
            src: "/img/portal/selena-obsidia/alt.webp",
            ...portrait,
            position: "50% 15%",
            cutout: true,
          },
          alt: "Obsidia in a long black gown",
        },
        14,
      ),
    },
    {
      id: "vexana",
      tab: "Vexana / Vexana",
      title: "One girl, two forms",
      note: "The Twilight Star, in her Aspirant form and in her Ender form.",
      day: side(
        "vexana",
        {
          line: "Violet eyes, white gloves, and the Emblem at her collar.",
          idle: { src: "/img/char/vexana/splash-sm.webp", ...splash },
          idlePosition: "78% 45%",
          active: {
            src: "/img/portal/vexana/base.webp",
            ...portrait,
            position: "50% 18%",
            cutout: true,
          },
          alt: "Vexana in her Aspirant form",
        },
        1,
        forms.normal,
      ),
      storm: side(
        "vexana",
        {
          line: "Silver-lavender hair fading to magenta, and small gold-edged horns.",
          idle: { src: "/img/char/vexana/extra-1.webp", width: 1440, height: 3200 },
          idlePosition: "50% 22%",
          active: {
            src: "/img/portal/vexana/alt.webp",
            ...portrait,
            position: "30% 25%",
            cutout: false,
          },
          alt: "Vexana in her Ender form",
        },
        13,
        forms.ender,
      ),
    },
    {
      id: "layla-fanny",
      tab: "Layla / Fanny",
      title: "Rival first, partner after",
      note: "Their coupling score was 2.1, the highest in the school.",
      day: side(
        "layla",
        {
          line: getCharacter("layla").tagline,
          idle: { src: "/img/char/layla/splash-sm.webp", ...splash },
          idlePosition: "72% 40%",
          active: {
            src: "/img/char/layla/splash.webp",
            width: 2048,
            height: 1152,
            position: "71% 35%",
            cutout: false,
          },
          alt: "Layla with her cannon",
        },
        18,
      ),
      storm: side(
        "fanny",
        {
          line: getCharacter("fanny").tagline,
          idle: { src: "/img/char/fanny/splash-sm.webp", ...splash },
          idlePosition: "57% 30%",
          active: {
            src: "/img/char/fanny/extra-1.webp",
            width: 1272,
            height: 1800,
            position: "50% 20%",
            cutout: true,
          },
          alt: "Fanny in flight",
        },
        18,
      ),
    },
  ];
}

/** Face position in each official splash (percent of width and height). */
const FACE: Readonly<Record<Slug, readonly [number, number]>> = {
  fanny: [0.57, 0.3],
  layla: [0.72, 0.4],
  ruby: [0.37, 0.3],
  angela: [0.77, 0.27],
  lesley: [0.55, 0.27],
  change: [0.75, 0.25],
  guinevere: [0.6, 0.33],
  vexana: [0.79, 0.47],
  obsidia: [0.47, 0.22],
  selena: [0.8, 0.27],
};

/**
 * object-position that centres a point of a 16:9 image in a portrait card (aspect 3:4) under
 * object-fit: cover.
 */
function centreOn([fx, fy]: readonly [number, number]): string {
  const cardAspect = 3 / 4;
  const scaledW = (1 / cardAspect) * (16 / 9);
  const px = (fx * scaledW - 0.5) / (scaledW - 1);
  const clampP = (v: number) => Math.min(1, Math.max(0, v));
  return `${(clampP(px) * 100).toFixed(1)}% ${(fy * 100).toFixed(0)}%`;
}

/** The ten, in queue order, for the rail. */
export function getRoster(): readonly RosterCard[] {
  return characters.map((c) => {
    const pair = pairs.find((p) => p.id === c.pair);
    const partner = c.partnerSlug ? getCharacter(c.partnerSlug).name : "";
    return {
      slug: c.slug,
      order: c.order,
      name: c.name,
      aspirantName: c.aspirantName,
      jp: c.jp.script,
      partner,
      pairColours: pair ? pair.colours : [c.palette.primary, c.palette.secondary],
      primary: c.palette.primary,
      world: c.side,
      objectPosition: centreOn(FACE[c.slug]),
      voice: voice(c.slug, c.keyQuotes[0] ?? 1),
    };
  });
}

function chapterName(id: string): string {
  const meta = getChapterMeta(id);
  return meta ? chapterLabel(meta) : "";
}

/** The Dawnbreak 978 contrast, with our two headlines. */
export function getContrast(): ContrastView {
  const c = contrasts.find((x) => x.id === "dawnbreak-978");
  if (!c) throw new Error("Missing the dawnbreak-978 contrast");
  return {
    place: c.before.headline.split(":")[0] ?? c.place,
    before: {
      line: siteCopy.home.beforeAfter.before,
      quote: c.before.quote,
      chapter: chapterName(c.before.chapterId),
    },
    after: {
      line: siteCopy.home.beforeAfter.after,
      quote: c.after.quote,
      chapter: chapterName(c.after.chapterId),
    },
  };
}

/** Live counter strip under the manifesto. */
export function getCounters(): readonly CounterView[] {
  return [
    { value: characters.length, label: "Aspirants" },
    { value: pairs.length, label: "Pairs" },
    { value: chapters.filter((c) => c.number !== null).length, label: "Chapters" },
    { value: parts.length, label: "Parts" },
  ];
}

interface FanArtRecord {
  id: string;
  character: string;
  title: string | null;
  url: string | null;
  urlConfidence: string;
  credit: string;
  color: string;
  file: string;
  fileSm: string;
  width: number;
  height: number;
}

/** Hand-picked for the hall: a mix of pairs, aspect ratios and artists. */
const HALL_PICKS = [
  "both-bukkavyi-1",
  "layla-lyd3r-1",
  "fanny-artstation-1",
  "both-ichichan96-1",
  "layla-x-1",
  "fanny-linkedin-1",
  "both-xiaodanjoe-1",
  "layla-marilzu-1",
  "fanny-twonya-1",
  "layla-reddit-1",
  "both-ichichan96-2",
  "fanny-pixiv-1",
  "layla-pixiv-2",
  "fanny-reddit-2",
] as const;

function isExternal(url: string | null): url is ExternalHref {
  return url !== null && /^https?:\/\//.test(url);
}

/** Fan art for the hall of fame, with credits. Links only where a URL is known. */
export function getFanArt(): readonly FanArtView[] {
  const items = (fanartFile as { items: FanArtRecord[] }).items;
  return HALL_PICKS.flatMap((id) => {
    const item = items.find((x) => x.id === id);
    if (!item) return [];
    const character =
      item.character === "fanny" || item.character === "layla" ? item.character : "both";
    return [
      {
        id: item.id,
        title: item.title,
        character,
        credit: item.credit,
        href: item.urlConfidence !== "none" && isExternal(item.url) ? item.url : null,
        src: `/${item.file}`,
        thumb: `/${item.fileSm}`,
        width: item.width,
        height: item.height,
        color: item.color,
      },
    ];
  });
}

/** Total pieces in the archive, for the hall's link to the Collection. */
export const fanArtTotal: number = (fanartFile as { items: unknown[] }).items.length;
