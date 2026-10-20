import type { ViewerImage } from "@/components/image-viewer/image-viewer";

import type { VoicePart } from "../about/voice-card";
import { GALLERY_IMAGES } from "./gallery-media.generated";

/** The voice lines she speaks in her mecha form. Every other line is her normal form. */
export const MECHA_LINES: readonly number[] = [
  7, 9, 12, 19, 20, 21, 22, 27, 28, 29, 31, 33, 34, 38, 46,
];

/**
 * Line 9 has two parts with a pause between them: the first in her normal form, the second in her
 * mecha form. The file is cut in two (scripts/selena/gallery-assets.py), so each form plays only
 * its own part.
 */
export const LINE_NINE = {
  a: {
    name: "first part",
    file: "audio/voice/selena/09-a.m4a",
    jp: "ああ、なんか危険な香りがする",
    en: "Ahh, I'm getting a dangerous vibe.",
  },
  b: {
    name: "second part",
    file: "audio/voice/selena/09-b.m4a",
    jp: "今の私、すっごく危険かも",
    en: "Right now, I might be super dangerous.",
  },
} as const satisfies Record<"a" | "b", VoicePart>;

export type VoiceForm = "normal" | "mecha";

export interface VoiceEntry {
  n: number;
  part?: VoicePart;
}

/** The lines of one form, in the order of their numbers. */
export function linesFor(all: readonly number[], form: VoiceForm): VoiceEntry[] {
  const mecha = new Set(MECHA_LINES);
  const out: VoiceEntry[] = [];
  for (const n of all) {
    if (n === 9) {
      out.push({ n, part: form === "mecha" ? LINE_NINE.b : LINE_NINE.a });
    } else if (mecha.has(n) === (form === "mecha")) {
      out.push({ n });
    }
  }
  return out;
}

// Art ---------------------------------------------------------------------------------------------

export interface Credit {
  name: string;
  platform: string;
  /** Where the piece was posted. */
  href?: string;
}

interface Piece {
  /** The file name, without the folder and the extension (public/img/selena/gallery). */
  id: keyof typeof GALLERY_IMAGES;
  title: string;
  alt: string;
}

export interface ArtGroup {
  /** Pictures of one post or one set. */
  id: string;
  label: string;
  credit: Credit;
  pieces: readonly Piece[];
  /** The pieces are the steps of one drawing, in order. */
  process?: boolean;
}

const MOONTON: Credit = { name: "Moonton", platform: "Mobile Legends: Bang Bang" };

const instagram = (user: string): Credit => ({
  name: user,
  platform: "Instagram",
  href: `https://www.instagram.com/${user}/`,
});
const instagramPost = (user: string, code: string): Credit => ({
  name: user,
  platform: "Instagram",
  href: `https://www.instagram.com/p/${code}/`,
});

/** The official art, first in the list. */
export const OFFICIAL: ArtGroup = {
  id: "official",
  label: "Official art",
  credit: MOONTON,
  pieces: [
    {
      id: "official-splash",
      title: "Selena, splash art",
      alt: "Selena in her mecha form leaping through a burst of blue and white light",
    },
    {
      id: "official-pawns-gambit",
      title: "The Pawn's Gambit, title card",
      alt: "The title card of The Pawn's Gambit: Selena smiling in front of dark chains",
    },
    {
      id: "official-day-of-enders",
      title: "Day of Enders, title card",
      alt: "The title card of Day of Enders, with the logos of the two characters",
    },
  ],
};

/** One artist with four posts: three are one picture each, one is a carousel of seven (a drawing process). */
const JLEN = "jlen_ismyname";

/** The fan art, in the order shown. Every piece carries the artist's name and a link. */
export const FAN_ART: readonly ArtGroup[] = [
  {
    id: "falguni_shikder",
    label: "falguni_shikder",
    credit: instagram("falguni_shikder"),
    pieces: [
      {
        id: "fan-falguni_shikder",
        title: "On the rooftop with her classmates",
        alt: "Selena on a rooftop with her classmates, drawn in a bright, soft style",
      },
    ],
  },
  {
    id: "kitemo_chan",
    label: "kitemo_chan",
    credit: instagram("kitemo_chan"),
    pieces: [
      {
        id: "fan-kitemo_chan",
        title: "Mecha flight",
        alt: "Selena in her mecha form in flight, in front of a golden dragon helm",
      },
    ],
  },
  {
    id: "lococo20220304",
    label: "lococo20220304",
    credit: instagram("lococo20220304"),
    pieces: [
      {
        id: "fan-lococo20220304",
        title: "Group scene in a viewfinder",
        alt: "A group scene with Selena, framed like the view through a camera",
      },
    ],
  },
  {
    id: "nryo_c",
    label: "nryo_c",
    credit: instagram("nryo_c"),
    pieces: [
      {
        id: "fan-nryo_c",
        title: "By the rooftop pool",
        alt: "Selena and her pink-haired friend in school uniform by a rooftop pool",
      },
    ],
  },
  {
    id: "ig-DcCCUwTTTo8",
    label: "Instagram post, artist not named",
    credit: {
      name: "Unnamed artist",
      platform: "Instagram",
      href: "https://www.instagram.com/p/DcCCUwTTTo8/",
    },
    pieces: [
      {
        id: "fan-ig-DcCCUwTTTo8",
        title: "Comic sketch panels",
        alt: "Two comic sketch panels of Selena",
      },
    ],
  },
  {
    id: "deniisuuu",
    label: "deniisuuu",
    credit: { name: "deniisuuu", platform: "X", href: "https://x.com/deniisuuu" },
    pieces: [
      {
        id: "fan-deniisuuu",
        title: "Mecha pose",
        alt: "Selena in a mecha pose beside a silver dragon",
      },
    ],
  },
];

