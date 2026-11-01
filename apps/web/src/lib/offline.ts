/** Fired when a click on an internal link is held back because the device is offline. */
export const OFFLINE_BLOCKED_EVENT = "aspirants:offline-blocked";

/** True when the browser knows it has no connection. Without the API it is taken as online. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Resolves when the browser says the connection is back, or after `maxMs`, whichever comes first.
 * The flag of a browser can be wrong (a VPN, a virtual network), so a download that waits here
 * still tries again every few seconds instead of waiting for an event that never comes.
 */
export function whenOnline(maxMs = 8000): Promise<void> {
  if (!isOffline() || typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = window.setTimeout(done, maxMs);
    window.addEventListener("online", done);
  });
}
