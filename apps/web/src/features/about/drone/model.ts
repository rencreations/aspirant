/**
 * Facts of the drone's model that the scene (the lazy chunk) and the layer (which is not lazy)
 * both need. No three here.
 */

/**
 * The width of the model that an anchor's width stands for, in the model's metres. The body alone
 * is 0.44 wide and 0.54 long, and the wings reach further when they open: an anchor is about the
 * body seen three-quarter on with the wings at rest.
 */
export const BODY_METRES = 0.62;

/**
 * The still picture (`DRONE_STILL`), as `scripts/about/drone/build.cjs` reports it: its pixels and
 * how much of the model it shows across. The drone's own middle is the middle of the picture, so
 * the picture can be laid where the live drone would be, at the same size.
 */
export const STILL = { width: 1440, height: 740, metresAcross: 0.98334 } as const;
