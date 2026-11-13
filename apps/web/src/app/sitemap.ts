import fs from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";

import { OBSIDIA_PAGE_NAMES, obsidiaRoute } from "@/features/character/obsidia/routes";
import { SELENA_PAGE_NAMES, selenaRoute } from "@/features/character/selena/routes";
import { chapters } from "@/content/story";
import { chapterHref, END_HREF } from "@/features/story/chapter-href";
import { ARTS_SEGMENTS } from "@/features/library/arts/core/routes";
import { COLLECTION_SLUGS, VIDEO_ROOMS } from "@/features/library/types";
import { LEGAL_ROUTES } from "@/lib/legal";
import { characterRoute, collectionRoute, navItems, siteConfig } from "@/lib/site";
import { CHARACTER_SLUGS } from "@/lib/slugs";

export const dynamic = "force-static";

/** The addresses of the posts of the design room, from its data file. */
function designSlugs(): string[] {
  const file = path.join(process.cwd(), "public", "data", "library", "design.json");
  if (!fs.existsSync(file)) return [];
  return (
    JSON.parse(fs.readFileSync(file, "utf8")) as { items: Array<{ slug: string }> }
  ).items.map((p) => p.slug);
}

const STORY_PAGES = [
  "/character/vexana/story/academic",
  "/character/vexana/story/ender",
  "/character/guinevere/story/alone",
  "/character/guinevere/story/partner",
] as const;

/** Absolute URL with the base path and the trailing slash the static export uses. */
function absolute(path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/+$/, "");
  return `${siteConfig.url}${siteConfig.basePath}${clean}/`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...navItems.map(({ href }) => ({
      url: absolute(href),
      lastModified,
      priority: href === "/" ? 1 : 0.8,
    })),
    // The ten rooms of the collection.
    ...COLLECTION_SLUGS.map((slug) => ({
      url: absolute(collectionRoute(slug)),
      lastModified,
      priority: 0.7,
    })),
    // The two rooms of Video, and the full screen page of each character in Animation.
    ...VIDEO_ROOMS.map((room) => ({
      url: absolute(collectionRoute(`video/${room}`)),
      lastModified,
      priority: 0.6,
    })),
    // The rooms of Arts: the sub-pages of Official, Fanart, and Cosplay with a page for each Aspirant.
    ...ARTS_SEGMENTS.map((room) => ({
      url: absolute(collectionRoute(`arts/${room}`)),
      lastModified,
      priority: 0.6,
    })),
    { url: absolute(collectionRoute("arts/cosplay")), lastModified, priority: 0.6 },
    ...CHARACTER_SLUGS.map((slug) => ({
      url: absolute(collectionRoute(`arts/cosplay/${slug}`)),
      lastModified,
      priority: 0.5,
    })),
    ...CHARACTER_SLUGS.map((slug) => ({
      url: absolute(collectionRoute(`animation/${slug}`)),
      lastModified,
      priority: 0.5,
    })),
    // Every post of the design room has its own page.
    ...designSlugs().map((slug) => ({
      url: absolute(collectionRoute(`design/${slug}`)),
      lastModified,
      priority: 0.4,
    })),
    // The story is read one chapter to a page, and ends on a page of its own.
    ...chapters.map((chapter) => ({
      url: absolute(chapterHref(chapter.id)),
      lastModified,
      priority: 0.6,
    })),
    { url: absolute(END_HREF), lastModified, priority: 0.5 },
    ...CHARACTER_SLUGS.map((slug) => ({
      url: absolute(characterRoute(slug)),
      lastModified,
      priority: 0.6,
    })),
    // Their three pages have an address of their own.
    ...SELENA_PAGE_NAMES.map((page) => ({
      url: absolute(selenaRoute(page)),
      lastModified,
      priority: 0.5,
    })),
    ...OBSIDIA_PAGE_NAMES.map((page) => ({
      url: absolute(obsidiaRoute(page)),
      lastModified,
      priority: 0.5,
    })),
    // The two story pages of the long-scroll pair have an address of their own too.
    ...STORY_PAGES.map((path) => ({ url: absolute(path), lastModified, priority: 0.5 })),
    // The terms, the privacy policy and the takedown page.
    ...Object.values(LEGAL_ROUTES).map((path) => ({
      url: absolute(path),
      lastModified,
      priority: 0.3,
    })),
  ];
}