/** The four posts of one artist, kept together under one heading. */
export const JLEN_POSTS: readonly ArtGroup[] = [
  {
    id: "jlen-Db_FVUklFvn",
    label: "Post 1",
    credit: instagramPost(JLEN, "Db_FVUklFvn"),
    pieces: [
      {
        id: "jlen-Db_FVUklFvn",
        title: "Laughing sketch",
        alt: "A loose sketch of Selena laughing",
      },
    ],
  },
  {
    id: "jlen-DcGVlIWxBDd",
    label: "Post 2",
    credit: instagramPost(JLEN, "DcGVlIWxBDd"),
    pieces: [
      {
        id: "jlen-DcGVlIWxBDd",
        title: "Mecha jump, line art",
        alt: "Line art of Selena's mecha form in a jump, with touches of ice blue",
      },
    ],
  },
  {
    id: "jlen-DcogkTpmfu4",
    label: "Post 3",
    credit: instagramPost(JLEN, "DcogkTpmfu4"),
    pieces: [
      {
        id: "jlen-DcogkTpmfu4",
        title: "Two characters, sketch",
        alt: "A sketch of two characters, with the word WIN written across it",
      },
    ],
  },
  {
    id: "jlen-DeZuC3imbns",
    label: "Post 4, the drawing process",
    credit: instagramPost(JLEN, "DeZuC3imbns"),
    process: true,
    pieces: [
      {
        id: "jlen-DeZuC3imbns-1",
        title: "The finished piece",
        alt: "The finished drawing: Selena and two friends, in colour",
      },
      {
        id: "jlen-DeZuC3imbns-2",
        title: "Rough sketch",
        alt: "The first rough sketch of the drawing",
      },
      {
        id: "jlen-DeZuC3imbns-3",
        title: "Refined sketch",
        alt: "The sketch again, with cleaner lines",
      },
      {
        id: "jlen-DeZuC3imbns-4",
        title: "Colour study: Selena",
        alt: "A colour study of Selena",
      },
      {
        id: "jlen-DeZuC3imbns-5",
        title: "Colour study: the pink-haired character",
        alt: "A colour study of the pink-haired character",
      },
      {
        id: "jlen-DeZuC3imbns-6",
        title: "Colour study: the classroom",
        alt: "A colour study of the classroom behind them",
      },
      {
        id: "jlen-DeZuC3imbns-7",
        title: "Finished version, posted on X",
        alt: "The finished drawing as it was posted on X",
      },
    ],
  },
];

export const JLEN_HANDLE = JLEN;
export const JLEN_PROFILE = instagram(JLEN);

/** The two TikToks in the fan art. The credit is the name in the file, linked to the video. */
export const TIKTOKS = [
  {
    id: "tiktok-bomboclau",
    title: "TikTok by @bomboclau_",
    credit: {
      name: "@bomboclau_",
      platform: "TikTok",
      href: "https://www.tiktok.com/@bomboclau_/video/7694259319201664277",
    },
  },
  {
    id: "tiktok-hashirama1697",
    title: "TikTok by @hashirama1697",
    credit: {
      name: "@hashirama1697",
      platform: "TikTok",
      href: "https://www.tiktok.com/@hashirama1697/video/7681495176833027345",
    },
  },
] as const satisfies ReadonlyArray<{ id: string; title: string; credit: Credit }>;

export const galleryImagePath = (id: string) => `/img/selena/gallery/${id}.webp`;
export const galleryThumbPath = (id: string) => `/img/selena/gallery/${id}-t.webp`;
export const galleryVideoPath = (id: string) => `/video/selena/gallery/${id}.mp4`;
export const galleryPosterPath = (id: string) => `/video/selena/gallery/${id}.webp`;

function buildViewerImages(): ViewerImage[] {
  const out: ViewerImage[] = [];
  const add = (group: ArtGroup, setLabel: string, shared: boolean) => {
    for (const piece of group.pieces) {
      const meta = GALLERY_IMAGES[piece.id];
      out.push({
        src: galleryImagePath(piece.id),
        thumb: galleryThumbPath(piece.id),
        alt: piece.alt,
        width: meta.w,
        height: meta.h,
        title: piece.title,
        set: shared ? group.id : piece.id,
        setLabel,
        credit: group.credit,
      });
    }
  };
  add(OFFICIAL, "Official art", true);
  for (const g of FAN_ART) add(g, `Fan art by ${g.credit.name.toLowerCase()}`, false);
  for (const g of JLEN_POSTS)
    add(g, `Fan art by ${JLEN}, ${g.label.toLowerCase()}`, g.pieces.length > 1);
  return out;
}

/** Every picture in the order shown (official, then fan art), for the viewer. */
export const VIEWER_IMAGES: readonly ViewerImage[] = buildViewerImages();

/** The place of a piece in the viewer's list. */
export function viewerIndex(id: string): number {
  return VIEWER_IMAGES.findIndex((v) => v.src === galleryImagePath(id));
}
