"use client";

import { SPLASH_ITEMS } from "./data";
import { SplashRoom } from "./room";

/**
 * Official, Splash art (`/collection/arts`): after east64films.com, one picture to a screen on an
 * endless vertical stepper with its own wheel, keys and touch. The data is read at build time, so
 * the list of pictures is in the page's HTML.
 */
export default function SplashPage() {
  return <SplashRoom items={SPLASH_ITEMS} />;
}
