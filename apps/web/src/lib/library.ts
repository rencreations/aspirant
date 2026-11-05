/**
 * Where the collection's files live. Every picture, film, song and caption of `/collection` is
 * in the R2 bucket (public at https://s3.aspirant.cc), not in the repository. A data file names
 * a file by its key (a path under `library/v1/`, for example `arts/official/x/f.webp`) and this
 * module makes the address. The local mirror of the bucket (`D:\ren\aspirant-r2`) has the same
 * tree, so a developer can serve it and point the site at it:
 *
 *   npx serve D:\ren\aspirant-r2 -l 3300 --cors
 *   NEXT_PUBLIC_LIBRARY_ORIGIN=http://localhost:3300 pnpm dev
 *
 * See scripts/library/README.md.
 */
export const LIBRARY_VERSION = "v1";

const DEFAULT_ORIGIN = "https://s3.aspirant.cc";

/** The origin that serves the bucket, without a trailing slash. */
export const libraryOrigin = (process.env.NEXT_PUBLIC_LIBRARY_ORIGIN ?? DEFAULT_ORIGIN).replace(
  /\/+$/u,
  "",
);

/** The address of a library file from its key. */
export function libUrl(key: string): string {
  return `${libraryOrigin}/library/${LIBRARY_VERSION}/${key.replace(/^\/+/u, "")}`;
}
