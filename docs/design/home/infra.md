# Home: shared infrastructure (workstream X)

The pieces the rebuilt home page and its opening stand on. Everything here is small, tested and backwards compatible: with `aspirants:intro = off`, or on any route but `/`, the site behaves as it did before.

## Files

| File                                                                                  | What                                                                                                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/home-arrival.ts`                                                                 | The arrival rule: pure function `decideHomeArrival` and the same rule as the boot script's text (`homeArrivalExpression`). `INTRO_KEY`.                                   |
| `lib/boot-script.ts`                                                                  | The whole inline boot script (`bootScript(basePath)`), moved out of `app/layout.tsx` so a test can run it (a layout may only export what Next knows). Old behaviour kept. |
| `lib/home-flow.ts`                                                                    | `useHomeFlow` (zustand), the phase machine, `runHomeFlow` (the orchestrator), `tapToContinue`, `listenForTap`, and the pure helpers for the shown progress.               |
| `components/loader-gate.tsx`                                                          | The host. Branches on the arrival: curtain as before, or the home opening.                                                                                                |
| `components/home-boot/`                                                               | THE SLOT. The placeholder loading screen, tap gate and (empty) intro. Helper A replaces what it draws.                                                                    |
| `lib/nav-lock.ts`, `components/nav/site-nav.tsx`, `nav.module.css`                    | `hideLogo`, `hideControls`, and their reset on a path change.                                                                                                             |
| `app/layout.tsx`                                                                      | Imports `bootScript`. The cover markup is unchanged.                                                                                                                      |
| `e2e/helpers.ts`, `e2e/a11y.spec.ts`, `e2e/roster-intro.spec.ts`                      | `tapHome`, `/` in `streamsVideo`, the loader specs, the one spec that opens `/` with intros on.                                                                           |
| `scripts/qa/probes/lib.cjs`, `first-visit.cjs`, `routes.cjs`, `scripts/perf/weak.mjs` | Intro off by default, a tap step where the opening is the thing measured, a home branch in `weak.mjs`.                                                                    |

Unit tests: `home-arrival.test.ts` (one table of cases through the function AND through the script's text, and the whole boot script run against a stand-in page), `home-flow.test.ts`, `nav-lock.test.ts`, `components/nav/site-nav.test.tsx` (the wiring: attributes, `inert`, the reset on a path change, no reset on `/`).

## 1. The arrival decision

A **document load of `/`** (type `navigate`, `reload` or `back_forward`) with `sessionStorage["aspirants:intro"]` not `"off"` runs the home opening. The boot script writes `html[data-arrival="home"]` and `data-gate-kind="home"` and paints the cover at once (`data-gate="on"`), in a tab that has entered or not, with no 1.5 s wait. The rule, with its cases:

| Situation                                                                         | Result                                                                                          |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A visit from outside, a typed address, a reload, Back to a reloaded document, `/` | home opening                                                                                    |
| `/index.html` (what Lighthouse audits), a base path with or without its slash     | home opening                                                                                    |
| `aspirants:intro = off` (every spec and probe)                                    | old rules: an entered tab shows no cover, a fresh tab the logo curtain. The home opens at once. |
| Another route is the landing page (`/about/`, a chapter, ...)                     | the logo curtain on a first visit, as before. No home opening.                                  |
| Client-side move to `/` (menu, a link, Back inside the site)                      | the logo curtain, then the home at rest. The opening never replays.                             |
| Type `prerender`                                                                  | not an arrival (the page has not been visited yet)                                              |
| A browser with no navigation entry                                                | taken as `navigate`                                                                             |

Decisions made without the owner: (1) The referrer is NOT looked at (the digest suggested it). A reload keeps the original referrer, so it would add nothing to case (e), and the owner's words ("a document load") are met without it. A plain `<a>` from another page of the site to `/` (never used: every link is a `TLink`) would replay the opening. (2) `/index.html` counts as the home so that Lighthouse sees the home loader. Not verified without a build: what `usePathname()` returns on `/index.html`. The host never uses it for the home (it asks for `routeItems("/")`), and `shouldClearHomeNav` treats both spellings as the home.

The cover (`.gate-cover`, `styles/base.css`) is unchanged: wordmark, sweeping bar, notes at 15 s and 90 s, the reload link at 90 s. No timer lets it go. For a home arrival it goes when the loading screen has drawn two frames (`HomeBoot` calls `advance("boot")`), or at the end if the loading screen failed. `data-gate-kind="home"` is there for A to restyle the cover if the drone loader needs a different one.

## 2. `lib/home-flow.ts`

```ts
useHomeFlow: {
  arrival: "document" | "site" | "off";
  phase: "cover" | "boot" | "tap" | "intro" | "open";
  progress: PreloadProgress | null;
  notes: {
    (slow, offline, retrying);
  }
  (advance("boot" | "tap"), tap(), finishIntro(), abort(), setProgress, setNotes, seed);
}
(selectIsOpen, selectHomeActive, useHomeIsOpen()); // isOpen = phase === "open"
tapToContinue(); // audio.unlock() synchronously, then tap(); does nothing outside the tap phase
listenForTap(); // any click or tap that BEGAN after the gate appeared, Enter, Space
(whenHomePhase(p), runHomeFlow(deps), settleHomeFlow());
(stepShown, shownPercent, pickPending, bytesWords); // pure, for the loading screen
```

Phases only move forward. `cover` (the plain cover is up), `boot` (the cover is gone, the real bar runs), `tap` ("Touch anywhere to continue"), `intro` (after the press, scroll held), `open`. `abort()` goes to `open` from anywhere.

**Arrival values.** `document`: this document runs the opening. `off`: intro off, the phase is `open` from the start. `site`: anything else, the phase is `open` from the start. A page that mounts finds `isOpen` already true in the last two. After a `document` arrival has ended the arrival stays `document` and the phase is `open`: key on the phase, never on the arrival alone. A later in-site move to `/` finds `open` and must open at rest (the big logo already big, the nav empty if the design says so), with no intro.

**Hydration (K, A).** The store is created neutral (`site`, `open`), the same on the server and in the first client render, and `settleHomeFlow()` runs when the module first runs in the browser and seeds the real values (it also takes `data-arrival` off the page). So `useHomeFlow.getState()` is right in every effect, including the first one, but the first RENDER of a component still sees the neutral state (a re-render follows at once). Do not branch markup on the phase while rendering. Read `useHomeFlow.getState()` in effects, and subscribe for what must follow. Measured: a document load of `/` logs no hydration warning.

**What `LoaderGate` (the host) owns, so it does not depend on how the loading screen looks:**

1. `#site-shell` is inert from the start of the opening to `open`.
2. `setEntered(false)` at the start (also on a reload in an entered tab, where the session flag would otherwise make the consent plate and the menu-art warm-up run behind the loader), `setEntered(true)` at `open`. `entered` is set at the end of the intro, not at the press. The About drone, the consent plate (900 ms later) and the menu art wait for it.
3. The router is claimed (`useTransitionRouter().claim()`), so `N`, a `TLink` and the next-page footers stand down. Released at `open`.
4. The scroll is held with `useScrollLock().lock(2 h)` (the limit is a leak guard, never a time to wait for) and `window.scrollTo(0, 0)` at the start and at the end. The release re-syncs Lenis to the page.
5. The preload: `runPreload(routeItems("/"))`, however long it takes, then `whenPageReady()` (every `expectReady` mark), and only then the gate. Nothing is capped.
6. The notes: slow after 15 s (`SLOW_AFTER_MS`), offline at once, a stalled download, the same fixed paragraph at `z-index: 2000` as the curtain's path, hidden when the list is done. `useHomeFlow.getState().notes` has the same facts.
7. The press: `listenForTap()` while the phase is `tap`.
8. An error boundary around `HomeBoot`: if it throws, `abort()` opens the page at once.
9. `data-gate` and `data-gate-kind` are taken off when the loading screen has drawn, and in the `finally`.

