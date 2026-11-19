/**
 * The eighteen official splash arts of the aspirants wall, as the preview window shows them: the
 * whole picture, full size. Written from `public/data/home/picks.json` (`wall.order`), which the media
 * workstream makes: `pictures.test.ts` keeps this file equal to it. It is small on purpose, because
 * `preload.ts` imports it and that is in the bundle of every page. No picture of fan art or of art made
 * for this site is in the list (design call 8).
 */

import { TILE_PICTURES } from "./tile-pictures";

export interface PreviewPicture {
  /** The id of the splash art in the collection (the same as the wall card's). */
  id: string;
  title: string;
  /** What the picture shows, for the window's description. */
  alt: string;
  chars: readonly string[];
  /** The library keys of the 1280 wide picture (shown at once) and of the full size one. */
  p: string;
  f: string;
  /** The full size picture's size. */
  w: number;
  h: number;
  /** The bytes of the full size file. */
  bytes: number;
}

export const PREVIEW_PICTURES: readonly PreviewPicture[] = [
  {
    id: "arts-splash-ruby-753f93",
    title: "Ruby, Mecha Maiden",
    alt: "Ruby with dark hair and pink ends swings a huge white and orange blade over a blue night city, with dark machine hands reaching in from the right.",
    chars: ["ruby"],
    p: "arts/v2/splash/arts-splash-ruby-753f93/p.webp",
    f: "arts/v2/splash/arts-splash-ruby-753f93/f.webp",
    w: 2560,
    h: 1440,
    bytes: 559054,
  },
  {
    id: "arts-splash-fanny-a4bc10",
    title: "Fanny, Blade of Kibou",
    alt: "Fanny with orange hair in a high ponytail leaps through a bright blue sky with a thin blade in each hand and a glass city behind her.",
    chars: ["fanny"],
    p: "arts/v2/splash/arts-splash-fanny-a4bc10/p.webp",
    f: "arts/v2/splash/arts-splash-fanny-a4bc10/f.webp",
    w: 2560,
    h: 1440,
    bytes: 549698,
  },
  {
    id: "arts-splash-change-1ca07f",
    title: "Chang'e, Tech Tensai",
    alt: "Chang'e with pink twin tails, a green streak, round glasses and rabbit ears reaches out from a white mecha in front of a glowing blue ring, with a city and distant flying shapes behind her.",
    chars: ["change"],
    p: "arts/v2/splash/arts-splash-change-1ca07f/p.webp",
    f: "arts/v2/splash/arts-splash-change-1ca07f/f.webp",
    w: 2560,
    h: 1440,
    bytes: 614942,
  },
  {
    id: "arts-splash-selena-0f1095",
    title: "Selena, Silverbolt Raiko",
    alt: "Selena with long golden hair and small horns flies forward with a grin in a blue and silver mecha suit, with small chibi faces floating in the corners.",
    chars: ["selena"],
    p: "arts/v2/splash/arts-splash-selena-0f1095/p.webp",
    f: "arts/v2/splash/arts-splash-selena-0f1095/f.webp",
    w: 2560,
    h: 1440,
    bytes: 542140,
  },
  {
    id: "arts-splash-lesley-62d7fb",
    title: "Lesley, Deadeye Spectre",
    alt: "Lesley with long blonde hair dives through the air above a pale city, aiming an orange and gold cannon with a large red and orange wing module behind her.",
    chars: ["lesley"],
    p: "arts/v2/splash/arts-splash-lesley-62d7fb/p.webp",
    f: "arts/v2/splash/arts-splash-lesley-62d7fb/f.webp",
    w: 2560,
    h: 1440,
    bytes: 527504,
  },
  {
    id: "arts-splash-fanny-layla-fighting-together-b306c0",
    title: "Fanny and Layla, fighting together",
    alt: "Layla with pink twin tails swings a huge white cannon across the frame while Fanny with orange hair dives in beside her, in a bright city of glass towers.",
    chars: ["fanny", "layla"],
    p: "arts/v2/splash/arts-splash-fanny-layla-fighting-together-b306c0/p.webp",
    f: "arts/v2/splash/arts-splash-fanny-layla-fighting-together-b306c0/f.webp",
    w: 3840,
    h: 2160,
    bytes: 819040,
  },
  {
    id: "arts-splash-guinevere-915d8d",
    title: "Guinevere, Daybreak Halo",
    alt: "Guinevere with long pale hair that fades to violet and a red bow leaps through the sky with gold star blades, round droids and glowing red crystals around her.",
    chars: ["guinevere"],
    p: "arts/v2/splash/arts-splash-guinevere-915d8d/p.webp",
    f: "arts/v2/splash/arts-splash-guinevere-915d8d/f.webp",
    w: 2560,
    h: 1440,
    bytes: 768532,
  },
  {
    id: "arts-splash-aspirants-on-a-photo-frame-76edb2",
    title: "The Aspirants on a photo frame",
    alt: "The ten Aspirants stand and crouch in a row on a large photo frame lying on a wooden desk, with a ribbon, tape and small props around it.",
    chars: [
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ],
    p: "arts/v2/splash/arts-splash-aspirants-on-a-photo-frame-76edb2/p.webp",
    f: "arts/v2/splash/arts-splash-aspirants-on-a-photo-frame-76edb2/f.webp",
    w: 1080,
    h: 697,
    bytes: 214206,
  },
  {
    id: "arts-splash-guinevere-vexana-fighting-moment-15320e",
    title: "Guinevere and Vexana, fighting moment",
    alt: "Vexana lunges with a dark spear at the left while Guinevere reaches out at the upper right, both under a dark spiked crown of violet energy.",
    chars: ["guinevere", "vexana"],
    p: "arts/v2/splash/arts-splash-guinevere-vexana-fighting-moment-15320e/p.webp",
    f: "arts/v2/splash/arts-splash-guinevere-vexana-fighting-moment-15320e/f.webp",
    w: 2560,
    h: 1440,
    bytes: 441748,
  },
  {
    id: "arts-splash-layla-f5d919",
    title: "Layla, Miss Hikari",
    alt: "Layla with long pink twin tails kneels behind a long white cannon while a round black droid with a cyan face floats in the foreground.",
    chars: ["layla"],
    p: "arts/v2/splash/arts-splash-layla-f5d919/p.webp",
    f: "arts/v2/splash/arts-splash-layla-f5d919/f.webp",
    w: 2560,
    h: 1440,
    bytes: 458304,
  },
  {
    id: "arts-splash-vexana-6a1b9d",
    title: "Vexana, Twilight Star",
    alt: "Vexana with silver blue hair stands on a rooftop at night in front of a huge dark mecha that holds a giant violet sword.",
    chars: ["vexana"],
    p: "arts/v2/splash/arts-splash-vexana-6a1b9d/p.webp",
    f: "arts/v2/splash/arts-splash-vexana-6a1b9d/f.webp",
    w: 2560,
    h: 1440,
    bytes: 756620,
  },
  {
    id: "arts-splash-obsidia-20fc59",
    title: "Obsidia, Imperatrix Arashi",
    alt: "Obsidia with long blonde and pink hair in a black gown raises one gloved hand in a ring of dark red light, a silver and pink weapon at her side.",
    chars: ["obsidia"],
    p: "arts/v2/splash/arts-splash-obsidia-20fc59/p.webp",
    f: "arts/v2/splash/arts-splash-obsidia-20fc59/f.webp",
    w: 2560,
    h: 1440,
    bytes: 574504,
  },
  {
    id: "arts-splash-fanny-layla-blue-sky-50c9d9",
    title: "Fanny and Layla, blue sky",
    alt: "Fanny and Layla stand together under a blue sky with white clouds and a city behind them.",
    chars: ["fanny", "layla"],
    p: "arts/v2/splash/arts-splash-fanny-layla-blue-sky-50c9d9/p.webp",
    f: "arts/v2/splash/arts-splash-fanny-layla-blue-sky-50c9d9/f.webp",
    w: 1000,
    h: 563,
    bytes: 126378,
  },
  {
    id: "arts-splash-guinevere-vexana-fighting-stance-fcfe98",
    title: "Guinevere and Vexana, fighting stance",
    alt: "Vexana in white and violet stands at the left and Guinevere in red and gold floats at the right with her droids, in front of a dark violet storm.",
    chars: ["guinevere", "vexana"],
    p: "arts/v2/splash/arts-splash-guinevere-vexana-fighting-stance-fcfe98/p.webp",
    f: "arts/v2/splash/arts-splash-guinevere-vexana-fighting-stance-fcfe98/f.webp",
    w: 2560,
    h: 1440,
    bytes: 674968,
  },
  {
    id: "arts-splash-fanny-layla-key-art-542b49",
    title: "Fanny and Layla, key art",
    alt: "Fanny and Layla leap through a bright sky with a long blade between them and the Aspirants logo at the top left.",
    chars: ["fanny", "layla"],
    p: "arts/v2/splash/arts-splash-fanny-layla-key-art-542b49/p.webp",
    f: "arts/v2/splash/arts-splash-fanny-layla-key-art-542b49/f.webp",
    w: 1200,
    h: 675,
    bytes: 219388,
  },
  {
    id: "arts-splash-guinevere-vexana-splash-20e865",
    title: "Guinevere and Vexana, splash art",
    alt: "Vexana's face in profile fills the left of the frame in pale violet light, while Guinevere flies toward the right and small figures fight in the distance.",
    chars: ["guinevere", "vexana"],
    p: "arts/v2/splash/arts-splash-guinevere-vexana-splash-20e865/p.webp",
    f: "arts/v2/splash/arts-splash-guinevere-vexana-splash-20e865/f.webp",
    w: 2560,
    h: 1440,
    bytes: 512658,
  },
  {
    id: "arts-splash-angela-64810d",
    title: "Angela, Cyber Cherubin",
    alt: "Angela with peach pink twin tails and large pink and white rabbit ear headphones sits in a sunny rest area at 8:31 AM, with a small chibi companion, a floating drone and a cup of bubble tea.",
    chars: ["angela"],
    p: "arts/v2/splash/arts-splash-angela-64810d/p.webp",
    f: "arts/v2/splash/arts-splash-angela-64810d/f.webp",
    w: 2560,
    h: 1440,
    bytes: 562228,
  },
  {
    id: "arts-splash-guinevere-raises-a-fist-9fa979",
    title: "Guinevere raises a fist",
    alt: "Guinevere raises one fist in a burst of colored rays, with two white droids and orange gloves floating around her.",
    chars: ["guinevere"],
    p: "arts/v2/splash/arts-splash-guinevere-raises-a-fist-9fa979/p.webp",
    f: "arts/v2/splash/arts-splash-guinevere-raises-a-fist-9fa979/f.webp",
    w: 1080,
    h: 1027,
    bytes: 306124,
  },
];

/**
 * Every picture the wall can open: the eighteen splash arts, then the wall-only stills
 * (`tile-pictures.ts`). The window steps through this list.
 */
export const ALL_PREVIEW_PICTURES: readonly PreviewPicture[] = [
  ...PREVIEW_PICTURES,
  ...TILE_PICTURES,
];
