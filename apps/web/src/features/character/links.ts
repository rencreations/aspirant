import type { Route } from "next";

import type { ChapterId } from "@/content/types";

/**
 * Link to a chapter in the Experience reader, for example `/experience/#c12`. The reader
 * gives each chapter (and interlude) an element with the chapter id.
 */
export function experienceHref(chapterId: ChapterId): Route {
  return `/experience/#${chapterId}` as Route;
}
