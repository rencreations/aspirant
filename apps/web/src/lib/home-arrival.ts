/**
 * Does this document load of the site run the home page's own loading screen (the drone, the tap
 * gate, the intro)? The decision is made once, by the boot script in `<head>` before first paint
 * (`lib/boot-script.ts`), and written as `html[data-arrival="home"]`. The rule:
 *
 *  - the document is the home page (`/`, with the base path, a trailing slash or `index.html`),
 *  - `sessionStorage["aspirants:intro"]` is not `"off"` (tests and probes switch every intro off),
 *  - the browser says it is a `navigate`, a `reload` or a `back_forward` load. That is a visit from
 *    outside the site or a reload. A move between two pages of the site never loads a document
 *    (the router swaps the page), so it never gets here: it keeps the logo curtain.
 *
 * The same rule exists twice, once as a plain function (this file, used by tests and by anything
 * that wants to ask) and once as the text of the boot script, which has to be written in old
 * syntax and has no imports. `home-arrival.test.ts` runs one table of cases through both.
 */

/** sessionStorage key: `"off"` skips every intro and every hold of the site (tests, probes). */
export const INTRO_KEY = "aspirants:intro";

export interface HomeArrivalInput {
  /** `location.pathname` of the document. */
  pathname: string;
  /** `siteConfig.basePath`, empty on the domain root. */
  basePath: string;
  /** `performance.getEntriesByType("navigation")[0].type`, or null when the browser has none. */
  navType: string | null;
  /** `sessionStorage[INTRO_KEY] === "off"`. */
  introOff: boolean;
}

function stripSlashes(path: string): string {
  return path.replace(/\/+$/, "");
}

/** True for the home document: the base path itself or its `index.html`, slashes ignored. */
export function isHomePath(pathname: string, basePath = ""): boolean {
  const base = stripSlashes(basePath);
  const path = stripSlashes(pathname);
  return path === base || path === `${base}/index.html`;
}

/** True when this document load runs the home loading screen. */
export function decideHomeArrival(input: HomeArrivalInput): boolean {
  if (!isHomePath(input.pathname, input.basePath)) return false;
  if (input.introOff) return false;
  // An unknown type (an old browser) is the common case: a plain visit. A page that was only
  // prerendered has not been visited yet, so it is not an arrival.
  const type = input.navType ?? "navigate";
  return type === "navigate" || type === "reload" || type === "back_forward";
}

/**
 * The same rule as an expression for the boot script: it evaluates to true or false when run with
 * the page's `location`, `sessionStorage` and `performance`. Old syntax, no imports, never throws.
 */
export function homeArrivalExpression(basePath: string): string {
  const base = JSON.stringify(stripSlashes(basePath));
  return (
    `(function(){var b=${base},p=location.pathname.replace(/\\/+$/,"");` +
    `if(p!==b&&p!==b+"/index.html")return!1;` +
    `try{if(sessionStorage.getItem(${JSON.stringify(INTRO_KEY)})==="off")return!1}catch(x){}` +
    `var t="navigate";` +
    `try{var n=performance.getEntriesByType("navigation")[0];if(n&&n.type)t=n.type}catch(x){}` +
    `return t==="navigate"||t==="reload"||t==="back_forward"})()`
  );
}
