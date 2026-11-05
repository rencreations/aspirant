"use client";

import { useEffect } from "react";

import { asset } from "@/lib/asset";
import { routes } from "@/lib/site";

/** Sends `/collections/<name>` to `/collection/<name>`. */
export function CollectionsRedirect() {
  useEffect(() => {
    const rest = window.location.pathname.replace(/^.*\/collections\/?/u, "").replace(/\/+$/u, "");
    const target = rest ? `${routes.collection}/${rest}/` : `${routes.collection}/`;
    window.location.replace(asset(target) + window.location.search + window.location.hash);
  }, []);
  return (
    <div className="shell below-nav" style={{ minHeight: "60vh" }}>
      <h1 className="display text-step-5">The collection has moved</h1>
      <p>
        <a className="link" href={asset(`${routes.collection}/`)}>
          Open the collection
        </a>
      </p>
    </div>
  );
}
