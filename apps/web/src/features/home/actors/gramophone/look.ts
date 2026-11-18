/**
 * How the gramophone is drawn: the anime look of the shared toon system (`../shared/toon.ts`).
 * The model has one material for all five parts (a baked atlas with its metal flag on the whole
 * material), so the default rule would call the wooden cabinet metal too: each part is told its
 * look by its node name instead.
 *
 * Brass is gold: three crisp bands that turn from a pale lit gold to an orange brown shade (a hue
 * shift, never a grey) and a small hard glint. The cabinet is flat warm brown with one light band on
 * the faces the key reaches. The platter is flat brass with no glint (one normal over a whole
 * disc: a glint would turn all of it white at one angle).
 */
import type { ToonPick } from "../shared/toon";

/** The node names of the five parts (`gramophone-rig.json`). */
export const PART = {
  cabinet: "cabinet",
  horn: "horn",
  crank: "crank_mesh",
  platter: "platter_mesh",
  soundbox: "soundbox_mesh",
} as const;

/** Brass: a pale gold lit step, an orange brown shade, a deeper red brown core. */
export const BRASS: NonNullable<ToonPick["tune"]> = {
  cut: [-0.08, 0.2],
  soft: 0.035,
  shade: [0.8, 0.54, 0.46],
  deep: [0.5, 0.28, 0.34],
  lit: [1.02, 0.97, 0.84],
  sat: 1.45,
  rim: 0.18,
  rimWidth: 0.2,
  glint: 0.85,
  glintSize: 0.993,
};

/** Wood: two bands, a warm red brown shade, a faint rim, no glint. */
export const WOOD: NonNullable<ToonPick["tune"]> = {
  cut: [-0.25, 0.12],
  soft: 0.04,
  shade: [0.62, 0.48, 0.56],
  deep: [0.45, 0.32, 0.46],
  lit: [1.5, 1.32, 1.15],
  sat: 1.3,
  rim: 0.25,
  rimWidth: 0.22,
  glint: 0,
  glintSize: 0.97,
};

/** The pick for one node of the model, by its name. An unknown name is drawn as brass. */
export function pickFor(name: string): ToonPick {
  switch (name) {
    case PART.cabinet:
      return { look: "default", tune: WOOD };
    case PART.platter:
      return { look: "metal", tune: { ...BRASS, glint: 0, rim: 0.3 } };
    default:
      return { look: "metal", tune: BRASS };
  }
}
