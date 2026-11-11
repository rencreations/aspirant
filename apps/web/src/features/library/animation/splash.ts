import type { CharacterSlug } from "@/lib/slugs";

/** A character's splash art for the panel picture, with the point to keep in frame when it is cropped. */
export interface Splash {
  /** A path in `public/`, to go through `asset()`. */
  src: string;
  /**
   * Where to hold the picture in its frame, as fractions (0 to 1): use it as `object-position`
   * with `object-fit: cover`. It keeps the character's face in view in a narrow, tall frame (a
   * phone held upright) and in a short, wide one (a phone on its side), and changes little on a
   * screen of the picture's own shape.
   */
  focus: { x: number; y: number };
}

/** One picture: its size in pixels, the centre of the face (fractions), and its weight. */
interface Art {
  w: number;
  h: number;
  face: { x: number; y: number };
  bytes: number;
}

// splash:begin (written by scripts/library/animation/splash.py, do not edit by hand)
const ART: Readonly<Record<CharacterSlug, Art>> = {
  selena: { w: 2560, h: 1440, face: { x: 0.665, y: 0.25 }, bytes: 308438 },
  obsidia: { w: 2560, h: 1440, face: { x: 0.485, y: 0.15 }, bytes: 313354 },
  guinevere: { w: 2227, h: 1440, face: { x: 0.5632, y: 0.35 }, bytes: 404978 },
  vexana: { w: 2227, h: 1440, face: { x: 0.5402, y: 0.43 }, bytes: 385528 },
  lesley: { w: 2227, h: 1440, face: { x: 0.5229, y: 0.33 }, bytes: 262306 },
  change: { w: 2227, h: 1440, face: { x: 0.5632, y: 0.32 }, bytes: 311760 },
  ruby: { w: 2227, h: 1440, face: { x: 0.3563, y: 0.31 }, bytes: 271562 },
  angela: { w: 2227, h: 1440, face: { x: 0.5402, y: 0.27 }, bytes: 279644 },
  layla: { w: 2227, h: 1440, face: { x: 0.5402, y: 0.47 }, bytes: 216422 },
  fanny: { w: 2227, h: 1440, face: { x: 0.5287, y: 0.34 }, bytes: 253700 },
};
// splash:end

/** The narrowest frame the focus is worked out for (a phone held upright), width over height. */
const TALL = 390 / 844;
/** The widest (a phone on its side). */
const WIDE = 844 / 390;
/** In a short frame the face sits this far down from its top edge, so the body shows under it. */
const HEAD_ROOM = 0.4;

/**
 * Where to hold a picture of `aspect` (width over height) so that `face` stays in view: across, the
 * face is centred in the narrowest frame; down, it sits `HEAD_ROOM` from the top of the shortest
 * one. Both are clamped so the picture always covers its frame. Pure.
 */
export function framePoint(
  face: { x: number; y: number },
  aspect: number,
): { x: number; y: number } {
  const across = (seen: number, at: number, lead: number) => {
    if (seen >= 1) return 0.5;
    const start = Math.min(Math.max(at - seen * lead, 0), 1 - seen);
    return start / (1 - seen);
  };
  // Of the picture, this much shows across in the narrowest frame, and this much down in the widest.
  const seenW = Math.min(1, TALL / aspect);
  const seenH = Math.min(1, aspect / WIDE);
  const r = (v: number) => Math.round(v * 1000) / 1000;
  return { x: r(across(seenW, face.x, 0.5)), y: r(across(seenH, face.y, HEAD_ROOM)) };
}

/** The picture shown before a character's welcome starts: her official splash art. */
export function splashFor(slug: CharacterSlug): Splash {
  const art = ART[slug];
  return {
    src: `/img/library/animation/splash/${slug}.webp`,
    focus: framePoint(art.face, art.w / art.h),
  };
}
