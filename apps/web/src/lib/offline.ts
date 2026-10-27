/** Fired when a click on an internal link is held back because the device is offline. */
export const OFFLINE_BLOCKED_EVENT = "aspirants:offline-blocked";

/** True when the browser knows it has no connection. Without the API it is taken as online. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}
