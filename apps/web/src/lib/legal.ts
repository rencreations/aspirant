import type { Route } from "next";

/**
 * The facts the legal pages, the consent banner and the takedown page share. One place, so a
 * change of address or of a retention setting is made once. The pages (`app/terms`, `app/privacy`,
 * `app/takedown`) read their wording from `features/legal/`.
 */

/** The person who runs the site and answers every request. Shown on the legal pages. */
export const OPERATOR = {
  name: "Muhammad Idham Ma'arif",
  role: "Data Protection Officer",
  email: "idham@creations.ren",
  /** The office address, one line per row as it is printed. */
  addressLines: [
    "Treasury Tower, 6th Floor (Unit F), District 8",
    "Jl. Jend. Sudirman Kav. 52-53, Lot 28",
    "Senayan, Kebayoran Baru, Kota Jakarta Selatan",
    "DKI Jakarta 12190, Indonesia",
  ],
} as const;

/** The day the current terms and privacy policy took effect. */
export const LEGAL_EFFECTIVE = "12 November 2026";

/** The legal pages. Real routes, so they work before the scripts have run. */
export const LEGAL_ROUTES = {
  terms: "/terms",
  privacy: "/privacy",
  takedown: "/takedown",
} as const satisfies Record<string, Route>;

/** Google Tag Manager container that carries the Google tag. It loads only after consent. */
export const GTM_ID = "GTM-PZP9Q52J";
/** The Google Analytics 4 measurement ID inside that container. */
export const GA_ID = "G-7BHES29TV4";
/** How long Google Analytics keeps event data and user data, as set in the property (months). */
export const GA_RETENTION_MONTHS = 14;

/** localStorage key of the visitor's analytics choice. */
export const CONSENT_KEY = "aspirants:consent";
/** A saved choice is asked again after this long. */
export const CONSENT_MAX_AGE_DAYS = 365;

/** How many days we take, at most, to remove a work after a complete notice. */
export const TAKEDOWN_DAYS = 7;
/** How many working days a counter-notice waits before the work may go back. */
export const COUNTER_NOTICE_DAYS = 10;
/** How long a notice or a privacy request is kept after the matter is closed (years). */
export const REQUEST_KEEP_YEARS = 3;
/** How many days we take to answer a privacy request. */
export const PRIVACY_REPLY_DAYS = 3;
/** The longest a complex privacy request can take (days). */
export const PRIVACY_LONGEST_DAYS = 30;