Measured on the dev server (1440 and 390 wide, real Chrome): cover painted at 0.2 s with `data-arrival="home"`, then boot with the real bar, then the gate. With the engine chunk held back the bar stood at 24 percent for the whole hold (a fonts item done, the chunk pending): nothing moves it. Offline: "Offline. Waiting for the connection. Loading goes on by itself when it is back. 25%." and it clears when the connection returns. At 15 s: "Slow connection. Still loading, 25%. The page opens when everything is loaded, with all its animations." The shown number lags the note's (24 against 25) and never passes it. Release: 100 percent and the gate. Gate left alone for 2.5 s: still up. Click, Enter and Space each open it. `entered` is null at the gate and `1` after `open`. The consent plate shows 0.9 s or more after `open`, never before.

**Shown progress.** `stepShown(shown, real, dt)` closes on the real fraction with `1 - exp(-6 dt)`, never passes it, never goes back. `shownPercent` writes whole numbers rounded down, never above the real percent, 99 at most until the phase is `tap`, 100 from `tap` on. `pickPending(pending, fallback, tick)` cycles the labels of the downloads that are running (they are real), a tick every 2.4 s in the placeholder. `bytesWords` says "3.2 MB of 9.8 MB", and only "3.2 MB received" while some download has not said its size.

**How K combines the scroll hold and `BareScrollbar`.** The host holds the scroll for the whole opening (`lock` pauses Lenis, which gives `.lenis-stopped { overflow: clip }`, and swallows wheel, touch and scroll keys). While the cover is up `body` is `overflow: hidden`. A classic scrollbar that came back at `open` would shift the page sideways, so the home root must mount `<BareScrollbar />` from its first render, unconditionally (not on the phase). The host never touches `html[data-bare-scroll]`. K must not lock or unlock the scroll for the opening itself, and its own scroll code starts working at `open` (the host's release has re-synced Lenis at 0). Before `open` the scroll position is 0.

## 3. The slot for A: `components/home-boot/home-boot.tsx`

Rendered by `LoaderGate`, outside `#site-shell`, at `--z-transition` (90: above the page, under the lantern cursor at 95 and the 2000 note), from the first frame of a home arrival until `open`. The contract is written at the top of the file. In short: the root carries `data-home-boot` and `data-phase` (the probes read them); in `cover` draw, and after the first painted frame call `advance("boot")`; in `boot` show the real progress from `useHomeFlow.getState().progress` in your own frame loop (not React state), lagging and never leading; in `tap` a focusable control named "Touch anywhere to continue" whose click calls `tapToContinue()` (the host also answers any click or tap, Enter and Space); in `intro` play the intro and call `finishIntro()` once at its end (the placeholder calls it at once). The last frame of the intro must be the page's rest state, because the host unmounts the slot when the phase is `open`. It must not throw (if it does, the page opens). Do not add a timer that moves the bar, a cap, or "Enter now".

The placeholder matches the plain cover (same ground, mark, bar; measured: the mark's and the bar's tops are identical to the cover's at 1440 and at 390 wide) so the hand-over is not seen. Its bar is `role="progressbar"` with an accessible name and `aria-valuenow`; the gate is a real `<button>`, full screen, focused when it appears; the focus ring is on the words; the words keep full contrast (a pulse on their opacity failed axe at the wrong instant: the gate animates a hairline under them with a transform).

## 4. NavLock: `hideLogo` and `hideControls`

`useNavLock.setState({ hideLogo: true, hideControls: true })`. Both default to false and nothing existing changes.

- `hideControls`: the menu button, the sound button, the record widget and the page name on the right (`.left` and `.here`) go `opacity: 0; visibility: hidden; pointer-events: none` and the two elements are `inert`. They fade out in 160 ms and fade in in 420 ms (`--dur-slow`), so a bar that fills back is obvious. The `M` hotkey still works (it lives in `HudFrame`).
- `hideLogo`: the brand link (`[data-logo-host]`) goes `opacity: 0; visibility: hidden` and is `inert`. **It does not fade, on purpose**: the home swaps its big logo for the bar's in one frame, and a fade would show both. Set `hideLogo: false` in the same frame the clone is removed.
- Nothing is `display: none` and no box moves, so the logo's rect stays measurable. Verified: the rect, the menu button's rect and the logo rect are identical shown, hidden and shown again at six sizes.
- **Reset.** `SiteNav` clears both fields when the path changes to any page but the home (`shouldClearHomeNav`, `clearHomeNav`), in a layout effect, so it runs before the new page's effects, and not on unmount. `/about` never opens with an empty bar. On `/` it does nothing, so a page that sets the fields in the same commit keeps them. K sets the fields on `/` only, and does not need to reset on unmount. On the first mount of `SiteNav` the effect also runs (nothing to clear).
- **The logo host.** The element is `<a data-logo-host class=brand>` (a `TLink` to `/`) in `header[data-overlay="nav"]`; its child is the vector `svg` (`AspirantLogo variant="interactive"`, viewBox `0 0 3018 897`, aspect 3.3645). The morph target is the rect of `header[data-overlay="nav"] [data-logo-host] svg`. Query it, never hard-code it. Measured (x, y, width, height), no scrollbar:

| Viewport    | Rect of the svg      | Centre                                                             |
| ----------- | -------------------- | ------------------------------------------------------------------ |
| 1440 x 900  | 632.5, 14, 175, 52   | 720, 40                                                            |
| 1920 x 1080 | 872.5, 14, 175, 52   | 960, 40                                                            |
| 2560 x 1440 | 1192.5, 14, 175, 52  | 1280, 40                                                           |
| 1024 x 768  | 424.5, 14, 175, 52   | 512, 40                                                            |
| 820 x 1180  | 349.4, 14, 121.1, 36 | 410, 32                                                            |
| 390 x 844   | 251.1, 14, 121.1, 36 | 311.7, 32 (right end: under 48em the brand is `justify-self: end`) |

The bar is 80 px high from 901 px wide and 64 px below. A classic scrollbar (15 px) would move the centre by 7.5 px: another reason for `BareScrollbar`. Measure again on resize.

## 5. Runners

- `scripts/qa/probes/lib.cjs` `context()` sets `entered = 1` and the consent answer, and sets `intro = off` **only when the document is the home page** (the init script compares `location.pathname` with the path of `BASE`). Deliberate: a global `off` would also have skipped About's flight, Tetra's entrance, TheMLabel's close and the roster's intro, and `about.cjs` (which calls `context()` and sets the key itself only when it does not want the opening) would have photographed the finished page in its `intro` part. Checked: with this rule `about.cjs` `PARTS=intro` still shows the drone mid flight and the title opening, `menu-shots.cjs` and `routes.cjs` get the home at once, and `routes.cjs INTRO=1` presses the gate (`tap {gateAfter: 1.0, openAfter: 0.15}` on the dev server). The key stays in the tab's session once written, so a probe that visits `/` and then loads another page in the same context keeps intro off there. New `tapHome(page)` presses the gate and returns the seconds the gate waited and the seconds the opening took (null when there is no gate).
- `first-visit.cjs` does NOT set intro off (it tests the first visit). It reports `home` (the phase) and `pct` each second, presses the gate once when `home` is `tap` (set `NOTAP=1` to leave it standing), and goes on until the page is open. Measured on `/` at 1 Mbit with 200 ms latency on the dev server: the cover (and its own 15 s note) until hydration at 16 s (a 9 MB development bundle), boot at 19 s, gate at 22 s, open at 25 s.
- `routes.cjs` sets intro off in every context. `INTRO=1` keeps the home's opening, presses the gate and prints `tap {gateAfter, openAfter}`.
- `scripts/perf/weak.mjs`: for the route `/` (or empty) it sets entered and intro off (so the numbers are the page's), rests 6 s and then scrolls with a real wheel, `SCREENS` screens (default 62), a frame report every 5. `FULL=1` plays the opening instead: frames of the loading screen, the press, frames of the intro. Not run (it needs Edge and a throttled run on a build).
- `e2e/helpers.ts`: `skipGate` already sets `entered` and `intro = off` (its comment now says it covers the home too). `tapHome(page)` presses the gate and waits for the shell to be live. `streamsVideo("/")` is true (the home plays clips and downloads in the background, so `networkidle` never comes; K may drop it). Every spec calls `skipGate` except `a11y.spec.ts`'s two home loader tests, which are the point. `roster-intro.spec.ts` "arriving from the home page plays it" opens `/` with intros ON (the roster's intro must play) and now presses the gate first.
- `e2e/a11y.spec.ts`: the old test held `img/portal/vexana/depth.webp` (gone with the old home). Now (1) a loading-screen test holds the files under `/img`, `/models`, `/video` and `/data`, waits for the cover to go, and checks the progressbar (name, a numeric `aria-valuenow`), the inert shell and axe; (2) a gate test waits for the gate, checks inert, axe, that the gate stands for 1.5 s, and that a press opens the page. If the home's first list holds nothing from those folders, (1) sees the gate and still passes; it holds nothing in a way that depends on K's list. Both ran green on phone, tablet and desktop against the dev server, three times each.
- `lighthouserc.json` needs no change. `/index.html` is a home arrival, so a fresh Lighthouse profile sees the loader or the gate. What it needs, and has: a named `role="progressbar"` with `aria-valuenow`, a `<button>` named "Touch anywhere to continue", ink `#140e26` on `#f4f6f9` (over 15:1), no focusable element under `aria-hidden`. The score was NOT measured (no build, no Lighthouse run); axe through Playwright is the proxy and found nothing serious once the pulse was moved off the text.

## 6. The comic's helpers (not moved)

`features/library/comic/zoom/kit.ts` holds what a custom change of page needs, and they stay there until K asks. `holdScroll()` swallows wheel, touch and the scroll keys in the capture phase, does NOT pause Lenis (the scrollbar stays), and returns an async release that waits for the wheel's momentum (up to 1.2 s). `useGoto()` returns `goto(href)`: `router.push(href, { scroll: false })` and a promise that resolves when the pathname is the target (no timer). `arrive(scrollTo)` puts the new page at the top, fires `REVEAL_EVENT` (`aspirants:reveal`) and focuses `#main`. The home to About handoff in the design needs exactly these. Do not mix `holdScroll` with the host's `useScrollLock`. If K or S7 wants them, move the three to `components/transition/`, keep the comic's import path working, and run knip.

## 7. Suggested wording for the integrator

- CLAUDE.md "Loading", add: "A document load of `/` (a visit from outside or a reload, with `aspirants:intro` not `off`) runs the home's own opening instead of the curtain: the plain cover, a loading screen with the real bar (`components/home-boot/`), then one press ('Touch anywhere to continue', also Enter and Space, which unlocks the sound) and the intro. The press is asked for only when the whole waited list has arrived, so it is not an 'Enter now'. `LoaderGate` hosts it (`lib/home-flow.ts`); `entered` is set at the end of the intro. A move inside the site to `/` uses the curtain and opens at rest. Probes and specs use `aspirants:intro = off`."
- CLAUDE.md "Navbar and menu", add: "`useNavLock` has `hideLogo` and `hideControls` for the home's opening. The bar clears them when the path changes to any other page."
- HANDOFF "Loading": the loader paragraph's first sentence ("shows the logo curtain on the first visit of a browser session") is true for every route but a document load of `/`; and "nothing to click" there is true of the curtain only.

## 8. Not verified

- A production build (none allowed): every number above is from the dev server. The specs I ran (the a11y loader pair on phone, tablet and desktop, and on desktop `shell.spec.ts`, `menu.spec.ts` and the roster intro spec "arriving from the home page plays it") passed against `E2E_BASE_URL=http://localhost:3100/`, not against `out`. Not run at all: every other spec of the suite (they all use `skipGate`, which sets intro off, so they follow the old path that this change does not touch), `smoke.spec.ts` and the `ROUTES` loop of `a11y.spec.ts`, `home.spec.ts` (K's: it is about the old page). Run the full e2e suite on a build.
- The score of Lighthouse, `/index.html` itself (what the router thinks the path is there), a base path build.
- Firefox, Safari, a real phone: the gate needs a real gesture for the sound on iOS (`audio.unlock()` runs inside `click` and `keydown`, as the site already does elsewhere).
- StrictMode double effects: covered by the `started` ref (no cleanup in the host's effect), seen working in dev. HMR of `home-flow.ts` itself in dev resets the store to open.
- `weak.mjs`'s new home branch and `routes.cjs INTRO=1` were syntax-checked and the code path of `tapHome` was exercised by the e2e helper, but not run end to end.
