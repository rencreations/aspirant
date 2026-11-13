"use client";

/**
 * The place of the change of page into a comic in the root layout: nothing at all until one runs (its
 * code is fetched by the room ahead of time), then the layer that draws it. If the layer's code
 * cannot be loaded or throws, the job is dropped and the comic opens as a plain page.
 */
import { Component, lazy, Suspense, type ReactNode } from "react";

import { endComicJob, loadComicLayer, useComicJob, type ComicJob } from "./store";

const Overlay = lazy(loadComicLayer);

class Fallback extends Component<{ job: ComicJob; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.warn("The change of page into the comic failed; opening it as a plain page.", error);
    endComicJob(this.props.job.id);
    window.location.assign(this.props.job.href);
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function ComicLayer() {
  const job = useComicJob((st) => st.job);
  if (!job) return null;
  return (
    <Fallback key={job.id} job={job}>
      <Suspense fallback={null}>
        <Overlay job={job} />
      </Suspense>
    </Fallback>
  );
}
