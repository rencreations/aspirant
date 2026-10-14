"use client";

import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

import { Toaster } from "@aspirant/ui/components/sonner";
import { TooltipProvider } from "@aspirant/ui/components/tooltip";

import { SmoothScroll } from "@/components/smooth-scroll";
import { getQueryClient } from "@/lib/query-client";

// Devtools only exist in development; the import is dead-code-eliminated in production builds.
const Devtools =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/devtools"), { ssr: false })
    : () => null;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(getQueryClient);
  // `storage` is undefined during static prerender, which makes the persister a no-op there.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: "aspirant-query-cache",
    }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
      >
        <TooltipProvider delayDuration={150}>
          <SmoothScroll />
          {children}
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
        <Devtools />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
