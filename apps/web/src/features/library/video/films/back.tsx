"use client";

import { BackToCollection } from "../../shell/room-chrome";

/**
 * The way out of the Films room: back to the page that opened the film (`&from=music` on a link
 * made by `videoHref`, `from=about` on a link of the About page), else to the shelf. The button
 * reads the address by itself (`useReturnTo`), and the strip keeps `from` when it rewrites `?i=`.
 */
export function FilmsBack() {
  return <BackToCollection tone="light" />;
}
