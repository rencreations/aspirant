import type { Metadata } from "next";

import { NextFooter } from "@/components/next-footer/next-footer";
import { loadCatalog, toClientCatalog } from "@/features/collection/catalog";
import { CollectionPage } from "@/features/collection/collection-page";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Collection",
  description:
    "The Aspirant archive: films, music, comics, art, fan art and voice lines, with credits.",
};

export default function Page() {
  // Built once at export time. The client gets a slim copy (no voice text, no manifest).
  const catalog = toClientCatalog(loadCatalog());
  return (
    <>
      <CollectionPage catalog={catalog} />
      <NextFooter
        label="Home"
        sublabel="Back to the start. The lamp is on."
        href={routes.home}
        image="/img/char/vexana/splash.webp"
      />
    </>
  );
}
