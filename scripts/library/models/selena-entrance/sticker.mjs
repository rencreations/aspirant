// `extras.sticker` of the Entrance file: where the room puts the owner's sticker over Selena's
// bottom in the idle clip, in the pelvis bone's own space (its world scale is 1, so the radius is
// metres). Measured by `node verify/sticker.mjs --find` (the method is written at the top of that
// file): the shorts and the bare skin between them and the stockings, seen from behind (the angle
// of the owner's screenshot), from behind and below and from below, at four times of the loop.
// `offset` is the middle of those points. It lies inside the body (the surface along the normal
// is at [0.0039, -0.087, 0.0149]), so a sticker that faces the camera there is centred on her
// bottom from all three angles; the room draws it over the body (no depth test, or moved toward
// the camera by its radius). `normal` is the way the patch faces; `radius` takes in 85 percent of
// it, so the back above it and the legs below stay in view. README.md lists the check pictures.
export const STICKER = {
  clip: "idle",
  bone: "Bip001_Pelvis",
  offset: [0.0275, 0.013, -0.0112],
  normal: [-0.2232, -0.9433, 0.2457],
  radius: 0.17,
};
