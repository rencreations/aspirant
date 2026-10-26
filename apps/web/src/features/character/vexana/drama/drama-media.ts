/**
 * Where the files of the interactive drama are. `scripts/vexana/drama.py` makes every file named
 * here (the film, a 1280 wide poster, a 480 wide thumbnail, and for each id of the official tree
 * the official thumbnail, which is the card of the answer that leads to it).
 */
const DIR = "/video/vexana/drama";

/** The film of an episode (`file` of a node in drama-graph.ts). */
export const dramaVideo = (file: string) => `${DIR}/${file}.mp4`;

/** A clean frame of the film, no dialogue box on it: the picture shown before it plays. */
export const dramaPoster = (file: string) => `${DIR}/${file}-poster.webp`;

/** A small version of the poster, for the level select. */
export const dramaThumb = (file: string) => `${DIR}/${file}-thumb.webp`;
