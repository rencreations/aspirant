import type { ViewerImage } from "@/components/image-viewer/image-viewer";

import { GALLERY_IMAGES } from "./gallery-media.generated";

// Voice ------------------------------------------------------------------------------------------

export interface VoiceGroup {
  id: string;
  title: string;
  note: string;
  /** Voice line numbers, in the order shown. */
  lines: readonly number[];
}

/** All 41 of her lines, in six groups by what she is doing when she says them. */
export const VOICE_GROUPS: readonly VoiceGroup[] = [
  {
    id: "doctrine",
    title: "Her doctrine",
    note: "What she says of the Cycle and of her work.",
    lines: [1, 2, 3, 17, 34, 38, 39],
  },
  {
    id: "orders",
    title: "Orders to the fleet",
    note: "Short words to the Enders, and to the Matrix.",
    lines: [4, 5, 6, 7, 33],
  },
  {
    id: "board",
    title: "At the board",
    note: "A game she plays alone, and what she says over it.",
    lines: [8, 9, 10, 12, 16],
  },
  {
    id: "questions",
    title: "Her questions",
    note: "The thoughts she says aloud when nobody is listening.",
    lines: [13, 14, 20, 37, 40, 41],
  },
  {
    id: "defiance",
    title: "To those who stand against her",
    note: "How she speaks to a world that will not bow.",
    lines: [18, 19, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32],
  },
  {
    id: "selena",
    title: "To Selena",
    note: "The few lines that are for one person.",
    lines: [11, 15, 35, 36],
  },
];

// Art ---------------------------------------------------------------------------------------------

export interface Credit {
  name: string;
  platform: string;
  /** Where the piece was posted. */
  href?: string;
}

interface Piece {
  /** The file name, without the folder and the extension (public/img/obsidia/gallery). */
  id: keyof typeof GALLERY_IMAGES;
  title: string;
  alt: string;
}

export interface ArtGroup {
  id: string;
  label: string;
  credit: Credit;
  pieces: readonly Piece[];
}

const MOONTON: Credit = { name: "Moonton", platform: "Mobile Legends: Bang Bang" };

const instagram = (user: string): Credit => ({
  name: user,
  platform: "Instagram",
  href: `https://www.instagram.com/${user}/`,
});

/** The official art, first in the list. */
export const OFFICIAL: ArtGroup = {
  id: "official",
  label: "Official art",
  credit: MOONTON,
  pieces: [
    {
      id: "official-splash",
      title: "Obsidia, splash art",
      alt: "Obsidia in her skin Imperatrix Arashi, her long hair and her weapon streaming through a burst of pink light",
    },
    {
      id: "official-queens-endgame",
      title: "The Queen's Endgame, title card",
      alt: "The title card of The Queen's Endgame: Obsidia with a raised black clawed hand, in front of a black eclipse",
    },
    {
      id: "official-day-of-enders",
      title: "Day of Enders, title card",
      alt: "The title card of Day of Enders, with the logos of the two characters",
    },
  ],
};

/** The fan art, in the order shown. Every piece carries the artist's name and a link. */
export const FAN_ART: readonly ArtGroup[] = [
  {
    id: "haniwa_.20",
    label: "haniwa_.20",
    credit: instagram("haniwa_.20"),
    pieces: [
      {
        id: "fan-haniwa_.20",
        title: "Crouched in pink light",
        alt: "Obsidia with pale hair and a gold crown, crouched in pink light, with her silver beast weapon behind her",
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
        title: "In a red and gold storm",
        alt: "Obsidia in a red and gold storm, her long hair streaming and a huge dark shape behind her",
      },
    ],
  },
  {
    id: "falguni_shikder",
    label: "falguni_shikder",
    credit: instagram("falguni_shikder"),
    pieces: [
      {
        id: "fan-falguni_shikder",
        title: "On the rooftop, in the sun",
        alt: "A group of young women on a rooftop under a bright sky, drawn in a soft style",
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
        alt: "A group scene framed like the view through a camera, under a huge black eclipse",
      },
    ],
  },
  {
    id: "ig-Db_FVUklFvn",
    label: "jlen_ismyname",
    credit: {
      name: "jlen_ismyname",
      platform: "Instagram",
      href: "https://www.instagram.com/p/Db_FVUklFvn/",
    },
    pieces: [
      {
        id: "fan-ig-Db_FVUklFvn",
        title: "A sketch of her face",
        alt: "A loose pencil sketch of Obsidia's face, with short tousled hair and a faint smile",
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
        alt: "Two comic sketch panels: a blond girl with horns above, and Obsidia below",
      },
    ],
  },
  {
    id: "reddit-1tgcg5b",
    label: "Reddit commission, artist not named",
    credit: {
      name: "Unnamed artist",
      platform: "Reddit",
      href: "https://www.reddit.com/r/MobileLegendsGame/comments/1tgcg5b/obsidia_fanart_commision/",
    },
    pieces: [
      {
        id: "fan-reddit-1tgcg5b",
        title: "A commission in grey and gold",
        alt: "A tall drawing of Obsidia in grey and gold, with her name written at the bottom",
      },
    ],
  },
];

export const galleryImagePath = (id: string) => `/img/obsidia/gallery/${id}.webp`;
export const galleryThumbPath = (id: string) => `/img/obsidia/gallery/${id}-t.webp`;

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
  return out;
}

/** Every picture in the order shown (official, then fan art), for the viewer. */
export const VIEWER_IMAGES: readonly ViewerImage[] = buildViewerImages();

/** The place of a piece in the viewer's list. */
export function viewerIndex(id: string): number {
  return VIEWER_IMAGES.findIndex((v) => v.src === galleryImagePath(id));
}
