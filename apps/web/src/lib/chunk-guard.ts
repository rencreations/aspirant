/**
 * Recovery from a stale tab. After a new deploy the files have new names, and a tab that was open
 * before asks for code that is gone: the browser reports a ChunkLoadError (or a failed dynamic
 * import). Reloading once fetches the new page. A flag in the tab's session stops a reload loop
 * (when the site really is down, one reload per minute at most).
 */

const CHUNK_ERRORS = [
  /ChunkLoadError/i,
  /Loading chunk [\w./-]+ failed/i,
  /Loading CSS chunk [\w./-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

/** The text of whatever was thrown, rejected or reported. */
function errorText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof Error) return `${input.name} ${input.message}`;
  if (typeof input === "object" && input !== null) {
    const { name, message } = input as { name?: unknown; message?: unknown };
    const n = typeof name === "string" ? name : "";
    const m = typeof message === "string" ? message : "";
    return `${n} ${m}`.trim();
  }
  return "";
}

/** True when the error means "a file of this site could not be loaded". */
export function isChunkError(input: unknown): boolean {
  const text = errorText(input);
  return text !== "" && CHUNK_ERRORS.some((re) => re.test(text));
}

export const RELOAD_KEY = "aspirants:chunk-reload";
export const RELOAD_WINDOW_MS = 60_000;

type Store = Pick<Storage, "getItem" | "setItem">;

/**
 * Whether the page may reload itself now. It may when it has not done so in the last minute, and
 * then the time is written down. Without storage it never does, so it can never loop.
 */
export function mayReload(storage: Store | null, now: number): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

/** Reload now if the guard allows it. Returns true when it did. */
export function reloadOnce(): boolean {
  let storage: Storage | null = null;
  try {
    storage = window.sessionStorage;
  } catch {
    storage = null;
  }
  if (!mayReload(storage, Date.now())) return false;
  window.location.reload();
  return true;
}

/**
 * A logger for promises nobody caught. The same message is logged once, and only a handful in
 * all, so a broken loop cannot fill the console. Cancelled requests are not errors.
 */
export function createRejectionLogger(log: (message: string) => void, limit = 5) {
  const seen = new Set<string>();
  return (reason: unknown): boolean => {
    const text = errorText(reason).trim().slice(0, 200);
    if (!text || /\bAbortError\b/.test(text)) return false;
    if (seen.has(text) || seen.size >= limit) return false;
    seen.add(text);
    log(text);
    return true;
  };
}
