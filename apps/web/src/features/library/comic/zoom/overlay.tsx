"use client";

import { Dive } from "./dive";
import type { ComicJob } from "./store";
import { Wipe } from "./wipe";

/** The layer's code: the dive for an official comic, the wipe for a fan comic. */
export default function Overlay({ job }: { job: ComicJob }) {
  return job.kind === "dive" ? <Dive job={job} /> : <Wipe job={job} />;
}
