"use client";

import { RouteError } from "@/features/character/vexana/shared/route-error";

/** Vexana's page and her two story pages: a calm way out when something breaks. */
export default function VexanaError(props: { error: Error; reset: () => void }) {
  return <RouteError {...props} />;
}
