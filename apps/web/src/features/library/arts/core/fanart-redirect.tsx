"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";

import { artsRoute } from "./routes";

/**
 * `/collection/fanart?i=<id>` was the address of the Fanart room. It forwards to
 * `/collection/arts/fanart`, keeping the query.
 */
export function FanartRedirect() {
  useEffect(() => {
    window.location.replace(
      asset(`${artsRoute("fanart")}/`) + window.location.search + window.location.hash,
    );
  }, []);
  return (
    <div className="shell below-nav" style={{ minHeight: "60vh" }}>
      <h1 className="display text-step-5">Fanart has moved</h1>
      <p>
        <a className="link" href={asset(`${artsRoute("fanart")}/`)}>
          Open the fanart
        </a>
      </p>
    </div>
  );
}
