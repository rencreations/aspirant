import type { PlayerVideo } from "@/components/video-player/player-overlay";

/**
 * The trailer of each phase, for the site's player. These are the files the pair pages already
 * play (declared in `features/character/layla-fanny/media.ts`, `lesley-change/media.ts`,
 * `vexana/media.ts` and `selena/gallery/gallery-media.ts`; the second pair's page gives its paths
 * in `duo/duo-media.ts`). Nothing is copied or encoded for this page. The paths are written here,
 * not imported, so the pair pages' data stays out of this page's code; a test checks every file.
 */
export interface PhaseTrailer {
  /** "01" to "05": the phase, in the order of release. */
  no: string;
  /** The film's own title. */
  title: string;
  year: string;
  video: PlayerVideo;
}

export const TRAILERS: readonly PhaseTrailer[] = [
  {
    no: "01",
    title: "Go For It! Aspirants!",
    year: "2022",
    video: {
      title: "Go For It! Aspirants!",
      poster: "/video/fanny-layla/trailer.jpg",
      captions: "/video/fanny-layla/trailer.vtt",
      sources: [{ label: "720p", height: 720, src: "/video/fanny-layla/trailer.mp4" }],
    },
  },
  {
    no: "02",
    title: "Awakening",
    year: "2022",
    video: {
      title: "Awakening",
      poster: "/video/ruby-angela/trailer.jpg",
      sources: [{ label: "540p", height: 540, src: "/video/ruby-angela/trailer.mp4" }],
    },
  },
  {
    no: "03",
    title: "Rekindled Light",
    year: "2024",
    video: {
      title: "Rekindled Light",
      poster: "/video/lesley-change/trailer.jpg",
      captions: "/video/lesley-change/trailer.vtt",
      sources: [{ label: "540p", height: 540, src: "/video/lesley-change/trailer.mp4" }],
    },
  },
  {
    no: "04",
    title: "Connection Lost",
    year: "2025",
    video: {
      title: "Connection Lost",
      poster: "/video/vexana/final-poster.webp",
      sources: [
        { label: "1080p", height: 1080, src: "/video/vexana/final.mp4" },
        { label: "810p", height: 810, src: "/video/vexana/final-1080.mp4" },
      ],
    },
  },
  {
    no: "05",
    title: "Day of Enders",
    year: "2026",
    video: {
      title: "Day of Enders",
      poster: "/img/selena/gallery/official-day-of-enders.webp",
      captions: "/video/selena-obsidia/trailer.vtt",
      sources: [
        { label: "810p", height: 810, src: "/video/selena/trailer-day-of-enders-810.mp4" },
        { label: "540p", height: 540, src: "/video/selena-obsidia/trailer.mp4" },
      ],
    },
  },
];

/** The newest phase: what the big play control opens. */
export const NEWEST: PhaseTrailer = TRAILERS[TRAILERS.length - 1]!;
