import { RELOAD_KEY, RELOAD_WINDOW_MS } from "@/lib/chunk-guard";
import { homeArrivalExpression } from "@/lib/home-arrival";
import { ENTERED_KEY } from "@/lib/stores";

/**
 * The script that runs in `<head>` before first paint (`app/layout.tsx` inlines it). It lives here,
 * not in the layout, so a test can run its text (a layout may only export what Next knows).
 *
 * It marks JS, sets the pointer type, and paints the gate cover:
 *
 *  - for a document load of the home page that runs the home loading screen (`lib/home-arrival.ts`):
 *    at once, whether this tab has entered or not, and it also writes `html[data-arrival="home"]`
 *    and `data-gate-kind="home"` for the loader to read (`components/loader-gate.tsx`);
 *  - for a tab that has not entered yet;
 *  - for a returning tab whose scripts are slow to start (1.5 s).
 *
 * The cover stays until the loader has taken over (the logo curtain has been drawn, or the home
 * loading screen has drawn its first frame). There is no timer that lets it go: a slow connection
 * waits behind it, with a note, and never gets the plain server text of the page, however long the
 * scripts take (owner decision, 1 Nov 2026, one version only). The only way out is the "Reload the
 * page" link it shows after 90 s, for a visitor whose scripts have really failed. A visitor without
 * JavaScript never gets the cover (this script does not run).
 *
 * It also catches a page whose own scripts or styles failed to arrive (an old deploy, or a
 * connection that dropped before they came): it reloads once, under the same one-a-minute rule as
 * `lib/chunk-guard.ts`, and when the device is offline it reloads as soon as the connection is back.
 */
export function bootScript(basePath: string): string {
  return `(function(){try{var d=document.documentElement;d.classList.add("js");d.dataset.pointer=matchMedia("(hover: hover) and (pointer: fine)").matches?"fine":"coarse";var e=!1;try{e=sessionStorage.getItem("${ENTERED_KEY}")==="1"}catch(x){}var h=${homeArrivalExpression(basePath)};if(h){d.dataset.arrival="home";d.dataset.gateKind="home";d.dataset.gate="on"}else if(!e){d.dataset.gate="on"}else{setTimeout(function(){if(!window.__aspirantsGate)d.dataset.gate="on"},1500)}var k="${RELOAD_KEY}";var go=function(){try{var a=+sessionStorage.getItem(k)||0,n=Date.now();if(a&&n-a<${RELOAD_WINDOW_MS})return;sessionStorage.setItem(k,String(n));location.reload()}catch(x){}};addEventListener("error",function(v){var t=v.target;if(!t||(t.tagName!=="SCRIPT"&&t.tagName!=="LINK"))return;if((t.src||t.href||"").indexOf("/_next/static/")<0)return;try{if(!navigator.onLine){addEventListener("online",go,{once:true});return}go()}catch(x){}},true)}catch(x){}})();`;
}
