import "@fontsource-variable/big-shoulders-display/wght";
import "@fontsource-variable/hanken-grotesk/wght";
import "@fontsource-variable/jetbrains-mono/wght";
import "@fontsource/instrument-serif/400";
import "@fontsource/instrument-serif/400-italic";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { FocusStar } from "@/components/focus-star";
import { HudFrame } from "@/components/hud/hud-frame";
import { LanternCursor } from "@/components/lantern-cursor";
import { LoaderGate, SHELL_ID } from "@/components/loader-gate";
import { SiteNav } from "@/components/nav/site-nav";
import { SiteProviders } from "@/components/site-providers";
import { ConsentBanner } from "@/features/legal/consent/consent-banner";
import { ComicLayer } from "@/features/library/comic/zoom/layer";
import { MorphLayer } from "@/features/story/morph/morph-layer";
import { bootScript } from "@/lib/boot-script";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name}: ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  // Resolved against the address of each page, so every route names itself as canonical.
  alternates: { canonical: "./" },
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    siteName: siteConfig.name,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f5f9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/*
 * Runs before first paint: marks JS, sets the pointer type and paints the gate cover. The script and
 * its rules are in `lib/boot-script.ts` (and `lib/home-arrival.ts` for the home page's own opening).
 */
const BOOT = bootScript(siteConfig.basePath);

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="daybreak" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <div className="gate-cover">
          <div className="gate-cover-inner">
            <p className="gate-cover-mark" aria-hidden="true">
              The Aspirants
            </p>
            <span className="gate-cover-bar" aria-hidden="true" />
            <div className="gate-cover-notes">
              <p className="gate-cover-note gate-cover-first">Loading the site</p>
              <p className="gate-cover-note gate-cover-slow">
                Slow connection. Still loading. The page opens when everything is loaded, with all
                its animations.
              </p>
            </div>
            <p className="gate-cover-note gate-cover-stuck">
              Still waiting for the site&apos;s files. <a href=".">Reload the page</a>
            </p>
          </div>
        </div>
        <SiteProviders>
          <div id={SHELL_ID}>
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <SiteNav />
            <HudFrame />
            <main id="main" tabIndex={-1} className="relative z-(--z-content)">
              {children}
            </main>
          </div>
          <MorphLayer />
          <ComicLayer />
          <LanternCursor />
          <FocusStar />
          <LoaderGate />
          <ConsentBanner />
        </SiteProviders>
        <noscript>
          <p className="noscript">
            This archive works best with JavaScript on. The whole text and every page still load
            without it.
          </p>
        </noscript>
      </body>
    </html>
  );
}
