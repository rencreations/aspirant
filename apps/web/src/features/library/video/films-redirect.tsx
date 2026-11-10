"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";

import { videoRoomOf, videoRoute } from "./links";

/**
 * `/collection/films?i=<id>&t=<seconds>` was the address of a film. It forwards to the room that
 * holds the film now (Films for the ten, Others for the rest), keeping the query.
 */
export function FilmsRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = videoRoomOf(params.get("i") ?? "");
    window.location.replace(asset(`${videoRoute(room)}/`) + window.location.search);
  }, []);
  return (
    <div className="shell below-nav" style={{ minHeight: "60vh" }}>
      <h1 className="display text-step-5">The films have moved</h1>
      <p>
        <a className="link" href={asset(`${videoRoute("films")}/`)}>
          Open the films
        </a>
      </p>
    </div>
  );
}
