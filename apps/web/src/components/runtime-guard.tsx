"use client";

import { useEffect } from "react";

import { createRejectionLogger, isChunkError, reloadOnce } from "@/lib/chunk-guard";
import { isOffline } from "@/lib/offline";

/**
 * Two safety nets that draw nothing. A tab opened before a deploy asks for files that are gone:
 * the first such failure reloads the page once (see `lib/chunk-guard.ts`). Offline it does not
 * reload (that would swap the page for the browser's dead end): it waits for the connection and
 * then reloads once. And a promise that nobody caught is written to the console once, instead of
 * an endless run of red lines.
 */
export function RuntimeGuard() {
  useEffect(() => {
    let waiting = false;
    const report = createRejectionLogger((message) => {
      console.warn(`[aspirants] unhandled rejection: ${message}`);
    });
    const recover = () => {
      if (!isOffline()) {
        reloadOnce();
        return;
      }
      waiting = true;
    };
    const onOnline = () => {
      if (!waiting) return;
      waiting = false;
      reloadOnce();
    };
    const onError = (e: ErrorEvent) => {
      if (isChunkError(e.error ?? e.message)) recover();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkError(e.reason)) {
        e.preventDefault();
        recover();
        return;
      }
      report(e.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}
